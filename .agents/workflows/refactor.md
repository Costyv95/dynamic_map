---
description: Performs a targeted or global refactor to improve code quality and alignment with the `HIGH_QUALITY.md` rule.
---

# /refactor [scope]

### Steps
1. **Scope Definition:** - If `[scope]` is `all`, scan the entire codebase.
   - If `[scope]` is a specific service or feature (e.g., `dispatcher`, `api`, `pulse`), focus only on related files.
   - If `[scope]` is empty, ask the user: "Which module or feature should I analyze for refactoring?"

2. **Structural Audit:** - Identify "Code Smells" (long functions, tight coupling, hard-coded magic numbers).
   - Check if the code violates the standards in `HIGH_QUALITY.md` (e.g., lack of modularity, magic numbers, tight coupling).

3. **Impact Analysis:** - Before changing code, list which files will be affected.
   - Verify that the refactor won't break existing API contracts, database schemas, or inter-service communication and it won't break the current tests.
   - If tests are needed before refactor, add them before.

4. **Execution (Atomic Commits):** - Apply changes in small, logical blocks. 
   - Use `MultiReplace` to ensure cross-file references (like shared types, API routes, or constants) are updated simultaneously.

5. **Post-Refactor Validation:** - Run the `/qa_check` workflow automatically.
   - If tests fail, revert the specific block and notify the user.

6. **Documentation Sync:** - Update any relevant entries in `docs/` to reflect the new structure.