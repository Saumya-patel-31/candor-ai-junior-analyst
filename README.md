# Candor — AI Junior Analyst

> **The AI analyst that knows what it doesn't know.**
> An autonomous research agent that plans its own multi-step research, grounds every
> claim in SEC filings, critiques its own draft, and publishes a public record of how
> well-calibrated its confidence actually is.

<!-- Demo GIF goes here. Record ~25s of the terminal running (see "Recording the demo" below),
     save as docs/demo.gif, then this line renders it: -->
![Candor running a live memo](docs/demo.gif)

**⚠️ Research/education tool — not investment advice.** No "should I buy/sell," no
portfolio guidance, no trade execution. A fixed disclaimer rides every memo; personalized
advice is refused at the door.

---

## Try it

```bash
npm install && npm run dev     # runs fully in demo mode — no API keys needed
```

Deploying? See **[DEPLOY.md](./DEPLOY.md)** (2 minutes on Vercel's free tier).

---

## What it does

Point it at a ticker. It runs a five-stage agent loop and streams every step live:

```
User query
   │
   ▼
[Planner · fast model] ── decides which tools to call, and in what order
   │
   ▼
[Tool execution] ── get_fundamentals (XBRL) · search_filings (RAG over 10-K/10-Q)
   │                 get_recent_news   (parallel, each logged)
   ▼
[Synthesizer · reasoning model] ── forced-JSON memo: thesis, metrics, risks, catalysts,
   │                       confidence (0–100), every claim tagged with a citation id
   ▼
[Self-critique · reasoning model] ── adversarial re-read vs. the evidence; deletes unsupported
   │                         claims, addresses contradictions, adjusts confidence
   ▼
[Guardrails] ── advice-phrasing scrub · disclaimer injection · confidence logged
   │
   ▼
Memo  +  public calibration track record
```

The **differentiator** is the last part: every confidence score is logged and later scored
against observed outcomes. The public [track record](./app/track-record) reports **ECE**,
**Brier score**, and a **reliability diagram** — framed as a calibration experiment, never
as "our AI beats the market."

## Runs instantly — zero config

The whole app boots in **demo mode** with a fully scripted pipeline and three genuinely
sharp memos (NVDA, DIS, TSLA). No API keys, no database.

```bash
npm install
npm run dev        # → http://localhost:3000
```

Wire your keys (see `.env.example`) and set `CANDOR_MODE=live` to switch on real
SEC + LLM retrieval — the streaming UI is identical in both modes.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Agent | Hand-rolled loop on any **OpenAI-compatible** provider — no LangChain |
| Providers | **Groq · Gemini · OpenRouter · Ollama** — all free, no credit card |
| Model routing | small model plans; larger model synthesizes + critiques (per provider) |
| Structured output | Zod-enforced JSON memo schema |
| DB | Supabase Postgres + **pgvector** (`memos`, `tool_calls`, `filing_chunks`, `calibration_scores`) |
| RAG | Hybrid retrieval over 10-K/10-Q chunks via a `match_filing_chunks` RPC |
| Ingestion | Python — SEC EDGAR XBRL + 10-K section extraction → chunk → embed |
| UI | Tailwind + Framer Motion, dark "research terminal" system |

## Live mode — free

Candor is provider-agnostic. The fastest free path (**Groq**, no credit card):

```bash
cp .env.example .env
# CANDOR_MODE=live
# CANDOR_LLM_PROVIDER=groq
# GROQ_API_KEY=...        # free key: https://console.groq.com/keys
npm run dev
```

That alone gives you a live planner → synthesis → self-critique loop for free. Prefer a
different brain? Set `CANDOR_LLM_PROVIDER` to `gemini`, `openrouter`, or `ollama` (local,
no key) and drop in that provider's key. Model tiers auto-select per provider.

**Optional — filing RAG + track record** (adds Supabase, all still free):

1. Apply the schema: run `supabase/schema.sql` in the Supabase SQL editor (to reset an older
   apply, run `supabase/teardown.sql` first). The numbered `migrations/` are kept for history.
2. Set `CANDOR_EMBED_PROVIDER=gemini` (+ `GEMINI_API_KEY`) or `ollama` for embeddings, and a free
   market-data key (`ALPHAVANTAGE_API_KEY` / `FINNHUB_API_KEY`).
3. Ingest filings:
   ```bash
   pip install -r ingestion/requirements.txt
   python ingestion/ingest.py NVDA DIS TSLA
   ```

> The tools (fundamentals, news, RAG, sentiment) degrade gracefully — the agent runs live with
> just a Groq key and simply uses fewer sources until you add the rest.

## Running it for real users (free)

A public deployment can't ask visitors for an API key, and no single free tier
survives real traffic. Three mechanisms make it work at zero cost:

**1. Memo cache — the main lever.** Visitors overwhelmingly click the same tickers, and
a 10-K doesn't change between two clicks. A recent stored memo is replayed through the
same event stream (identical animation) in **~4s at $0**, versus ~30s and ~6k tokens to
regenerate. Warm it for the whole universe with:

```bash
python evals/precompute.py            # one memo per covered ticker, cached
```

**2. Provider failover.** Every provider you add a key for becomes an automatic fallback
when the one above it hits its daily cap. The agent switches mid-run rather than failing:

| Provider | Free daily budget |
|---|---|
| Cerebras (recommended primary) | **~1M tokens/day**, no card |
| Groq | 100k/day on 70B (500k on 8B), fastest |
| Gemini | ~250 requests/day, plus free embeddings |

Together that's comfortably over a million tokens a day — and with caching, most requests
never spend any of it.

**3. Caps and a kill switch.** Per-IP daily cap, a global cap, a concurrency cooldown, and
`CANDOR_KILL_SWITCH=true` to stop all model spend instantly. If everything is exhausted the
app degrades to the bundled demo dataset rather than erroring.

## Accuracy engineering

Financial data is easy to get subtly, badly wrong. The safeguards here are the point:

| Failure mode | Guard |
|---|---|
| **Quarter reported as annual** — naive "latest XBRL value" returns a 90-day figure for `Revenues` ($81.6B) that reads as yearly ($215.9B actual) | Every fact is period-classified and **TTM-normalized**; the period is printed next to each number (`[TTM ending 2026-04-26]`) and passed to the model |
| **Stale deprecated tags** — a company migrates tags and the old one keeps returning a 4-year-old value | Freshness filter + concept fallback that prefers whichever tag still reports **current** data |
| **Ratios across mismatched periods** | Margins are only derived from facts sharing the **same** period; otherwise omitted |
| **Invented citations** — the model references a source id that doesn't exist | `enforceCitationIntegrity` strips unresolvable refs and **drops any claim left uncited** |
| **Unsupported claims** | Adversarial self-critique pass removes them and lowers confidence |
| **Schema drift** — open-weight models emit `null` for optional fields, `"c1"` for `["c1"]` | Tolerant coercion layer + one self-repair retry |
| **Free-tier rate limits** | Retry honoring `Retry-After`, evidence-bundle token budget, paced ingestion |
| **Abuse / cost blowout on a public deploy** | Per-IP daily cap, global daily cap, concurrency cooldown, kill switch |

**Known limitations** (stated plainly, because a flagship should be honest):
- 10-K section extraction is heuristic — filing HTML varies, so a ticker can yield partial sections.
- Coverage is the 12-name starter universe in `lib/config.ts`; other tickers are refused rather than guessed at.
- Memo *prose* quality is bounded by the free model tier; the grounding and guards are model-independent.

## Health check

One call tells you exactly which parts of the live stack are wired:

```bash
curl localhost:3000/api/health
```

Reports per-service status (LLM provider, SEC EDGAR, Supabase, embeddings, market data),
flags **core** vs. optional failures, verifies the embedding dimension matches the SQL
schema, and returns 503 if live memos would fall back to demo.

## Eval harness (the crown jewel)

```bash
npm run dev                       # in one shell
python evals/run_evals.py         # in another
```

Gates on **citation accuracy ≥ 85%**, **checklist ≥ 80%**, and **100% guardrail refusals**,
with a non-zero exit for CI. Run it after every prompt/retrieval change. See
[`evals/README.md`](./evals/README.md).

## Project structure

```
app/                    Next.js routes
  api/analyze/          SSE streaming agent endpoint (demo ↔ live)
  api/cron/resolve/     outcome-resolution job (scores due predictions)
  track-record/         public calibration dashboard
  dashboard/            cost & latency (model-routing) dashboard
  memo/[id]/            shareable memo view
  methodology/          how it works
lib/
  agent/                planner · synthesizer · critic · guardrails · orchestrator
  tools/                get_fundamentals · search_filings · news
  calibration/          scoring (Brier/ECE) · store · resolveDueMemos job
  analytics/            cost/latency aggregation (real-or-demo)
  data/                 SEC EDGAR · market data · embeddings/RAG
  demo/                 scripted pipeline + curated memos + calibration + cost data
  db/                   Supabase client + persistence
components/
  terminal/             the live agent-pipeline visualization
  memo/  charts/  landing/  viz/  ui/
supabase/migrations/    schema (pgvector + match_filing_chunks RPC + resolution)
ingestion/              Python SEC ingestion
evals/                  golden set + citation-accuracy CI checker
```

## Making calibration real

The track record is genuine, compounding data — not a static number:

1. **At memo time**, the orchestrator logs the prediction (ticker, stance, confidence, horizon)
   to `calibration_scores` via `recordPrediction`.
2. **When a horizon elapses**, the resolver ([`lib/calibration/store.ts`](./lib/calibration/store.ts) →
   `resolveDueMemos`) fetches the realized return over the horizon, scores the memo's directional
   *read* against its benchmark, and writes the outcome. Scoring rules live in
   [`lib/calibration/scoring.ts`](./lib/calibration/scoring.ts) (constructive → outperformed,
   cautious → underperformed, neutral → range-bound). Same math powers the demo, so both paths agree.
3. **On a schedule**, `POST /api/cron/resolve` runs the resolver. [`vercel.json`](./vercel.json) wires
   a daily Vercel Cron; protect it with `CRON_SECRET`. Locally: `curl localhost:3000/api/cron/resolve`.

Everything degrades gracefully — no Supabase/market key → the endpoint reports demo mode and the
pages fall back to the scripted dataset. The [`/dashboard`](./app/dashboard) route surfaces the
cost/latency/model-routing data logged to `tool_calls` + `memos`.

## Guardrails & compliance posture

- System prompts hard-forbid buy/sell calls, position sizing, and portfolio advice.
- Advice questions are refused before any tokens are spent; a deterministic scrub catches
  anything that slips through synthesis.
- The public track record is a **model-calibration experiment** — never a market-beating claim.

## Résumé framing

> Built an autonomous financial-research agent (planner → multi-tool execution → synthesis →
> self-critique) grounded in SEC EDGAR filings via hybrid RAG; shipped an automated eval
> harness gating citation accuracy and confidence calibration; engineered cost/latency budgets
> by routing planning vs. synthesis across model tiers; deployed publicly with a live
> calibration track record.

## Roadmap

- **Phase 1** — agent core (this repo) ✅
- **Phase 2** — expand golden set to 30–50, cost dashboard, shareable OG memo images
- **Phase 3** — launch with real calibration data
- **Phase 4 (hackUMBC)** — Bull vs. Bear multi-agent debate mode, judged by a third agent

---

_Candor is a student research project. It is not affiliated with the SEC or any issuer.
Nothing here is investment advice._
