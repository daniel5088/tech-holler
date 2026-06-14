import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { env, siteRedirectUrl } from "@/lib/env";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = formData.get("token");
  if (!env.ADMIN_DASHBOARD_TOKEN || token !== env.ADMIN_DASHBOARD_TOKEN) {
    return NextResponse.json({ error: "Invalid dashboard token" }, { status: 401 });
  }

  const response = NextResponse.redirect(siteRedirectUrl("/admin"), 303);
  response.cookies.set(ADMIN_COOKIE, env.ADMIN_DASHBOARD_TOKEN, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
