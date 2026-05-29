# Dynamic Map Shortcut Architecture

## Overview
The shortcut system (objects placed on the map) is being refactored to support a scalable, object-oriented design. This allows the integration of diverse smart home devices (Lights, Vacuums, TVs, Curtains) with unique rendering rules and interactive behaviors, without cluttering the core rendering engine.

## 1. Data Schema (JSON)
Shortcuts are stored in `shortcuts_floorX.json`. The schema strictly separates standard map-placement properties from type-specific logic via a `config` object.

```json
{
  "id": "sc_1",
  "type": "sensor",         // generic, light, vacuum, sensor
  "entity_id": "input_boolean.sensor_bedroom",
  "position": [25.4, 42.1], // Percentage coordinate on canvas
  "scaleX": 1.2,
  "scaleY": 1.2,
  "parent": "room_bedroom", // Aligns coordinate system (global/local)
  "config": {
    "transparent": false,
    "color": "#0ea5e9",
    "icon": "🌡️",
    "temperature_entity": "sensor.somneo_temperature",
    "humidity_entity": "sensor.somneo_humidity",
    "actions": [
      {
        "type": "TOGGLE",
        "trigger": "tap",
        "action_entity": "input_boolean.sensor_bedroom"
      },
      {
        "type": "SENSOR_OVERLAY",
        "trigger": "long_press"
      }
    ],
    "states": [
      {
        "id": "st_temp_cold",
        "name": "Cold Temp",
        "display_entity": "sensor.somneo_temperature",
        "unit": "°",
        "color": "#3b82f6",
        "icon": "❄️",
        "conditions": [
          { "state_entity": "input_boolean.sensor_bedroom", "operator": "==", "value": "on" },
          { "state_entity": "sensor.somneo_temperature", "operator": "<", "value": "20" }
        ]
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

## 4. Entity Decoupling
As of recent updates, the Map Engine explicitly supports **Abstract Shortcuts**. A shortcut no longer requires a root `entity_id`. Actions configured with the `CALL_SERVICE` type will execute payload-driven Home Assistant scripts flawlessly without attempting to inject a required `entity_id` target.

## Benefits
1.  **Safety**: Recomputing the floorplan (SVG/DXF) never overwrites shortcut files.
2.  **Extensibility**: Adding a new device type requires only a single new class definition file, zero changes to the core drawing loop.
3.  **UX**: Objects are absolute-positioned, entirely independent of room boundaries, allowing fluid customization.
