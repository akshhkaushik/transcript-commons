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
    const payload = (await response.json()) as {
      results?: Array<{ transcript?: string; text?: string }>;
      discovery?: { statusUrl?: string } | null;
    };
    for (const result of payload.results ?? []) {
      if (result.transcript) {
        result.transcript = new URL(result.transcript, REGISTRY_ORIGIN).toString();
      }
      if (result.text) {
        result.text = new URL(result.text, REGISTRY_ORIGIN).toString();
      }
    }
    if (payload.discovery?.statusUrl) {
      payload.discovery.statusUrl = new URL(
        payload.discovery.statusUrl,
        REGISTRY_ORIGIN,
      ).toString();
    }
    return Response.json(payload, {
      status: response.status,
      headers: {
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
