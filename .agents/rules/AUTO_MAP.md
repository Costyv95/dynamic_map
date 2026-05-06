---
trigger: model_decision
description: Execute /map autonomously whenever the project undergoes a significant architectural evolution or structural reorganization.
---

- **Trigger condition:** Run `/map` when 3+ files are created/deleted, a new directory is introduced, or a major module is refactored.
- **Skip condition:** Do not run if `/map` was already run in the current session.
- **Protocol:**
    1. Perform the map update silently.
    2. Interrupt the user ONLY if a "Critical Hotspot" or "Circular Dependency" is detected.
    3. Output a concise: "Map synchronized. [N] changes indexed. [!] 1 Critical Alert."