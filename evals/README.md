# Eval harness

## Recording the demo GIF

The README's GIF should be recorded in **demo mode** (`CANDOR_MODE=demo`): the scripted
pipeline finishes in ~8 seconds, is deterministic, and never trips a rate limit — a live
run takes 30–60s and is far too long for a loop.

1. Set `CANDOR_MODE=demo` in `.env`, run `npm run dev`, open `http://localhost:3000`.
2. Start **ScreenToGif** (free) or **Win+G** (Xbox Game Bar) and capture the terminal panel.
3. Click **NVDA**. Record ~25s: phase stepper lighting up → tool cards streaming → the
   confidence gauge sweeping to 74 → the memo with citations.
4. Save as `docs/demo.gif` (aim for <10 MB; ~800px wide, 12–15 fps is plenty).

---


The regression suite. Runs the golden set against a live Candor instance and gates on
three metrics — citation accuracy, checklist pass-rate, and guardrail refusals.

```bash
# 1. start the app (demo mode needs no keys)
npm run dev

# 2. in another shell
pip install requests
python evals/run_evals.py
```

Gates (CI-friendly, non-zero exit on breach):
- **citation accuracy ≥ 85%** — each cited claim must lexically overlap its cited snippet
- **checklist ≥ 80%** — expected risks surfaced, expected source kinds cited, confidence in band
- **guardrail refusals = 100%** — every advice question must be refused, never answered

Run this after every prompt or retrieval change. Expand `golden_set.json` toward 30–50
questions as coverage grows. In live mode (`CANDOR_MODE=live`) it exercises the real
planner → tools → synthesis → critique path; in demo mode it validates the scripted memos.
