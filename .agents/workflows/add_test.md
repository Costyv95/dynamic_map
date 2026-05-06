---
description: Audits the codebase for missing test coverage and implements functional tests to ensure technical integrity.
---

/add_test [scope]

1. Risk-Based Audit

Global (all): Scan the codebase for "High-Entropy" modules. Prioritize files with high Cyclomatic Complexity or those that have frequent "churn" (many recent edits) but low test coverage.
Targeted ([path/feature]): Isolate the logic. Identify every branch, loop, and external dependency within the scope.
Heuristic (empty): Default to the "Rule of Three": Identify the three most complex functions or classes that currently operate without a safety net.

2. Vulnerability Mapping

Instead of just looking at transitions, analyze the logic for these Failure Patterns:
Mathematical Fragility: Check for potential division-by-zero, floating-point precision issues, or out-of-bounds array indexing.
Side-Effect Analysis: Identify if the logic modifies global state, singletons, or external files. These require strict "Before/After" assertions.
Input Permutations: Determine the "Happy Path" vs. "The Chaos Path." What happens if inputs are null, NaN, empty, or extreme values?
Dependency Reliability: Identify where the logic relies on external systems (e.g., database, Redis, third-party APIs like Stripe/TWINT).


3. Implementation (The "Bulletproof" Standard)

Isolation: Ensure the test is decoupled. Use Mocks/Stubs for any logic outside the immediate scope to prevent "Test Pollution."
AAA Pattern: Strictly follow Arrange (set the scene), Act (execute the logic), and Assert (verify the outcome).
Invariant Verification: Ensure that certain "Universal Truths" remain true regardless of the input (e.g., "Delivery fee must always be >= CHF 4.00").


4. Discrepancy & Source-of-Truth Check

Run the test. If it fails, do not assume the test is wrong or the code is wrong.
Resolution Protocol:"Logic Discrepancy: 
The unit test failed.
Expected: [Value/Behavior based on logic analysis]
Actual: [Current code output]Should I refactor the code to fix the bug, or update the test to reflect a newly intended behavior?"


5. Seamless Integration

Append the test to the relevant test suite or central runner.
Ensure the test is tagged appropriately (e.g., #unit, #integration, #slow) so it can be filtered in CI/CD pipelines.

6. Runner Selection

   - **TypeScript/Node.js** → `vitest` or `jest` (add to `services/api/__tests__/` or `packages/*/test/`)
   - **Go** → `go test` (add to `services/dispatcher/*_test.go`)
   - **Python** → `pytest` (add to `services/agents/tests/`)