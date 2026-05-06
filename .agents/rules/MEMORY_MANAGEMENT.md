# Memory Management Rules

## Architecture Decision Records (ADRs)
- **Self-Documentation:** After finalizing any code change or Implementation Plan, automatically summarize the technical decision as a new ADR entry.
- **History File:** ADRs are stored in `docs/history.md`, numbered sequentially.
- **Format:** Each ADR follows the standard format: `## [NNN] Title`, `Date`, `Status`, `Context`, `Decision`, `Consequences`.
- **Numbering:** Sequential starting from 001.
- **Scope:** ADRs cover decisions across all FairEat services — client (React Native/Next.js), order service (Node.js), dispatcher (Go), and agentic services (Python).