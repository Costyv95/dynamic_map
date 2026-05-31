# Dynamic Map: Component-Based Shortcuts & Nested Logic Plan

This document details the complete system architecture, data schemas, UI mockups, and exhaustive testing specifications for refactoring the map card into a **Component-Based Dynamic UI Architecture** with a **Nested Visual Query Builder**.

---

## 🏛️ 1. Modular, Subclass-Free Directory Structure (DRY & KISS)

To achieve maximum elegance, eliminate repeated blocks of code, and split logic into small, single-responsibility modules, we are **deleting all legacy device-specific subclasses entirely**:
* **[DELETE]** `SensorShortcut.js`
* **[DELETE]** `VacuumShortcut.js`
* **[DELETE]** `LightShortcut.js`

We will split the frontend shortcut subsystem into a clean, highly modular **directory structure**:

```text
custom_components/dynamic_map/frontend/
├── shortcuts/
│   ├── MapShortcut.js             # Generic Compositor (Orchestration & Events only)
│   ├── ComponentRegistry.js       # Mapping entry point for primitives
│   ├── ConditionEvaluator.js      # Isolated nested AND/OR logic rules evaluator
│   └── components/                # Micro-extendable rendering modules
│       ├── renderShape.js         # Draws circular, rectangular, & pill shapes
│       ├── renderIcon.js          # Draws SVG-based <foreignObject> icons
│       ├── renderImage.js         # Draws static and dynamic PNG/SVG images
│       ├── renderText.js          # Handles dynamic Jinja templated text strings
│       ├── renderGauge.js         # Draws progress rings & radial gauges
│       └── renderSelector.js      # Draws custom vacuum room outlines
└── card/
    ├── OverlayManager.js          # Overlay entry-point manager
    └── overlays/                  # Specialized overlay widgets
        ├── SliderOverlay.js       # Clean, isolated slider popups
        └── RoomPickerOverlay.js   # Clean, isolated room selectors
```

### A. The Compositor: `MapShortcut.js` [REFACTOR]
`MapShortcut.js` is now a slim orchestrator (less than 100 lines) with **zero rendering code**:
1. **Coordinate Translations**: Translates position maps relative to active horizontal/vertical aspect ratios.
2. **Pointer Listeners**: Binds a single, shared interaction module for tap, double tap, hover, and long press events.
3. **Loop Compositing**: Resolves the layout based on `ConditionEvaluator.js`, queries `ComponentRegistry.js` to fetch individual element nodes, and appends them to the canvas.

### B. The Logical Core: `ConditionEvaluator.js` [NEW]
A standalone, 100% self-contained module dedicated purely to evaluating recursive composite logic (`AND`/`OR` rules groups). Because it has **zero DOM dependencies**, it is trivially easy to write exhaustive unit tests for.

### C. The Micro-Renderers: `components/` [NEW]
Every visual primitive is housed in its own dedicated, single-responsibility file:
* **`renderShape.js`**: Handles `<circle>` and `<rect>` creations.
* **`renderText.js`**: Resolves Home Assistant states inside strings (e.g. `{{ states(T) }}°`) and injects SVG `<text>` elements.
* **`renderGauge.js`**: Renders smooth circular dashboards with SVG `stroke-dashoffset` timers.

---

## 🧬 2. Complex Conditions: Composite AND / OR Logic

To handle advanced rules (e.g. *if time is after 11 PM AND phone is charging OR bed lights are on*), we adopt the standard **Composite Query Design Pattern**. 

### A. The Data Schema
Instead of flat list arrays, `conditions` supports **Logical Groups** that can house both leaf comparisons and nested subgroups:

```json
"conditions": {
  "type": "AND",
  "rules": [
    {
      "type": "OR",
      "rules": [
        { "state_entity": "sensor.diana_phone", "operator": "==", "value": "charging" },
        { "state_entity": "sensor.costin_phone", "operator": "==", "value": "charging" }
      ]
    },
    { "state_entity": "sensor.time", "operator": ">", "value": "23:00" }
  ]
}
```

* **Backwards Compatibility**: If a legacy flat array is found (e.g. `[ { cond1 }, { cond2 } ]`), the parser automatically wraps it in an implicit `AND` group `{ type: "AND", rules: [...] }`, ensuring all older shortcuts continue to function flawlessly.

---

## 🎨 3. Visual Sidebar Query Builder (Zero Hidden Logic)

To ensure there is **absolutely zero hidden logic**, we will build a **Nested Visual Query Builder** directly inside the Map Editor sidebar:

```text
+--------------------------------------------------+
| Conditions Accordion                             |
|                                                  |
|  +--------------------------------------------+  |
|  | GROUP: [ MATCH ALL (AND) ] [ MATCH ANY (OR)]|  |
|  |                                            |  |
|  |  [sensor.temperature] [between] [20-25] [X]|  |
|  |                                            |  |
|  |  +--------------------------------------+  |  |
|  |  | GROUP: [ MATCH ALL ] [ MATCH ANY (OR)]|  |  |
|  |  |                                      |  |  |
|  |  | [sensor.diana_phone] [==] [charging][X] |  |  |
|  |  | [sensor.costin_phone][==] [charging][X] |  |  |
|  |  |                                      |  |  |
|  |  | [+ Add Rule] [+ Add Group]           |  |  |
|  |  +--------------------------------------+  |  |
|  |                                            |  |
|  |  [+ Add Rule] [+ Add Group]                |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

### Key UI Features:
1. **Scope Cards**: Every logical group is rendered as a clean, rounded container card with a subtle background tint and left indent borders, representing the scope visually.
2. **Boolean Toggle**: A clean button-group at the top of each card switches the logical operator between `AND` (all rules must match) and `OR` (any rule can match).
3. **Dynamic Controls**:
   * **`+ Add Rule`**: Appends a standard comparison row inside the selected group scope.
   * **`+ Add Group`**: Appends a nested subgroup card inside the selected group scope.
   * **`[X]` (Delete)**: Removes a single rule or an entire group card instantly.
4. **Real-time Live Sync**: Typing or changing dropdown values updates the parent state in real time and automatically re-renders the map preview.

---

## 🗺️ 4. Positioning & Dual-Orientation Viewport Layouts

To support perfect alignment on both landscape desktop displays/tablets and vertical phone screens, we fully implement the dual-layout coordinate map.

### Feature A: Orientation-Aware Coordinates
Shortcuts will hold orientation-specific coordinate objects in the database JSON:
```json
"position": {
  "horizontal": [25.4, 42.1],
  "vertical": [30.1, 40.5]
}
```
* **Dynamic Placement**: During viewport calculation, `CanvasEngine` determines if the screen is in portrait (`'vertical'`) or landscape (`'horizontal'`) mode and loads the corresponding positioning coordinate.

### Feature B: Map Editor Toggle & WYSIWYG Auto-Routing
We will implement key enhancements in the visual map editor:
1. **Manual Orientation Preview**: We will add a gorgeous vertical/horizontal layout toggle button in the visual editor header. Clicking it immediately rotates and updates the canvas aspect ratio.
2. **Dragging Auto-Route**: When a user drags a shortcut, the editor detects which preview mode is currently active (`horizontal` or `vertical`) and **writes the coordinates exclusively to that orientation key in the JSON**, keeping your other layout perfectly intact.
