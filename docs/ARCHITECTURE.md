# Architecture

## Data flow

```text
YouTube search / playlist / channel
                |
                v
        deduplicated URL queue
                |
                v
         metadata + track audit
          /                 \
 creator/automatic       no captions
     JSON3                  |
       |               local audio
       |                  + ASR
       \                  /
        normalization + validation
                |
                v
      content/transcripts.json
                |
        Next.js / vinext build
                |
       HTML + TXT + JSON + APIs
                |
       sitemap / robots / llms.txt
```

## Trust model

Every transcript retains the original YouTube URL and a timestamp for each
block. `transcriptSource` distinguishes creator captions, automatic captions,
and local ASR. `provenance.contentSha256` makes accidental transcript changes
detectable. Automated medical transcripts carry an explicit warning until
reviewed.

This provenance explains where text came from; it does not make the claims in
the source video medically correct. Research users must evaluate the original
speaker, evidence, and context.

## Storage

The healthcare-first version keeps reviewed records in a version-controlled
JSON collection. This makes every public deployment deterministic and avoids a
hosted database or account system. If the collection grows beyond practical
repository/build limits, the record contract can move unchanged to object
storage plus a generated search index.

## Agent discovery

The primary agent surface is ordinary semantic, server-rendered HTML. Each
record also publishes plain text and JSON, advertises those alternate formats,
appears in the sitemap and `llms.txt`, and exposes complete provenance.
`OAI-SearchBot` and Claude search crawlers are explicitly allowed.
