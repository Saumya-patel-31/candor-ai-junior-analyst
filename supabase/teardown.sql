-- ════════════════════════════════════════════════════════════════════════
-- Candor — TEARDOWN.  ⚠️ DESTRUCTIVE — drops all Candor tables + data.
-- Run this first, then run supabase/schema.sql for a clean rebuild.
-- Safe whether you applied 0001 only, or 0001 + 0002, at any embedding dim
-- (the 1024 vs 768 dimension does not affect these DROP statements).
-- ════════════════════════════════════════════════════════════════════════

-- RPC first (drops cleanly regardless of the vector() dimension it was created with).
drop function if exists match_filing_chunks(vector, text, integer);

-- Tables — CASCADE also removes their indexes, foreign keys, and RLS policies.
drop table if exists calibration_runs   cascade;
drop table if exists calibration_scores cascade;
drop table if exists tool_calls         cascade;
drop table if exists filing_chunks      cascade;
drop table if exists memos              cascade;

-- The pgvector extension is left installed (harmless, and other schemas may use it).
-- To remove it too, uncomment:
-- drop extension if exists vector;
