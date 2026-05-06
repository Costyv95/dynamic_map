---
description: Scans the project for dead files, stale artifacts, and cleanup opportunities.
---

# /tidy [scope]

### Steps
1. **Scope resolution:**
   - `all` (default): Full project scan
   - `[path]`: Targeted scan of a specific directory

2. **Dead File Scan:**
   - Identify files that are no longer imported, referenced, or used by any other file.
   - Check for orphaned test files testing deleted modules.
   - Check for stale logs, temp files, or build artifacts in `services/`, `packages/`, `apps/`.

3. **Gitignore Audit:**
   - Look for file types or directories that should be in `.gitignore` but aren't:
     - `node_modules/`, `__pycache__/`, `*.pyc`, `.DS_Store`
     - Build outputs (`dist/`, `build/`, `.next/`)
     - Environment files (`.env.local`, `.env.production`)
     - IDE files (`.idea/`, `.vscode/settings.json`)
   - Propose additions to `.gitignore` if gaps are found.

4. **Documentation Staleness:**
   - Check `docs/` for files referencing deleted code, renamed modules, or outdated file paths.
   - Verify all file links in markdown docs still resolve.

5. **Quick Wins (fix immediately):**
   - Delete confirmed dead files (with user confirmation).
   - Add missing `.gitignore` entries.
   - Remove empty or placeholder files.

6. **Bigger Issues → Maintenance Log:**
   - If anything larger is discovered (e.g., modules needing refactor, significant doc rewrites, architectural debt), append it to `docs/maintenance.md` instead of fixing it inline.
   - Each entry in `docs/maintenance.md` should include: date discovered, file(s) affected, description, and suggested action.

7. **Report:**
   - Output: files deleted, `.gitignore` changes, and count of new items added to `docs/maintenance.md`.
