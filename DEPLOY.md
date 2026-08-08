# Deploying Candor to Vercel

The repo is deploy-ready: `vercel.json` (daily calibration cron) and `maxDuration = 60`
on the agent routes are already committed. Deploy takes about two minutes.

## 1. Import the repo

Go to **[vercel.com/new](https://vercel.com/new)** → *Import Git Repository* →
select `candor-ai-junior-analyst`.

Vercel auto-detects Next.js. Leave build settings at their defaults.

## 2. Environment variables

Add these in the import screen (or later under *Settings → Environment Variables*).
Copy the values from your local `.env` — **never commit that file**.

### Option A — zero config (bundled dataset)

| Variable | Value |
|---|---|
| `CANDOR_MODE` | `demo` |

Deploys a fully working site — terminal animation, memos, dashboard, track record — with
no keys and no spend. Good if you just want the link up today.

### Option B — a real agent visitors can actually use (recommended)

Free, no key entry for visitors, and it survives real traffic:

| Variable | Notes |
|---|---|
| `CANDOR_MODE` | `live` |
| `CANDOR_LLM_PROVIDER` | `cerebras` |
| `CEREBRAS_API_KEY` | free, **1M tokens/day**, no card — [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| `GROQ_API_KEY` | free — automatic fallback when Cerebras' daily cap hits |
| `GEMINI_API_KEY` | free — second fallback, and powers embeddings |
| `SEC_USER_AGENT` | must contain a real contact email (SEC fair-access) |
| `FINNHUB_API_KEY` | news tool |
| `CANDOR_DAILY_QUERY_CAP` | e.g. `25` — per-IP abuse cap |
| `CANDOR_CACHE_TTL_HOURS` | e.g. `12` — how long a memo is reused |

Then warm the cache once so the first visitor to each ticker gets an instant answer:

```bash
python evals/precompute.py --api https://<your-app>.vercel.app
```

**Why this holds up:** cached memos cost nothing and return in ~4s, so the daily model
budget is spent only on genuinely new questions; when one provider's cap is reached the
agent transparently continues on the next; and if everything is exhausted it degrades to
the demo dataset rather than erroring. `maxDuration` is 60s (the Vercel Hobby ceiling),
which comfortably covers a cached replay and a normal live run.

### Optional — filing RAG, persistence, calibration

| Variable | Enables |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 10-K RAG, memo persistence, real track record |
| `GEMINI_API_KEY`, `CANDOR_EMBED_PROVIDER=gemini`, `CANDOR_EMBEDDING_DIM=768` | embeddings for retrieval |
| `ALPHAVANTAGE_API_KEY` | outcome resolution for calibration |
| `CRON_SECRET` | protects `POST /api/cron/resolve`; also the internal-tools token for evals |

> `CANDOR_EMBEDDING_DIM` **must** match `vector(768)` in `supabase/schema.sql`.

## 3. Verify

After the first deploy:

```bash
curl https://<your-app>.vercel.app/api/health
```

Returns per-service status and `"healthy": true/false`. A 503 means a **core** check
(LLM or SEC) is failing — everything else degrades gracefully to demo data.

## 4. Calibration cron

`vercel.json` registers a daily job hitting `/api/cron/resolve`, which scores memos whose
horizon has elapsed. Set `CRON_SECRET` so the endpoint isn't public, and add the same value
under *Settings → Environment Variables*. Vercel Cron sends the request automatically; the
route also accepts `?secret=` for manual runs.

## Kill switch

Set `CANDOR_KILL_SWITCH=true` to disable all live model/tool calls instantly (falls back to
demo) without redeploying code.
