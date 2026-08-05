# Ingestion — SEC EDGAR → pgvector

Pulls XBRL fundamentals + 10-K risk-factor / MD&A sections, chunks + embeds them,
and upserts into Supabase `filing_chunks` for the RAG tool.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r ingestion/requirements.txt
```

Fill in `.env` at the repo root (see `.env.example`):
- `SEC_USER_AGENT` — **required** by SEC (descriptive name + email)
- `VOYAGE_API_KEY` — for embeddings
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — insert target

Apply the schema first (`supabase/migrations/0001_init.sql`).

## Run

```bash
# preview extraction without embedding or inserting
python ingestion/ingest.py NVDA --dry-run

# ingest one or many tickers
python ingestion/ingest.py NVDA
python ingestion/ingest.py NVDA DIS TSLA AAPL MSFT
```

10-K filings are cached permanently once ingested (they don't change), so this is a
one-time cost per ticker. Section extraction is heuristic — filing HTML varies, so
`--dry-run` first to sanity-check the slice.
