const REGISTRY_ORIGIN = (
  process.env.REGISTRY_URL ?? "https://transcript-registry.vercel.app"
).replace(/\/$/, "");

export async function GET() {
  const body = `# Transcript Commons

Transcript Commons supplies local discovery and transcription compute to the public Transcript Registry.

Agents should use the Registry:
- Search text: ${REGISTRY_ORIGIN}/search.txt?q=linear+algebra
- Search JSON: ${REGISTRY_ORIGIN}/search.json?q=linear+algebra
- Agent instructions: ${REGISTRY_ORIGIN}/llms.txt

If a search has no results, Registry automatically creates a deduplicated topic job. A separately operated Commons worker discovers suitable YouTube videos, retrieves captions or runs permissioned local ASR, and saves the results. Retry the search URL or poll the discovery URL returned by the API.

All public transcript reading and search is free and requires no account.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
