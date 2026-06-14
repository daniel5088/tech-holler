import { cookies } from "next/headers";
import { env, siteUrl } from "@/lib/env";

export const ADMIN_COOKIE = "tech-holler-admin";

export async function isAdminAuthenticated() {
  if (!env.ADMIN_DASHBOARD_TOKEN) return true;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === env.ADMIN_DASHBOARD_TOKEN;
}

export function isAllowedAdminOrigin(origin: string, expectedSiteUrl = siteUrl) {
  try {
    return new URL(origin).origin === new URL(expectedSiteUrl).origin;
  } catch {
    return false;
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  return isAllowedAdminOrigin(origin);
}

export function isEditorialDraftBearerAuthorized(request: Request) {
  if (!env.EDITORIAL_DRAFT_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.EDITORIAL_DRAFT_TOKEN}`;
}
