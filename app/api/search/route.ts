const REGISTRY_ORIGIN = (
  process.env.REGISTRY_URL ?? "https://transcript-registry.vercel.app"
).replace(/\/$/, "");

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL("/search.json", REGISTRY_ORIGIN);

  for (const key of ["q", "limit", "discover"]) {
    const value = incoming.searchParams.get(key);
    if (value !== null) {
      upstream.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ??
          "application/json; charset=utf-8",
        "cache-control":
          response.headers.get("cache-control") ??
          "public, max-age=60, s-maxage=60",
        link: `<${upstream}>; rel="canonical"`,
        "x-transcript-registry": REGISTRY_ORIGIN,
      },
    });
  } catch {
    return Response.json(
      {
        error: "Transcript Registry is temporarily unavailable",
        registry: REGISTRY_ORIGIN,
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
