# Architecture Decision Records (ADRs)

This document sequentially records the major technical and architectural decisions made in the Dynamic Map project.

---

## 001 Polymorphic Sensor Shortcut with Comparison Operators and Radial Progress Gauges
*   **Date:** 2026-05-29
*   **Status:** Accepted
*   **Context:** The Dynamic Map card lacked support for dedicated sensor objects displaying numerical measurements (e.g. temperature or humidity) with comfortable comfort range coloring, click-toggling between different active entities, and highly visual filled indicators on long press.
*   **Decision:** 
    - Designed and implemented a custom polymorphic `SensorShortcut` class rendering a premium pill-shaped SVG element that positions the matched comfort icon on the left and the real-time value text on the right.
    - Extended the global state override engine in `MapShortcut.js` to support numeric and range operators (`<`, `<=`, `>`, `>=`, `between`), ensuring backward compatibility across all shortcut types.
    - Integrated SVG circular progress rings inside `OverlayManager.js` using timed CSS `stroke-dashoffset` transitions to smoothly "fill in" the exact temperature and humidity side-by-side upon opening a glassmorphic dashboard overlay on long press.
*   **Consequences:** 
    - **Benefits:** Transforms the map card from a simple toggle board into a data-rich home automation dashboard. The new mathematical comparison operators are highly reusable for other integrations.
    - **Trade-offs:** Slightly increases shortcut configuration state schema size, which is successfully mitigated by automatically populating smart presets in the editor sidebar.

---

## 002 Editor Canvas Sensor Drawing & Raw JSON Parsing Robustness
*   **Date:** 2026-05-29
*   **Status:** Accepted
*   **Context:** Visual canvas updates did not occur for sensor shortcuts when configured via the editor, resulting in a fallback generic circle with a bulb icon. In addition, copying complete shortcut objects into the "Raw JSON" popup put key parameters inside the `config` property block instead of root shortcut keys, preventing proper polymorphic classification.
*   **Decision:**
    - Upgraded the canvas drawing loop (`CanvasEngine.js`) to support rounded pills (`roundRect`), and programmed a condition-parsing routine to guess and preview highly logical numerical values (midpoint, upper/lower bounds) inside the canvas pill.
    - Enhanced the editor JSON parser to natively accept both raw `config` blocks and complete root shortcut definitions, cleanly separating top-level variables.
*   **Consequences:**
    - **Benefits:** Dramatically improves editor visual preview accuracy, creating a WYSIWYG experience for sensor widgets. Maximizes raw JSON parsing utility and robustness.
    - **Trade-offs:** None. Preserves baseline Vitest coverage while expanding testing parameters.

