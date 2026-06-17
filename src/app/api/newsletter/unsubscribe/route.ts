import { normalizeEmail, unsubscribeEmail, verifyEmailToken } from "@/lib/newsletter";
import { SITE_NAME } from "@/data/site";

export const dynamic = "force-dynamic";

function page(heading: string, message: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading} · ${SITE_NAME}</title>
    <style>
      body{margin:0;background:#f4f0e6;color:#171915;font-family:Georgia,serif;display:grid;place-items:center;min-height:100vh;}
      main{max-width:460px;padding:40px;background:#fffdf7;border:1px solid #171915;box-shadow:6px 6px 0 #171915;margin:16px;}
      h1{font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.04em;font-size:22px;}
      a{color:#bd3f1b;font-weight:700;}
    </style></head>
    <body><main><h1>${heading}</h1><p>${message}</p><p><a href="/">Back to ${SITE_NAME}</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email") ?? "");
  const token = url.searchParams.get("token") ?? "";

  if (!email || !token || !verifyEmailToken(email, token)) {
    return page("Invalid link", "That unsubscribe link is invalid or has expired.", 400);
  }

  try {
    await unsubscribeEmail(email);
    return page("Unsubscribed", "You're off the list — no more hollers will land in your inbox.");
  } catch (error) {
    console.error("Newsletter unsubscribe failed:", error);
    return page("Something went wrong", "We couldn't process that just now. Try the link again later.", 500);
  }
}
