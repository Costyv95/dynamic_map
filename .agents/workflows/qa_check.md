---
description: Runs the full test suite across all FairEat services.
---

# /qa_check [scope]

### Steps
1. **Scope resolution:**
   - `all` (default): Run all service test suites
   - `api` / `node`: Order & Menu service tests only
   - `dispatcher` / `go`: Go dispatcher tests only
   - `agents` / `python`: Python agentic services tests only
   - `client`: Client-side tests (React Native/Next.js)

2. **Node.js / TypeScript tests (Order & Menu Service):**
   // turbo
   ```bash
   pnpm --filter @faireat/api run test
   ```

3. **Go tests (Pulse Dispatcher):**
   // turbo
   ```bash
   go test ./services/dispatcher/... -v
   ```

4. **Python tests (Agentic Services):**
   // turbo
   ```bash
   PYTHONUNBUFFERED=1 python -m pytest services/agents/tests/ -v --tb=short
   ```

5. **Client tests (if applicable):**
   ```bash
   pnpm --filter @faireat/mobile run test
   pnpm --filter @faireat/web run test
   ```

6. **Discrepancy protocol:** If tests fail, determine whether the *code* or the *test* has drifted from intent. Do not blindly fix tests — consult the relevant ADR in `docs/history.md` to verify which behavior is correct.

7. **Report:** Output pass/fail counts per suite and flag any regressions.