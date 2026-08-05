-- ════════════════════════════════════════════════════════════════════════
-- Candor — calibration resolution (migration 0002)
-- Extends calibration_scores so the resolver can score a memo's directional read
-- against realized return, and logs each resolver run.
-- ════════════════════════════════════════════════════════════════════════

alter table calibration_scores
  add column if not exists stance           text,
  add column if not exists as_of            date,
  add column if not exists question         text,
  add column if not exists ref_price        numeric(14,4),
  add column if not exists observed_return  numeric(8,4),
  add column if not exists benchmark_return numeric(8,4);

create index if not exists calibration_unresolved_idx
  on calibration_scores (resolved) where resolved = false;
create index if not exists calibration_asof_idx on calibration_scores (as_of);

-- Log of resolver runs (ops visibility + idempotency audit).
create table if not exists calibration_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  scanned     int not null default 0,
  resolved    int not null default 0,
  market_ready boolean not null default true,
  note        text
);
