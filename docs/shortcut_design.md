# Dynamic Map Shortcut Architecture

## Overview
The shortcut system (objects placed on the map) is being refactored to support a scalable, object-oriented design. This allows the integration of diverse smart home devices (Lights, Vacuums, TVs, Curtains) with unique rendering rules and interactive behaviors, without cluttering the core rendering engine.

## 1. Data Schema (JSON)
Shortcuts are stored in `shortcuts_floorX.json`. The schema strictly separates standard map-placement properties from type-specific logic via a `config` object.

```json
{
  "id": "sc_123456",
  "name": "Living Room TV",
  "type": "tv",               // Resolves to TVShortcut class
  "entity_id": "media_player.living_room_tv",
  "parent": "room_789",       // Optional reference to a room or floor context
  "position": [45.5, 60.2],   // Percentage coordinates [X, Y]
  "scaleX": 1.0,
  "scaleY": 1.0,
  "rotation": 0,
  "config": {
    // Type-specific properties. Extensible per class.
    "shape": "rect",
    "color": "#000000",
    "transparent": false,
    "room_mapping": {}        // E.g., for vacuums
  }
}
```

## 2. Rendering Engine (`custom-svg-map.js`)
The Home Assistant card UI uses a **Polymorphic Factory Pattern**.

*   `MapShortcut` (Base Class): Handles coordinate translation, SVG group (`<g>`) generation, affine transformations (scaling/rotation), and core click-event delegation.
*   `ShortcutFactory`: Reads the JSON `type` field and instantiates the correct subclass.
*   **Subclasses**:
    *   `LightShortcut`: Draws a bulb icon. Binds to HA state to show glowing `drop-shadows` when `state === 'on'`.
    *   `CurtainShortcut`: Draws a dynamic window cover. Contains separate left/right hitboxes.
    *   `VacuumShortcut`: Handles live path-tracking and zone-cleaning logic.

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
