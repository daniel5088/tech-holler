import { createHash } from "node:crypto";

/** Long-lived anonymous device identifier cookie. */
export const TH_VID_COOKIE = "th_vid";

/** One year, in seconds — the th_vid cookie lifetime. */
export const TH_VID_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Server-only salt for the engagement hashes. Read from the environment so the
 * raw device id / IP never leave the request and the stored hashes are not
 * reversible without the secret. Never hardcode; never expose to the client.
 */
const SALT = process.env.READER_ENGAGEMENT_SALT;

/** Engagement writes require both a configured salt and the service client. */
export const engagementConfigured = Boolean(SALT);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Stable per-device hash. Throws if the salt is not configured. */
export function visitorHash(vid: string): string {
  if (!SALT) throw new Error("READER_ENGAGEMENT_SALT is not configured");
  return sha256(`${vid}${SALT}`);
}

/**
 * Best-effort per-IP hash for rate limiting. Returns null when no client IP can
 * be determined (the RPC then skips the rate-limit check). Throws if the salt is
 * not configured.
 */
export function ipHash(forwardedFor: string | null): string | null {
  if (!SALT) throw new Error("READER_ENGAGEMENT_SALT is not configured");
  if (!forwardedFor) return null;
  // x-forwarded-for may be a comma-separated list; the first entry is the client.
  const clientIp = forwardedFor.split(",")[0]?.trim();
  if (!clientIp) return null;
  return sha256(`${clientIp}${SALT}`);
}
