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

---

## 003 Native Sensor Long-Press & Custom Resize Handle Calibration
*   **Date:** 2026-05-29
*   **Status:** Accepted
*   **Context:** Newly configured sensor shortcuts lacked custom actions inside `this.config.actions` by default, causing the overlay trigger in `onLongPress` to early-return and prevent the glassmorphic radial comfort overlay from opening. Additionally, the visual pill width `rx = 26` was hardcoded inside `CanvasEngine.js` but `EditorInteractionManager.js` hardcoded `rx = 12` during hit-testing, causing the top/bottom and corner resize handle mouse intercepts to fail completely.
*   **Decision:**
    - Modified `MapShortcut.js` to natively intercept and call `showOverlay` on long presses if `sc.type === 'sensor'`, ignoring the presence of custom action arrays.
    - Updated `EditorInteractionManager.js` to dynamically compute shortcut dimensions (`rx = 26`, `ry = 12`) when `sc.type === 'sensor'` and treat its interactive hover shape as a `'rect'`, syncing the mouse hit-boxes perfectly with the visual handle squares. Added aligned divisors so scaling is proportional to dragging speed.
*   **Consequences:**
    - **Benefits:** Restores immediate, out-of-the-box long-press menu rendering for sensors. Aligns visual draw scales with mouse tracking grids for a seamless, pixel-perfect WYSIWYG dragging/resizing experience.
    - **Trade-offs:** None. Preserves green Vitest test standards.

---

## 004 Generic Multi-Condition UI Sidebar Editor & Decoupled Data-Driven Sensor Tapping
*   **Date:** 2026-05-29
*   **Status:** Accepted
*   **Context:** State conditions were hidden behind the editor UI sidebar (only supporting single static top-level entity/operator/value inputs), hiding nested or complex multi-condition logic (like temperature/humidity comfort intervals). In addition, tapping a sensor pill hardcoded click-to-toggle logic in JS instead of behaving as a decoupled, standard, data-driven custom action inside `config.actions`.
*   **Decision:**
    - Replaced the single condition input fields in `ShortcutConfigUI.js` with a generic, dynamic nested **"Conditions"** list section, allowing adding (`+ Add Condition`) and deleting (`X`) multiple conditions visually.
    - Synchronized the first item inside `st.conditions` to the top-level keys (`st.state_entity`, `st.operator`, `st.value`) to preserve Lovelace backward-compatibility.
    - Added support for `"SENSOR_OVERLAY"` as a standard visual action in the select dropdown and the sidebar, pre-populating both the helper boolean `"TOGGLE"` action on tap and the `"SENSOR_OVERLAY"` action on hold out-of-the-box when a shortcut is switched to type sensor.
    - Reverted the hardcoded `onClick(e)` override inside `SensorShortcut.js` to rely entirely on standard, generic data-driven click actions.
*   **Consequences:**
    - **Benefits:** Maximizes visual editor transparency, making multi-condition logic fully visual and editable. Cleanly decouples shortcut click behaviors.
    - **Trade-offs:** Requires cache-busting version bumps inside backend Python panel configurations (`__init__.py`) to bypass aggressive Home Assistant panel caching.



