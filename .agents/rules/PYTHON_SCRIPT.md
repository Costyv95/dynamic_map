---
trigger: always_on
---

# Script Execution & Environment Standards

## Python (Agentic Services)
All Python scripts MUST be executed via the project's virtual environment:

```bash
PYTHONUNBUFFERED=1 python [SCRIPT_PATH] [ARGS]
```

## Test Execution (Python)
For running pytest-based test suites:

```bash
PYTHONUNBUFFERED=1 python -m pytest [TEST_PATH] -v --tb=short
```

## Node.js / TypeScript (Order & Menu Service)
Run via pnpm from the monorepo root:

```bash
pnpm --filter [PACKAGE_NAME] run [SCRIPT]
```

## Go (Dispatcher)
Run from the service directory:

```bash
go run ./services/dispatcher/...
go test ./services/dispatcher/... -v
```

DO NOT ADD 2>&1 at the end of the commands