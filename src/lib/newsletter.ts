import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getArticles } from "@/lib/content";
import { env, newsletterDeliveryConfigured, siteUrl } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";
import { SITE_NAME } from "@/data/site";
import { formatDate } from "@/lib/format";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export function normalizeEmail(value: string): string | null {
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const TOKEN_SECRET =
  env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "tech-holler-newsletter";

export function signEmailToken(email: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(email).digest("hex");
}

export function verifyEmailToken(email: string, token: string): boolean {
  const expected = signEmailToken(email);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({ email, token: signEmailToken(email) });
  return `${siteUrl}/api/newsletter/unsubscribe?${params.toString()}`;
}

type SubscribeResult = "subscribed" | "already-subscribed" | "resubscribed";

export async function subscribeEmail(
  email: string,
  source = "site",
): Promise<SubscribeResult> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to store subscribers");

  const { data: existing } = await supabase
    .from("newsletter_subscribers")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "subscribed") return "already-subscribed";
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ status: "subscribed", unsubscribed_at: null })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return "resubscribed";
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email, source });
  // A concurrent insert can still trip the unique index; treat it as success.
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  return "subscribed";
}

export async function unsubscribeEmail(email: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to manage subscribers");
  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("email", email);
  if (error) throw new Error(error.message);
}

async function activeSubscribers(): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .eq("status", "subscribed");
  if (error) {
    console.error("Could not load subscribers:", error.message);
    return [];
  }
  return (data as { email: string }[]).map((row) => row.email);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type DigestArticle = {
  slug: string;
  title: string;
  dek: string;
  publishedAt: string;
  editorialMode?: string;
};

export function composeDigest(articles: DigestArticle[], recipientEmail: string) {
  const subject = `The Tech Holler: ${articles.length} fresh ${articles.length === 1 ? "holler" : "hollers"}`;
  const unsubscribe = unsubscribeUrl(recipientEmail);

  const items = articles
    .map((article) => {
      const url = `${siteUrl}/article/${article.slug}`;
      const tag = article.editorialMode === "talk-around-town" ? "Talk Around Town · " : "";
      return `
        <tr><td style="padding:0 0 22px;">
          <a href="${url}" style="color:#171915;font-size:18px;font-weight:700;text-decoration:none;">${escapeHtml(article.title)}</a>
          <div style="color:#62665d;font-size:13px;margin:4px 0 8px;">${tag}${formatDate(article.publishedAt)}</div>
          <div style="color:#33352f;font-size:14px;line-height:1.5;">${escapeHtml(article.dek)}</div>
        </td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f0e6;font-family:Georgia,serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf7;border:1px solid #171915;">
        <tr><td style="padding:24px 28px;border-bottom:2px solid #171915;">
          <div style="font-family:Arial,sans-serif;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;color:#f05a2b;">${SITE_NAME}</div>
          <div style="color:#62665d;font-size:12px;margin-top:4px;">The latest from the holler — generated by an automated AI pipeline.</div>
        </td></tr>
        <tr><td style="padding:24px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table></td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #d4cbbb;color:#62665d;font-size:12px;line-height:1.6;">
          You are getting this because you subscribed at <a href="${siteUrl}" style="color:#bd3f1b;">thetechholler.com</a>.
          <a href="${unsubscribe}" style="color:#bd3f1b;">Unsubscribe</a>.
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `${SITE_NAME} — the latest hollers`,
    "",
    ...articles.map((a) => `• ${a.title}\n  ${siteUrl}/article/${a.slug}`),
    "",
    `Unsubscribe: ${unsubscribe}`,
  ].join("\n");

  return { subject, html, text, unsubscribe };
}

async function sendEmail(to: string, subject: string, html: string, text: string, unsubscribe: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.NEWSLETTER_FROM_EMAIL,
      to,
      subject,
      html,
      text,
      reply_to: env.NEWSLETTER_REPLY_TO || undefined,
      headers: { "List-Unsubscribe": `<${unsubscribe}>` },
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}

export async function sendDigest(limit = 8) {
  const subscribers = await activeSubscribers();
  const articles = (await getArticles({ limit })).map((article) => ({
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    publishedAt: article.publishedAt,
    editorialMode: article.editorialMode,
  }));

  if (articles.length === 0) {
    return { status: "blocked" as const, reason: "No articles to feature", subscribers: subscribers.length };
  }
  if (subscribers.length === 0) {
    return { status: "blocked" as const, reason: "No active subscribers", articles: articles.length };
  }
  if (!newsletterDeliveryConfigured) {
    const { subject } = composeDigest(articles, subscribers[0]);
    return {
      status: "dry-run" as const,
      reason: "RESEND_API_KEY and NEWSLETTER_FROM_EMAIL are not set; nothing was sent",
      subject,
      recipients: subscribers.length,
      articles: articles.length,
    };
  }

  let sent = 0;
  const failures: string[] = [];
  for (const email of subscribers) {
    try {
      const { subject, html, text, unsubscribe } = composeDigest(articles, email);
      await sendEmail(email, subject, html, text, unsubscribe);
      sent += 1;
    } catch (error) {
      failures.push(`${email}: ${error instanceof Error ? error.message : "send failed"}`);
    }
  }
  return {
    status: "sent" as const,
    sent,
    failed: failures.length,
    articles: articles.length,
    failures: failures.slice(0, 10),
  };
}
