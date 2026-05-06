---
description: Generates a high-level technical handoff for the next session or agent.
---

# /summarize

### Steps
1. **Analyze Current State:** Review all files modified in the current session and all the tasks that have been done. Use files from `docs/handoffs` directory for previous information in order to better understand what has been done.
2. **Draft the Handoff:** Create a new file in `docs/handoffs/` named `handoff_YYYY-MM-DD_HHMM.md`.
2. DO NOT DELETE ANY PREVIOUS HANDOFFS
3. **Structure the Content:** The file must include:
    - **Current Objective:** What was the primary goal of this session?
    - **Changes Made:** List all files modified and why.
    - **Blocked/Pending Tasks:** What was left unfinished (if any)?.
    - **Architectural Shift:** Did we change any logic defined in `docs/technical_design.md` or the `HIGH_QUALITY.md` rule?
4. **Commit and Push** Commit and Push all changes (including the handoff)
5. **Notify:** Output a summary of the handoff to the chat and confirm the file location.