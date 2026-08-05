#!/usr/bin/env python3
"""
Candor — SEC EDGAR ingestion.

Pulls, for a given ticker:
  1. XBRL company facts (data.sec.gov)                → structured fundamentals
  2. the latest 10-K, extracts Item 1A (Risk Factors) + Item 7 (MD&A)
  3. chunks + embeds those sections                   → Supabase `filing_chunks`

The Next.js RAG tool (lib/data/embeddings.ts) then retrieves these chunks at query
time via the `match_filing_chunks` RPC.

Usage:
    python ingestion/ingest.py NVDA
    python ingestion/ingest.py NVDA DIS TSLA
    python ingestion/ingest.py NVDA --dry-run     # print chunks, no embed/insert

SEC fair-access policy REQUIRES a descriptive User-Agent with contact info and
caps traffic (~10 req/s). Set SEC_USER_AGENT in your .env.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path

import requests

# Windows consoles default to cp1252 and raise UnicodeEncodeError on the status
# glyphs below. Force UTF-8 output (and never let logging crash the ingest).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):  # pragma: no cover
        pass

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    print("Missing dependency. Run: pip install -r ingestion/requirements.txt")
    sys.exit(1)

# ── env ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".env.local")
except ImportError:
    pass

SEC_UA = os.getenv("SEC_USER_AGENT", "Candor Research student-project contact@example.com")
EMBED_PROVIDER = os.getenv("CANDOR_EMBED_PROVIDER", "gemini")  # gemini | ollama | voyage
EMBED_MODEL = os.getenv("CANDOR_EMBEDDING_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.getenv("CANDOR_EMBEDDING_DIM", "768"))
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
VOYAGE_KEY = os.getenv("VOYAGE_API_KEY", "")
OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1").rstrip("/")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {"User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate"}
_last_call = 0.0


def throttle(max_rps: int = 8) -> None:
    global _last_call
    gap = 1.0 / max_rps
    wait = _last_call + gap - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_call = time.time()


# ── SEC helpers ──────────────────────────────────────────────────────────────
def get_cik(ticker: str) -> str | None:
    """Resolve a ticker to a zero-padded 10-digit CIK via SEC's ticker map."""
    throttle()
    r = requests.get("https://www.sec.gov/files/company_tickers.json", headers=HEADERS, timeout=30)
    r.raise_for_status()
    for row in r.json().values():
        if row["ticker"].upper() == ticker.upper():
            return str(row["cik_str"]).zfill(10)
    return None


def get_company_facts(cik: str) -> dict:
    throttle()
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def summarize_facts(facts: dict) -> None:
    gaap = facts.get("facts", {}).get("us-gaap", {})
    wanted = ["Revenues", "GrossProfit", "OperatingIncomeLoss", "NetIncomeLoss"]
    print("  XBRL facts:")
    for concept in wanted:
        node = gaap.get(concept)
        if not node:
            continue
        series = node.get("units", {}).get("USD", [])
        latest = sorted([p for p in series if p.get("form") in ("10-K", "10-Q")], key=lambda p: p["end"], reverse=True)
        if latest:
            v = latest[0]["val"]
            print(f"    - {concept:28s} {v/1e9:,.2f}B  ({latest[0]['form']} {latest[0]['end']})")


def get_latest_10k(cik: str) -> tuple[str, str, str] | None:
    """Return (accession, primary_document_url, filed_date) for the latest 10-K."""
    throttle()
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    recent = r.json()["filings"]["recent"]
    for form, acc, doc, date in zip(
        recent["form"], recent["accessionNumber"], recent["primaryDocument"], recent["filingDate"]
    ):
        if form == "10-K":
            acc_nodash = acc.replace("-", "")
            doc_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{doc}"
            return acc, doc_url, date
    return None


def fetch_filing_text(doc_url: str) -> str:
    throttle()
    r = requests.get(doc_url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "table"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


# (anchor regex, confirming keyword that must appear soon after, end-marker regex)
# Filings vary wildly: MSFT writes '"Risk Factors" (Part I, Item 1A ...)' and AMZN
# 'Item 1A of Part I — "Risk Factors."', so the anchor and its keyword are NOT
# reliably adjacent. We collect every plausible start and keep the LONGEST
# resulting section, which is the real body rather than a TOC row or cross-ref.
ITEM_PATTERNS = {
    "Item 1A": (r"item\s*1a", "risk factors", r"item\s*1b|item\s*2[.\s]"),
    "Item 7": (r"item\s*7", "management", r"item\s*7a|item\s*8[.\s]"),
}
MAX_SECTION = 90_000
MIN_SECTION = 2_000

# Fallback anchors for filings (MSFT, AMZN, …) that never place the item number
# tight against the section title in flattened text. Used ONLY when the primary
# pattern finds nothing, so it cannot regress filings that already parse well.
FALLBACK_PATTERNS = {
    "Item 1A": (r"risk\s*factors", r"item\s*1b|unresolved\s+staff\s+comments"),
    "Item 7": (r"management.{0,3}s\s+discussion\s+and\s+analysis", r"item\s*7a|quantitative\s+and\s+qualitative"),
}


def _slice_best(low: str, text: str, start_re: str, end_re: str) -> str | None:
    """Take the LAST anchor that still yields a substantial body section."""
    best: str | None = None
    for m in re.finditer(start_re, low):
        start = m.start()
        ends = [e.start() for e in re.finditer(end_re, low) if e.start() > start + MIN_SECTION]
        end = min(ends[0] if ends else len(text), start + MAX_SECTION)
        section = text[start:end].strip()
        if len(section) >= MIN_SECTION:
            best = section
    return best


def extract_sections(text: str) -> dict[str, str]:
    """Heuristic slice of Item 1A + Item 7 from flattened 10-K text.

    Primary patterns expect "Item 1A. Risk Factors" style headings. Filings that
    only ever write cross-references ("Item 1A of Part I, 'Risk Factors'") fall
    back to anchoring on the section title itself.
    """
    low = text.lower()
    out: dict[str, str] = {}

    for item, (start_re, _keyword, end_re) in ITEM_PATTERNS.items():
        primary = f"{start_re}[.\\s—–:-]*{_keyword.replace(' ', chr(92) + 's*')}"
        section = _slice_best(low, text, primary, end_re)
        if section is None:
            fb_start, fb_end = FALLBACK_PATTERNS[item]
            section = _slice_best(low, text, fb_start, fb_end)
        if section:
            out[item] = section

    return out


def chunk_text(text: str, size: int = 1200, overlap: int = 200) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    step = max(1, size - overlap)
    while i < len(words):
        chunks.append(" ".join(words[i : i + size]))
        i += step
    return chunks


# ── embeddings + upsert ──────────────────────────────────────────────────────
def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed via the configured FREE provider (gemini / ollama), or voyage."""
    extra: dict = {}
    if EMBED_PROVIDER == "gemini":
        if not GEMINI_KEY:
            raise RuntimeError("GEMINI_API_KEY not set — use --dry-run to preview.")
        base, key, extra = "https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, {"dimensions": EMBED_DIM}
    elif EMBED_PROVIDER == "ollama":
        base, key = OLLAMA_BASE, ""  # local, e.g. `ollama pull nomic-embed-text`
    else:  # voyage (paid)
        if not VOYAGE_KEY:
            raise RuntimeError("VOYAGE_API_KEY not set — use --dry-run to preview.")
        base, key, extra = "https://api.voyageai.com/v1", VOYAGE_KEY, {"input_type": "document"}

    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    r = requests.post(
        f"{base}/embeddings",
        headers=headers,
        json={"model": EMBED_MODEL, "input": texts, **extra},
        timeout=120,
    )
    r.raise_for_status()
    return [d["embedding"] for d in r.json()["data"]]


def embed_batch_resilient(texts: list[str], attempts: int = 6) -> list[list[float]]:
    """Free embedding tiers are request-per-minute capped. Back off and retry
    rather than losing a whole ticker to one 429."""
    delay = 8.0
    for attempt in range(1, attempts + 1):
        try:
            return embed_batch(texts)
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            if status not in (429, 500, 502, 503, 504) or attempt == attempts:
                raise
            retry_after = (e.response.headers.get("retry-after") if e.response is not None else None)
            wait = float(retry_after) if (retry_after or "").replace(".", "", 1).isdigit() else delay
            print(f"    · {status} from embeddings; retrying in {wait:.0f}s ({attempt}/{attempts})")
            time.sleep(wait)
            delay = min(delay * 1.7, 90)
    raise RuntimeError("embeddings: retries exhausted")


def upsert_chunks(rows: list[dict]) -> None:
    if not (SUPABASE_URL and SUPABASE_KEY):
        raise RuntimeError("Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")
    # `on_conflict` must name the unique constraint columns or PostgREST inserts
    # (and 409s) instead of upserting — which makes re-ingesting a ticker fail.
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/filing_chunks?on_conflict=accession,item,chunk_index",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        json=rows,
        timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"Supabase insert failed {r.status_code}: {r.text[:300]}")


# ── main ─────────────────────────────────────────────────────────────────────
def ingest_ticker(ticker: str, dry_run: bool) -> None:
    ticker = ticker.upper()
    print(f"\n▸ {ticker}")
    cik = get_cik(ticker)
    if not cik:
        print(f"  ✗ no CIK found for {ticker}")
        return
    print(f"  CIK {cik}")

    try:
        summarize_facts(get_company_facts(cik))
    except Exception as e:  # noqa: BLE001
        print(f"  ! company facts failed: {e}")

    latest = get_latest_10k(cik)
    if not latest:
        print("  ✗ no 10-K found")
        return
    accession, doc_url, filed = latest
    print(f"  10-K {accession} filed {filed}")

    text = fetch_filing_text(doc_url)
    sections = extract_sections(text)
    if not sections:
        print("  ! could not isolate Item 1A / Item 7 (filing formatting varies)")
        return

    rows: list[dict] = []
    for item, body in sections.items():
        chunks = chunk_text(body)
        print(f"  {item}: {len(chunks)} chunks ({len(body):,} chars)")
        for idx, content in enumerate(chunks):
            rows.append(
                {
                    "ticker": ticker,
                    "cik": cik,
                    "form": "10-K",
                    "item": item,
                    "accession": accession,
                    "filed_at": filed,
                    "chunk_index": idx,
                    "content": content,
                }
            )

    if dry_run:
        print(f"  [dry-run] {len(rows)} chunks — first preview:")
        print("   ", rows[0]["content"][:240], "…")
        return

    # Embed in batches, attach vectors, upsert. Smaller batches + pacing keep us
    # inside free-tier request-per-minute limits.
    BATCH = 16
    PACE_SECONDS = 4.0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        vectors = embed_batch_resilient([r["content"] for r in batch])
        for r, v in zip(batch, vectors):
            r["embedding"] = v
        upsert_chunks(batch)
        print(f"  ↑ upserted {i + len(batch)}/{len(rows)}")
        if i + BATCH < len(rows):
            time.sleep(PACE_SECONDS)
    print(f"  ✓ {ticker} ingested")


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest SEC filings for Candor RAG.")
    ap.add_argument("tickers", nargs="+", help="Ticker symbols, e.g. NVDA DIS TSLA")
    ap.add_argument("--dry-run", action="store_true", help="Print chunks without embedding/inserting")
    args = ap.parse_args()
    print(f"SEC User-Agent: {SEC_UA}")
    for t in args.tickers:
        try:
            ingest_ticker(t, args.dry_run)
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {t} failed: {e}")


if __name__ == "__main__":
    main()
