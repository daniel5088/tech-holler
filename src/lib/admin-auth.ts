import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const ADMIN_COOKIE = "tech-holler-admin";

export async function isAdminAuthenticated() {
  if (!env.ADMIN_DASHBOARD_TOKEN) return true;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === env.ADMIN_DASHBOARD_TOKEN;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  return new URL(origin).host === new URL(request.url).host;
}

export function isEditorialDraftBearerAuthorized(request: Request) {
  if (!env.EDITORIAL_DRAFT_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.EDITORIAL_DRAFT_TOKEN}`;
}
