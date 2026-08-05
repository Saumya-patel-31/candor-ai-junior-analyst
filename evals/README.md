# Eval harness

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
