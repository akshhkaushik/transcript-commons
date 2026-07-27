import { headers } from "next/headers";

export const CANONICAL_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://transcript-commons.vercel.app";

export async function currentRequestOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : CANONICAL_SITE_ORIGIN;
}

export async function requestOrigin() {
  return CANONICAL_SITE_ORIGIN;
}

export function isCanonicalRequest(requestUrl: string) {
  return new URL(requestUrl).origin === CANONICAL_SITE_ORIGIN;
}

export function canonicalHeaders(path: string, requestUrl: string) {
  return {
    link: `<${absoluteUrl(path)}>; rel="canonical"`,
    "x-robots-tag": isCanonicalRequest(requestUrl)
      ? "index, follow"
      : "noindex, follow",
  };
}

export function absoluteUrl(path: string, origin = CANONICAL_SITE_ORIGIN) {
  return new URL(path, `${origin}/`).toString();
}
