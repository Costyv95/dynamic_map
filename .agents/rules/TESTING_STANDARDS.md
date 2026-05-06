---
trigger: always_on
---

# Core Development Protocol: Feature Validation

1. **Assertion-Based Development:** For every new feature or logic change, the Agent MUST write a test script that asserts the expected outcome (e.g., "Player velocity should be X when Input is Y").
2. **Pre-Flight Check:** The Agent is forbidden from declaring a task "Done" until all relevant automated tests pass.
3. **Evidence of Work:** After a feature is added, the Agent must provide a brief "Validation Log" showing:
    - Input provided to the system.
    - Expected output/behavior.
    - Actual output/behavior confirmed by the test.