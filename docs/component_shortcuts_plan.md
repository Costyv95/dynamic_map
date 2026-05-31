# Dynamic Map: Component-Based Shortcuts & Nested Logic Plan

This document details the complete system architecture, data schemas, UI mockups, and exhaustive testing specifications for refactoring the map card into a **Component-Based Dynamic UI Architecture** with a **Nested Visual Query Builder**.

---

## 🎯 1. Technical Goals & Overview

1. **Composition Over Inheritance**: Replace monolithic shortcut classes with a single generic compositor (`MapShortcut.js`) that renders dynamic lists of modular UI primitives (`circle`, `rect`, `pill`, `icon`, `image`, `text`, `progress_ring`, `room_selector`).
2. **State-Driven Layout Morphing**: Allow shortcut layouts to fully swap, resize, or morph when entity state rules are matched (e.g., swapping to custom PNG light images or displaying live gauge bars).
3. **Composite Logic Operators (AND/OR)**: Support complex logical rule gates nested to any depth, represented transparently in both JSON and a visual query editor.
4. **Orientation-Aware Layouts**: Provide separate, manual coordinates for landscape (`horizontal`) and portrait (`vertical`) modes, integrated into a drag-and-drop WYSIWYG editor.
5. **Zero Hidden Logic**: Every action, state override, and logical group must be visual, editable, and testable.

---

## 📐 2. The Unified JSON Schema Specification

Every shortcut on your map will share this single, highly extensible data schema:

```json
{
  "id": "sc_bedroom_light",
  "name": "Bed Lamp",
  "parent": "room_bedroom",
  "scale_mode": "absolute",
  "position": {
    "horizontal": [25.4, 42.1],
    "vertical": [30.1, 40.5]
  },
  "config": {
    "menuWidth": 200,
    "menuHeight": 250,
    "default_layout": [
      {
        "id": "lamp_avatar",
        "type": "image",
        "value": "/local/icons/lamp-off.png",
        "width": 30,
        "height": 30
      }
    ],
    "states": [
      {
        "id": "st_on",
        "name": "Light On",
        "conditions": {
          "type": "AND",
          "rules": [
            { "state_entity": "light.bedroom_light", "operator": "==", "value": "on" }
          ]
        },
        "layout_override": [
          {
            "id": "lamp_avatar",
            "type": "image",
            "value": "/local/icons/lamp-on.png",
            "width": 30,
            "height": 30
          }
        ]
      }
    ],
    "actions": [
      {
        "trigger": "tap",
        "type": "TOGGLE",
        "action_entity": "light.bedroom_light"
      },
      {
        "trigger": "long_press",
        "type": "OVERLAY",
        "layout": [
          {
            "id": "brightness_control",
            "type": "slider",
            "entity": "light.bedroom_light",
            "min": 1,
            "max": 100
          }
        ]
      }
    ]
  }
}
```

---

## 🎨 3. Primitives & Compositor Architecture

The new compositor maps primitives directly to clean SVG elements inside the group container:

| UI Primitive | Target SVG Node | Primary Attributes |
| :--- | :--- | :--- |
| `circle` | `<circle>` | `cx`, `cy`, `r`, `fill`, `stroke` |
| `rect` / `pill` | `<rect>` | `x`, `y`, `width`, `height`, `rx`, `ry`, `fill` |
| `icon` | `<foreignObject>` + `<ha-icon>` | `width`, `height`, `icon`, `color` |
| `image` | `<image>` | `x`, `y`, `width`, `height`, `href` (supports PNG/SVG) |
| `text` | `<text>` | `x`, `y`, `text-anchor`, `dominant-baseline`, dynamic Jinja string evaluation |
| `progress_ring` | Dual `<circle>` paths | `r`, `stroke-dasharray`, `stroke-dashoffset` |
| `room_selector` | `<g>` mapping | `room_mapping` outline highlighted on user hover/select |

---

## 🔬 4. Comprehensive Testing & Verification Plan

To ensure your entire house configuration operates flawlessly, we will build a dedicated Vitest test suite (`MapShortcut.test.js`) asserting every functional permutation.

### Test Suite A: The Desk Lamp (Dynamic Image Swapping)
* **Goal**: Verify that changing entity state swaps the image asset instantly.
* **Test Case**:
  1. Instantiate a shortcut using the `sc_desk_lamp` JSON.
  2. Feed `light.desk_lamp: "off"` to the state engine. Assert that the rendered DOM contains exactly one `<image>` element with `href="/local/icons/lamp-off.png"`.
  3. Call `updateState` with `light.desk_lamp: "on"`.
  4. Assert that the DOM immediately morphs to contain exactly one `<image>` element with `href="/local/icons/lamp-on.png"`.

### Test Suite B: The Roborock (Complex Actions & Room Selection)
* **Goal**: Verify status color updates, dock commands, and composite room cleaning segment payloads.
* **Test Case**:
  1. Feed `sensor.roborock_status: "cleaning"` to the state engine. Assert that the backing shape updates to color `#0ea5e9` and imports `/icons/vacuum_cleaning.svg`.
  2. Trigger `long_press` on the group. Assert that the floating action menu displays a button with text "Return to Dock" and an interactive segment selection container.
  3. Select **Kitchen** and **Office** on the segment selector.
  4. Click "Clean Custom Rooms".
  5. Assert that the Home Assistant WebSocket API receives a `vacuum.send_command` call with the exact segment clean parameters:
     ```json
     {
       "command": "app_segment_clean",
       "params": [{"segments": [20, 18], "repeat": 1}]
     }
     ```

### Test Suite C: Composite Logic Gates (AND/OR Scoping)
* **Goal**: Verify that complex combinations of logical AND/OR evaluations behave perfectly under all permutations.
* **Logical Condition**:
  ```text
  IF Room Temperature > 25 
  AND (Diana Phone == Charging OR Costin Phone == Charging)
  THEN display st_hot layout.
  ```
* **Permutations Asserted**:

| Temp | Diana Charging | Costin Charging | Expected Match |
| :---: | :---: | :---: | :---: |
| `24` | `true` | `true` | **`false`** (Temp too low) |
| `26` | `false` | `false` | **`false`** (No phones charging) |
| `26` | `true` | `false` | **`true`** (Temp OK + Diana charging) |
| `26` | `false` | `true` | **`true`** (Temp OK + Costin charging) |
| `26` | `true` | `true` | **`true`** (Temp OK + Both charging) |

### Test Suite D: Absolute Scale Constraining
* **Goal**: Verify that shortcuts with `scale_mode: "absolute"` stay standard size on zooming.
* **Test Case**:
  1. Set map scale factor to `4.0` (400% zoom).
  2. Assert that the shortcut's main outer positioning group receives `translate(...)`.
  3. Assert that the inner icon group receives an exact inverse scale transform `scale(0.25)` to offset the zoom, keeping the visual footprint perfectly standard.

### Test Suite E: Dual-Orientation Layout Positioning
* **Goal**: Verify portrait vs. landscape switching.
* **Test Case**:
  1. Set canvas active orientation to `horizontal`. Assert the shortcut coordinates are rendered at `[25.4, 42.1]`.
  2. Change canvas active orientation to `vertical`. Assert the compositor immediately moves the element to `[30.1, 40.5]`.

---

## 📝 5. Implementation Roadmap & Steps

### Phase 1: Engine and Compositor Updates
- [ ] Add `position: { horizontal: [], vertical: [] }` coordinate resolution inside `CanvasEngine.js` and `MapShortcut.js`.
- [ ] Implement the `inverseScale` calculations in the drawing loop for `scale_mode: "absolute"`.
- [ ] Refactor `MapShortcut.js` to dynamically draw elements from the matching layout array (replacing static shapes).
- [ ] Write the nested logic evaluator in `MapShortcut.js` supporting recursive evaluations of `AND`/`OR` composite groups.

### Phase 2: Action Overlay Refactoring
- [ ] Update `OverlayManager.js` to evaluate declarative actions and populate sliders and room selectors based on the generic service parameters.

### Phase 3: Visual Sidebar Editor Upgrades
- [ ] Implement the Nested Visual Query Builder card layout inside `ShortcutConfigUI.js`.
- [ ] Add the manual orientation switcher button in the visual editor header, causing `CanvasEngine` to dynamically update its bounds.
- [ ] Configure `EditorInteractionManager.js` dragging listeners to write coordinates exclusively to the active orientation key in the database JSON.
