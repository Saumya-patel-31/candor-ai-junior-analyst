#!/usr/bin/env python3
"""
Warm the memo cache for the whole coverage universe.

Run this once after deploying (and on a schedule if you like). Every ticker in
the universe gets a freshly generated memo stored in Supabase, so the first
visitor to click a ticker gets an instant, zero-token response instead of
waiting ~40s and burning the daily model budget.

    python evals/precompute.py                       # all covered tickers
    python evals/precompute.py NVDA DIS TSLA         # just these
    python evals/precompute.py --api https://your-app.vercel.app

Requires CRON_SECRET in .env (bypasses the public rate limit).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

UNIVERSE = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "DIS", "AMD", "NFLX", "JPM", "KO"]


def generate(api: str, ticker: str, secret: str | None) -> tuple[bool, str]:
    headers = {"x-candor-internal": secret} if secret else {}
    # ?fresh=1 bypasses the cache so we actually regenerate.
    url = f"{api}/api/analyze?fresh=1"
    memo, err = None, None
    try:
        with requests.post(url, json={"ticker": ticker}, headers=headers, stream=True, timeout=300) as r:
            if r.status_code != 200:
                return False, f"HTTP {r.status_code}"
            for raw in r.iter_lines(decode_unicode=True):
                if not raw or not raw.startswith("data:"):
                    continue
                try:
                    ev = json.loads(raw[5:].strip())
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "final":
                    memo = ev["memo"]
                elif ev.get("type") == "error":
                    err = ev["message"][:120]
    except requests.RequestException as e:
        return False, str(e)[:120]

    if not memo:
        return False, err or "no memo produced"
    if memo.get("mode") != "live":
        return False, "fell back to demo (provider quota?)"
    return True, f"conf={memo['confidenceScore']} cites={len(memo['citations'])}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tickers", nargs="*", default=[])
    ap.add_argument("--api", default=os.getenv("CANDOR_API", "http://localhost:3000"))
    ap.add_argument("--pause", type=float, default=6.0, help="seconds between tickers (free-tier pacing)")
    args = ap.parse_args()

    tickers = [t.upper() for t in (args.tickers or UNIVERSE)]
    secret = os.getenv("CRON_SECRET")

    print(f"Warming cache on {args.api} for {len(tickers)} tickers\n" + "-" * 56)
    ok = 0
    for i, t in enumerate(tickers, 1):
        started = time.time()
        good, detail = generate(args.api, t, secret)
        ok += good
        mark = "OK " if good else "FAIL"
        print(f"  [{mark}] {t:<6} {time.time() - started:5.1f}s  {detail}")
        if i < len(tickers):
            time.sleep(args.pause)

    print("-" * 56)
    print(f"  cached {ok}/{len(tickers)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
