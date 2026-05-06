---
description: Audits the current codebase against the documentation and synchronizes them to ensure the "Source of Truth" is accurate.
---

# /align_docs

### Steps
1. **Source Audit:** Scan the `/docs/` directory to identify established technical specifications (e.g., API contracts, data model, fee calculation logic, Pulse batching algorithm).
2. **Code Comparison:** Read the relevant source files and compare the current implementation with the documented intent.
3. **Identify Discrepancies:** Note any "Drift" where:
    - The code does something not documented.
    - The docs describe a feature that was refactored or removed.
    - API endpoints, database schemas, or business constants have changed.
4. **Prioritize Discrepancies:**
    - 🔴 **Critical:** API contracts, database schema, fee calculation logic, payment integration (code-breaking if wrong)
    - 🟡 **Moderate:** CLI flags, config defaults, environment variables, deployment topology
    - 🟢 **Low:** Formatting, prose accuracy, stale comments
5. **Draft Alignment Artifact:** Create an internal **Alignment Report** showing the proposed changes to the docs, ordered by priority.
6. **Execute Sync:** Upon approval, update the `.md` files in `/docs/` to reflect the "As-Built" state of the platform.
7. **Final Report:** Provide a summary of the alignment, highlighting any major logic shifts that occurred during development.