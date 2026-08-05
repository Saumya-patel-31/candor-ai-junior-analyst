-- ════════════════════════════════════════════════════════════════════════
-- Candor — FINAL consolidated schema (Supabase / Postgres + pgvector)
-- = migrations 0001 + 0002, merged, with the correct embedding dimension.
--
-- Run supabase/teardown.sql FIRST if you previously applied an older schema,
-- then run this whole file once in the Supabase SQL editor.
--
-- Embedding dim = 768 (free defaults: gemini-embedding-001 @ 768, or
-- nomic-embed-text). It MUST match CANDOR_EMBEDDING_DIM. If you change models,
-- change every vector(768) below to the new dimension.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

-- ── memos ────────────────────────────────────────────────────────────────
create table if not exists memos (
  id                text primary key,
  ticker            text not null,
  company           text,
  question          text not null,
  as_of             date not null default current_date,
  stance            text not null check (stance in ('constructive','cautious','mixed','neutral')),
  confidence_score  int  not null check (confidence_score between 0 and 100),
  thesis            text not null,
  payload           jsonb not null,           -- the full Memo object (metrics, risks, citations, critique…)
  cost_usd          numeric(10,5) default 0,
  latency_ms        int default 0,
  tokens_in         int default 0,
  tokens_out        int default 0,
  mode              text not null default 'live' check (mode in ('demo','live')),
  created_at        timestamptz not null default now()
);
create index if not exists memos_ticker_idx  on memos (ticker);
create index if not exists memos_created_idx on memos (created_at desc);

-- ── tool_calls (cost/latency log — the "cost engineering" evidence) ───────
create table if not exists tool_calls (
  id             bigint generated always as identity primary key,
  memo_id        text references memos(id) on delete cascade,
  tool           text not null,
  args           jsonb,
  status         text not null default 'success',
  latency_ms     int default 0,
  tokens_in      int default 0,
  tokens_out     int default 0,
  cost_usd       numeric(10,6) default 0,
  result_summary text,
  created_at     timestamptz not null default now()
);
create index if not exists tool_calls_memo_idx on tool_calls (memo_id);
create index if not exists tool_calls_tool_idx on tool_calls (tool);

-- ── filing_chunks (RAG corpus) ───────────────────────────────────────────
create table if not exists filing_chunks (
  id          bigint generated always as identity primary key,
  ticker      text not null,
  cik         text,
  form        text not null,                 -- 10-K | 10-Q
  item        text,                          -- 'Item 1A' | 'Item 7' …
  accession   text,
  filed_at    date,
  chunk_index int not null default 0,
  content     text not null,
  embedding   vector(768),
  created_at  timestamptz not null default now(),
  unique (accession, item, chunk_index)
);
create index if not exists filing_chunks_ticker_idx on filing_chunks (ticker);
-- Approximate-nearest-neighbour index for cosine similarity.
create index if not exists filing_chunks_embedding_idx
  on filing_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── calibration_scores (public track record) ─────────────────────────────
create table if not exists calibration_scores (
  id                bigint generated always as identity primary key,
  memo_id           text references memos(id) on delete cascade,
  ticker            text not null,
  question          text,
  stance            text,
  confidence_score  int not null,
  horizon_days      int not null default 90,
  as_of             date,
  ref_price         numeric(14,4),
  observed_return   numeric(8,4),             -- realized return over the horizon
  benchmark_return  numeric(8,4),             -- benchmark return over the horizon
  resolved          boolean not null default false,
  correct           boolean,                  -- did the directional read hold?
  resolved_at       date,
  note              text,
  created_at        timestamptz not null default now()
);
create index if not exists calibration_memo_idx        on calibration_scores (memo_id);
create index if not exists calibration_unresolved_idx  on calibration_scores (resolved) where resolved = false;
create index if not exists calibration_asof_idx        on calibration_scores (as_of);

-- ── calibration_runs (resolver ops log) ──────────────────────────────────
create table if not exists calibration_runs (
  id           bigint generated always as identity primary key,
  ran_at       timestamptz not null default now(),
  scanned      int not null default 0,
  resolved     int not null default 0,
  market_ready boolean not null default true,
  note         text
);

-- ── match_filing_chunks() — hybrid RAG retrieval RPC ─────────────────────
-- Cosine similarity over pgvector, filtered by ticker. Called from
-- lib/data/embeddings.ts::retrieveFilingChunks.
create or replace function match_filing_chunks(
  query_embedding vector(768),
  match_ticker    text,
  match_count     int default 6
)
returns table (
  form     text,
  item     text,
  text     text,
  "filedAt" text,
  score    float
)
language sql stable
as $$
  select
    fc.form,
    fc.item,
    fc.content as text,
    fc.filed_at::text as "filedAt",
    1 - (fc.embedding <=> query_embedding) as score
  from filing_chunks fc
  where fc.ticker = upper(match_ticker)
    and fc.embedding is not null
  order by fc.embedding <=> query_embedding
  limit match_count;
$$;

-- ── Row-level security (public read of published memos/calibration) ───────
alter table memos              enable row level security;
alter table calibration_scores enable row level security;

drop policy if exists "public read memos" on memos;
create policy "public read memos" on memos for select using (true);

drop policy if exists "public read calibration" on calibration_scores;
create policy "public read calibration" on calibration_scores for select using (true);
-- Writes go through the service-role key (server-only), which bypasses RLS.
