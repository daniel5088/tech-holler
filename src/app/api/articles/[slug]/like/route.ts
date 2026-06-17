import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { isSameOriginRequest } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import {
  TH_VID_COOKIE,
  TH_VID_MAX_AGE,
  engagementConfigured,
  ipHash,
  visitorHash,
} from "@/lib/reader-engagement";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // CSRF guard — only same-origin requests may toggle a like.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServiceSupabase();
  if (!supabase || !engagementConfigured) {
    return NextResponse.json({ error: "Engagement is not configured" }, { status: 503 });
  }

  const { slug } = await params;

  // Read or mint the long-lived anonymous device id.
  const cookieStore = await cookies();
  let vid = cookieStore.get(TH_VID_COOKIE)?.value;
  let issuedVid = false;
  if (!vid) {
    vid = randomUUID();
    issuedVid = true;
  }

  const headerStore = await headers();
  const v_hash = visitorHash(vid);
  const ip_hash = ipHash(headerStore.get("x-forwarded-for"));

  // Resolve the published article id from its slug.
  const { data: article, error: lookupError } = await supabase
    .from("published_articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.rpc("toggle_article_like", {
    p_article_id: (article as { id: string }).id,
    p_visitor_hash: v_hash,
    p_ip_hash: ip_hash,
  });

  if (error) {
    // The RPC raises 'rate_limited' (errcode check_violation, 23514) for abuse.
    const status = error.code === "23514" ? 429 : 500;
    return NextResponse.json({ error: "Toggle failed" }, { status });
  }

  // The RPC returns a single-row set: [{ like_count, liked }].
  const row = Array.isArray(data) ? data[0] : data;
  const result = {
    likeCount: (row?.like_count as number) ?? 0,
    liked: Boolean(row?.liked),
  };

  const response = NextResponse.json(result);
  if (issuedVid) {
    response.cookies.set(TH_VID_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TH_VID_MAX_AGE,
      path: "/",
    });
  }
  return response;
}
