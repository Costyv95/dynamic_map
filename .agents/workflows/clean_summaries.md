---
description: Consolidates session handoffs into permanent documentation and a single "Active Handoff" file to reduce project clutter.
---

# /clean_summaries
**Description:** Consolidates session handoffs into permanent documentation and a single "Active Handoff" file to reduce project clutter.

### Steps
1. **Inventory:** Scan the `docs/handoffs/` directory and read all existing `.md` files.
2. **Distillation (Permanent):**
    - Identify any completed architectural changes, core logic shifts, or finalized mechanics.
    - Append this information to the relevant files in `docs/`.
    - If a specific document doesn't exist for a feature, create it (e.g., `docs/features/movement_v1.md`).
3. **Consolidation (Temporary):**
    - Take all "Pending Tasks," "Known Bugs," and "Unfinished Ideas" from all handoffs.
    - Compile them into a single file, following `handoff_YYYY-MM-DD_HHMM.md` format.
4. **Archival (not deletion):**
    - **Always keep** the 3 most recent handoffs regardless of age.
    - Move handoffs **older than 7 days** to `docs/handoffs/archive/`.
    - Never permanently delete handoff files.
5. **Verification:**
    - Output a list of which permanent docs were updated, which handoffs were archived, and confirm that the directory is now clean.