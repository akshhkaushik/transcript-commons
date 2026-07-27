import { headers } from "next/headers";

export const FALLBACK_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://transcript-commons.rurradvisors.chatgpt.site";

export async function requestOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : FALLBACK_SITE_ORIGIN;
}

export function absoluteUrl(path: string, origin = FALLBACK_SITE_ORIGIN) {
  return new URL(path, `${origin}/`).toString();
}
