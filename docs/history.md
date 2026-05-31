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

---

## 005 Generalized Declarative Shortcuts & Dual-Orientation Viewport Layouts
*   **Date:** 2026-05-31
*   **Status:** Proposed
*   **Context:**
    - Visual smart home shortcut elements currently rely on subclass overrides and hardcoded logic inside the frontend for specific domains (like symmetric speed calculations, vacuums, or progress ring gauges).
    - Hardcoded single percentage coordinates (`position: [X, Y]`) degrade visual alignment and aspect ratio fits when rotating screen viewports between vertical (portrait) and horizontal (landscape) modes.
*   **Decision:**
    - **Generalized Declarative Abstractions**: Proposed data-driven absolute vs. relative scaling (`scale_mode: "absolute" | "relative"`) utilizing inverse view transform multipliers, generic service and payload-templated actions, and modular progress gauges (`config.gauge`).
    - **Dual-Orientation Coordinate Maps**: Proposed orientation-specific coordinate objects (`position: { horizontal: [X,Y], vertical: [X,Y] }`) dynamically selected by the map's aspect ratios, combined with a WYSIWYG editor auto-write routing system to save edits to the active layout mode.
*   **Consequences:**
    - **Benefits:** Maximizes shortcut customizability without requiring Javascript alterations. Guarantees beautiful, pixel-perfect alignment on both landscape wall-mounted tablets and vertical mobile phone apps.
    - **Trade-offs:** Increases the data schema of the positioning coordinates, successfully abstracted by the Map Editor.

---

## 006 Scale Swapping Elimination and Uniform Resize Standardization
*   **Date:** 2026-05-31
*   **Status:** Accepted
*   **Context:** If `autoRotate` is true and the map rotates 90 degrees, the compositing engines in both `MapShortcut.js` and `CanvasEngine.js` swapped the `scaleX` and `scaleY` dimensions of the shortcuts. This aspect ratio swap counteracted the map's natural 90-degree rotation transform, preventing rectangular lines (like fairy lights or led strips) from visually rotating with the house and keeping them locked screen-horizontal. Additionally, resizing sensors or circular shapes in the editor only updated the specific dragged handle axis, causing `scaleY` and `scaleX` to drift and resulting in giant square sensors on the floorplan.
*   **Decision:**
    - Removed the scale swapping logic in both `MapShortcut.js` and `CanvasEngine.js`, allowing auto-rotated shortcuts to visually rotate naturally with the map.
    - Updated the Vitest suites (`StateOverrides.test.js` and `CanvasEngine.test.js`) to assert correct, unswapped visual dimensions and bounds.
    - Implemented uniform resizing inside `EditorInteractionManager.js` so that circular shapes and sensors maintain equal `scaleX` and `scaleY` dimensions when dragged along any handle.
*   **Consequences:**
    - **Benefits:** Ensures fairy lights and LED strips rotate seamlessly, matching the house alignment perfectly. Restores beautifully proportioned horizontal pill shapes for sensors, eliminating giant square glitches.
    - **Trade-offs:** Mismatched sensor coordinates from past editor sessions must be resized once in the editor to sync up, or loaded from a sanitized config.

---

## 007 Fairy Lights Vertical Scale-Swap Alignment & Outside Sensor Dimensions
*   **Date:** 2026-05-31
*   **Status:** Accepted
*   **Context:**
    - The Fairy Lights (`sc_1779223727173`) are defined horizontally wide (`scaleX = 7.7`, `scaleY = 1.49`) in the JSON configuration, but they reside on a portrait (vertical) balcony wall on the second floor.
    - This mismatch meant that in horizontal layouts (rotated map 90° clockwise), they rotated to vertical (becoming perpendicular to the horizontal screen wall), and in vertical layouts, they stayed horizontal (perpendicular to the vertical screen wall).
    - Furthermore, `CanvasEngine.js` rendered shortcut preview images as squares rather than scaling to the rectangular shortcut bounding box, and the Outside Temperature sensor had a tiny scale factor (`1.71` vs `3.99`).
*   **Decision:**
    - Swapped the scale parameters (`scaleX` and `scaleY`) of the Fairy Lights in the compiler so that they are drawn vertically relative to the unrotated portrait map, causing them to align perfectly with the balcony wall in both horizontal (rotated) and vertical (unrotated) views.
    - Standardized the Outside Temperature sensor scale to `3.99` to align its physical dimensions with the rest of the dashboard widgets.
    - Enhanced the `CanvasEngine.js` image preview renderer to scale to the full aspect ratio of rectangular shape shortcuts (`imgW` and `imgH` match `rx` and `ry` bounds), matching the live floorplan view exactly.
*   **Consequences:**
    - **Benefits:** Guaranteed perfect visual alignment of the fairy lights balcony widget on both tablets and mobile phones. Restored uniform, clean proportions to all temperature widgets.
    - **Trade-offs:** None. All 88 tests pass successfully.

---

## 008 Vacuum Toggle, Idle Fallback, Sensor Normalization & Module Cache-Busting
*   **Date:** 2026-05-31
*   **Status:** Accepted
*   **Context:**
    - In newer versions of Home Assistant, the custom service remapping from `vacuum.toggle` to `vacuum.start_pause` resulted in "Service vacuum.start_pause not found" errors, preventing proper click/tap control of vacuums.
    - Vacuums did not render any skins or images when in states like `idle` or `docked` because only `charging`, `cleaning`, and `error` states were explicitly configured, leading to blank or missing entities on the floorplan.
    - The bedroom sensor was oversized due to scale parameter drift (`4.33` vs. `3.98` standard scale).
    - Aggressive browser and Lovelace caching of static component JavaScript files caused deployed updates to be ignored by client browsers, which continued loading cached `v=2.74` ES modules.
*   **Decision:**
    - Removed the custom vacuum toggle-to-start_pause service remapping inside `MapShortcut.js` and `OverlayManager.js` to natively leverage standard `vacuum.toggle`, fully resolving newer HA version service compatibility.
    - Added a fourth catch-all "Idle" state using the inequality comparison operator (`!= unavailable`) to `shortcuts_floor2.json` for the Roborock vacuum, placed at the end of the state evaluation array so that it acts as a fallback skin when the vacuum is not charging, cleaning, or in error.
    - Unified and normalized the bedroom sensor `scaleX`/`scaleY`/`scale` configuration parameters in `shortcuts_floor2.json` to exactly `3.9815078588427864` to match the Living Room Sensor.
    - Systematic Version Bumping: Bumped the integration version in `manifest.json` to `3.0.3`, updated the custom panel editor query parameters in `__init__.py` to `?v=3.0.3`, and rewrote all 40 occurrences of the ES import cache-busting query strings (`?v=2.74` -> `?v=3.0.3`) across all card and editor files.
*   **Consequences:**
    - **Benefits:** Restores fully functional tap-to-toggle vacuum actions in newer HA instances. Guarantees beautiful Roborock image assets render on the map under all possible states. Restores perfect visual styling symmetry for all environment sensors. Forces immediate client browser cache invalidation for all ES modules, ensuring the new code is executed instantly.
    - **Trade-offs:** None.

---

## 009 Git-Based Automatic Cache-Busting, Native Vacuum SVGs, and Rotated Editor Handle Math
*   **Date:** 2026-05-31
*   **Status:** Accepted
*   **Context:**
    - Aggressive browser and Lovelace caching of static component JavaScript files required a fully automated, foolproof way to bust client caches upon code changes without requiring manual version bumps.
    - Vacuum cleaner shortcuts had no image assets on the HAOS filesystem, causing their states (charging, cleaning, error, and idle) to render blank or missing.
    - When the map was rotated, shortcuts configured with `autoRotate = false` correctly remained screen-horizontal, but the Map Editor’s canvas drew their background shapes rotated and did not rotate the drag handle hit-testing mouse vectors, causing visual glitches and preventing dragging/resizing from working.
*   **Decision:**
    - **Git-Based Auto-Versioning:** Implemented `scratch/auto_version.py` which dynamically calculates a cache-busting version string using the latest Git commit short hash and timestamp. If there are uncommitted files, it automatically appends the current system time to ensure every local testing deployment gets a unique cache-busting query parameter (`?v=3.0.3-<hash>-dev-<time>`). Integrated this call directly in `deploy.sh` so cache-busting is completely hands-free on every deploy.
    - **Native SVG Asset Bundling:** Designed and created a set of professional, high-quality, self-contained SVG vacuum status (`vacuum_charging.svg`, `vacuum_cleaning.svg`, `vacuum_error.svg`) and light status (`light_on.svg`, `light_off.svg`) icons inside `custom_components/dynamic_map/frontend/icons/`, making them native assets loaded directly via the `/dynamic_map_ui/icons/` static path.
    - **Rotated Editor Canvas Shapes:** Updated `CanvasEngine.js` to rotate the shortcut background shape and handles by `-90` degrees in the editor when the map is rotated and `autoRotate` is false.
    - **Rotated Handle Hit-Testing Vectors:** Added a +90 degree mouse coordinate transform vector in `EditorInteractionManager.js` during mouse hover testing, body hit-testing, and resize scaling to undo the map rotation, restoring flawless click-to-select and drag-to-resize support.
*   **Consequences:**
    - **Benefits:** Completely resolves all caching issues, making local developments visible in the browser instantly. Guarantees beautiful vacuum assets render out-of-the-box. Restores perfect WYSIWYG handle dragging symmetry in rotated map views.
    - **Trade-offs:** None.

---

## 010 Dynamic Multi-Layout Scales & Rotations, and Aspect Ratio Locking
*   **Date:** 2026-05-31
*   **Status:** Accepted
*   **Context:**
    - Visual resizing and custom rotations were written to flat properties in the JSON database, causing edits made in portrait mode to overwrite landscape values, and vice versa.
    - Drag resizing of shortcut circles could cause `scaleX` and `scaleY` to drift unproportionally if dragged along side handles or initialized with legacy rect scale offsets, leading to mismatched resize handle boxes and oval-shaped boundaries.
    - Visual settings for shortcut scales and custom rotations were completely hidden from the visual editor sidebar, forcing users to edit raw JSON to configure them.
    - Users lacked direct visual control to explicitly toggle proportional aspect ratio locking on or off.
*   **Decision:**
    - **Orientation-Aware Scaling & Custom Rotations**: Updated `EditorInteractionManager.js` to read and write scales (`scale`, `scaleX`, `scaleY`) and custom rotations (`rotation`) orientation-safely to layout-specific objects using refined helpers. Added 2D rotation matrix vector transforms to align resizing bounding boxes and select hit-testing with custom rotated axes.
    - **Dynamic Aspect Ratio Locking**: Added a **Lock Aspect Ratio (Proportional)** checkbox (`proportional`) inside the sidebar configuration forms (`editor.html` and `EditorUIManager.js`). When checked, it locks horizontal and vertical dimensions proportionally during drag resizing and manual updates, disabling and grey-shading the `Scale Y` input visually. When unchecked, it enables free-form independent scaling.
    - **Flexible Symmetrical Ellipses**: Standardized the system default to locked aspect ratio scaling for circles and free-form unproportional scaling for rectangles, pills, and sensors. Modified `renderCircle.js` and `CanvasEngine.js` to dynamically draw perfect, beautiful SVG `<ellipse>` tags and canvas ellipses if a circle's aspect ratio is unlocked and `Scale X` differs from `Scale Y`, eliminating visual mismatches.
*   **Consequences:**
    - **Benefits:** Restores fully independent size and rotation layouts across multiple orientations. Gives users complete aspect ratio locking flexibility for any shape, with intuitive visual cues. Gracefully handles unproportional scaling of circles by automatically upgrading them to ellipses.
    - **Trade-offs:** None. All 88 tests pass successfully.
