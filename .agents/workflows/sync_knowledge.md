---
description: Sync Knowledge Base
---

# /sync_knowledge

## Steps
1. **Audit Codebase:** Scan `fair/` for core architectural patterns or important project-specific knowledge.
2. **Review Documentation:** Read `docs/` and understand the current context.
3. **Past Knowledge:** Go through all current **Knowledge Items** (KIs) by listing `~/.gemini/antigravity/knowledge/` and reading each `metadata.json`.
4. **Extract Insights:** Identify "non-obvious" engineering decisions that a new agent would need. Focus on:
   - System boundaries (e.g., which code runs in Node.js vs Go vs Python)
   - Business constraints (e.g., CHF 10M profit cap, rider wage floor, commission rates)
   - Integration gotchas (e.g., TWINT payment flow, Stripe webhook handling, S2 Geometry cell sizing)
   - Cross-service dependencies (e.g., order service ↔ dispatcher ↔ Redis Pulse windows)
5. **Check for Duplicates:** Before creating a new KI, verify no existing KI already covers the topic. Prefer updating an existing KI over creating a new one.
6. **Generate/Update KIs:** Create or update Knowledge Items for each major system. Each KI artifact should include:
   - **Summary**: 2-3 sentence overview of the knowledge
   - **Key Details**: Concrete technical facts, file paths, constants
   - **References**: ADR numbers, file paths, conversation IDs
7. **Prune Stale KIs:** Remove or update any KI that describes behavior no longer present in the codebase.