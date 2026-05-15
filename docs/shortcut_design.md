# Dynamic Map Shortcut Architecture

## Overview
The shortcut system (objects placed on the map) is being refactored to support a scalable, object-oriented design. This allows the integration of diverse smart home devices (Lights, Vacuums, TVs, Curtains) with unique rendering rules and interactive behaviors, without cluttering the core rendering engine.

## 1. Data Schema (JSON)
Shortcuts are stored in `shortcuts_floorX.json`. The schema strictly separates standard map-placement properties from type-specific logic via a `config` object.

```json
{
  "id": "sc_123456",
  "name": "Living Room TV",
  "type": "tv",
  "entity_id": "media_player.living_room_tv",
  "parent": "room_789",
  "position": [45.5, 60.2],
  "scaleX": 1.0,
  "scaleY": 1.0,
  "config": {
    "shape": "rect",
    "color": "#000000",
    "transparent": false,
    "menuWidth": 250,
    "menuHeight": 300,
    "room_mapping": {},
    "actions": [
      {
        "id": "act_1",
        "type": "TOGGLE_ON", // TOGGLE_ON, TOGGLE_OFF, TOGGLE, CALL_SERVICE, SLIDER
        "action_entity": "media_player.living_room_tv",
        "service": "",       // Used if type == CALL_SERVICE
        "trigger": "tap",    // tap, overlay, double_tap
        "icon": "mdi:power",
        "name": "Turn On",
        "_expanded": false
      }
    ],
    "states": [
      {
        "id": "st_1",
        "state_entity": "media_player.living_room_tv",
        "operator": "==", // ==, !=, in, not_in
        "value": "playing",
        "icon": "mdi:music",
        "color": "#10b981",
        "animation": "pulse",
        "_expanded": false
      }
    ]
  }
}
```

## 2. Rendering Engine (`custom-svg-map.js`)
The Home Assistant card UI uses a **Polymorphic Factory Pattern**.

*   `MapShortcut` (Base Class): Handles coordinate translation, SVG group (`<g>`) generation, affine transformations (scaling/rotation), and core click-event delegation. It structurally separates the background shape from the foreground icon so they can rotate independently.
*   `ShortcutFactory`: Reads the JSON `type` field and instantiates the correct subclass.
*   **Subclasses**:
    *   `GenericShortcut`: General-purpose shortcuts (Buttons, Toggles). Supports rendering native Home Assistant `<ha-icon>` components inside SVG boundaries via `<foreignObject>`.
    *   `VacuumShortcut`: Handles live path-tracking and zone-cleaning logic.
    *   `LightShortcut`: Legacy minimal extension for specialized light shadow bindings.

### Interaction Model
Events are delegated through the base class:
1.  **Tap / Short Click (`onClick`)**: Executes the primary action (e.g., toggle).
2.  **Long Press (`onLongPress`)**: Opens the **Action Overlay** (a floating HTML menu over the map) for complex controls like brightness sliders or vacuum target selection.
3.  **Hitbox Clicks**: Subclasses can define localized click handlers on specific SVG paths (e.g., clicking the "left" side of a curtain to open).

## 3. Map Editor (`editor.html`)
The administration interface provides a generic sidebar for standard properties (Name, Entity, Parent) and dynamically mounts a configuration panel based on the selected `Type`. Legacy flat properties (`sc.color`, `sc.shape`) are automatically migrated into the `config` object at load time.

## Benefits
1.  **Safety**: Recomputing the floorplan (SVG/DXF) never overwrites shortcut files.
2.  **Extensibility**: Adding a new device type requires only a single new class definition file, zero changes to the core drawing loop.
3.  **UX**: Objects are absolute-positioned, entirely independent of room boundaries, allowing fluid customization.
