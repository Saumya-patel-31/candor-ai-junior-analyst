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

### Minimum for a working public demo

| Variable | Value | Why |
|---|---|---|
| `CANDOR_MODE` | `demo` | Scripted pipeline: ~8s, deterministic, no API spend. **Recommended for the public URL.** |

That alone deploys a fully working site — the terminal animation, memos, dashboard, and
track record all run on the bundled dataset. Nothing else is required.

### To run the live agent in production

| Variable | Notes |
|---|---|
| `CANDOR_MODE` | `live` |
| `CANDOR_LLM_PROVIDER` | `groq` |
| `GROQ_API_KEY` | free key |
| `SEC_USER_AGENT` | must contain a real contact email (SEC fair-access) |
| `FINNHUB_API_KEY` | news tool |
| `CANDOR_DAILY_QUERY_CAP` | e.g. `25` — per-IP abuse cap |

⚠️ **Live mode on a public URL is slower and rate-limit bound.** A memo takes ~30–60s on
Groq's free tier (12k tokens/min), and `maxDuration` is capped at 60s on Vercel Hobby, so
a heavy run can be cut off. Demo mode is the safer default for a portfolio link; keep live
mode for local runs and screenshots.

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
