# Architecture

Transcript Registry is the public system of record. Transcript Commons is a
local worker and corpus toolkit.

```text
ChatGPT / Claude / browser
          |
          v
Registry search.txt / search.json  <----------------------+
          |                                               |
    results exist?                                        |
       /       \                                          |
     yes       no: deduplicated topic job                 |
      |                    |                              |
 transcript page           v                              |
                    Commons local worker                   |
                 discover captioned videos                 |
                           |                              |
                    Registry video jobs                    |
                           |                              |
              captions first; permissioned ASR             |
                           |                              |
                    validate + provenance                  |
                           |                              |
                           +---- publish to Neon -----------+
```

## Responsibilities

- **Registry:** Neon storage, full-text search, topic/video queues, rate
  limiting, stable HTML/TXT/JSON pages, sitemap, robots, and `llms.txt`.
- **Commons:** YouTube discovery, caption retrieval, local MLX Whisper or
  whisper.cpp compute, record validation, dataset/topic catalogs, and Registry
  publishing.
- **Vercel:** serves text and APIs. It does not download media or run Whisper.

## Safety and trust

Every record retains the source URL, channel attribution, transcript method,
timestamps, and a content hash. Caption text and ASR can be wrong, so agents
should link the Registry page and check the original timestamp for high-stakes
claims.

Audio fallback is permission-gated. The default accepts Creative Commons
videos and channels listed in `PERMISSIONED_CHANNEL_IDS`; broader processing
requires an explicit operator decision.
