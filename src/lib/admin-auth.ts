import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const ADMIN_COOKIE = "tech-holler-admin";

export async function isAdminAuthenticated() {
  if (!env.ADMIN_DASHBOARD_TOKEN) return true;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === env.ADMIN_DASHBOARD_TOKEN;
}
