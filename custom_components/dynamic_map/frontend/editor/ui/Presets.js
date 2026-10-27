import { DEFAULT_DATA_BASE } from '../../shared/DataUrl.js?v=3.2.1';
import { furnitureKinds } from '../../shared/Furniture.js?v=3.2.1';
/**
 * Default states and actions applied when a shortcut's type changes and
 * the shortcut has none yet. Kept as data so the panel stays small.
 */
const uid = (p) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const PRESETS = {
    vacuum: (entity) => ({
        states: [
            { id: uid('st'), name: 'Docked', state_entity: entity, operator: '==', value: 'docked', color: '#10b981', icon: '🔋', image: `${DEFAULT_DATA_BASE}/icons/dock.svg` },
            { id: uid('st'), name: 'Cleaning', state_entity: entity, operator: '==', value: 'cleaning', color: '#3b82f6', icon: '🧹', image: `${DEFAULT_DATA_BASE}/icons/vacuum.svg` },
            { id: uid('st'), name: 'Returning', state_entity: entity, operator: '==', value: 'returning', color: '#f59e0b', icon: '🏠', image: `${DEFAULT_DATA_BASE}/icons/vacuum_return.svg` },
            { id: uid('st'), name: 'Error', state_entity: entity, operator: '==', value: 'error', color: '#ef4444', icon: '⚠️', image: `${DEFAULT_DATA_BASE}/icons/vacuum_error.svg` }
        ],
        actions: [
            { id: uid('act'), type: 'ROOM_SELECTOR', trigger: 'overlay', action_entity: entity },
            { id: uid('act'), type: 'CALL_SERVICE', trigger: 'overlay', action_entity: entity, service: 'vacuum.return_to_base', name: 'Return to Dock', icon: '🏠' },
            { id: uid('act'), type: 'CALL_SERVICE', trigger: 'overlay', action_entity: entity, service: 'vacuum.start', name: 'Clean House', icon: '🧹' }
        ]
    }),
    light: (entity) => ({
        states: [
            { id: uid('st'), name: 'On', state_entity: entity, operator: '==', value: 'on', color: '#fbbf24', icon: '💡' },
            { id: uid('st'), name: 'Off', state_entity: entity, operator: '==', value: 'off', color: '#475569', icon: '💡' }
        ],
        actions: [
            { id: uid('act'), type: 'TOGGLE', trigger: 'tap', action_entity: entity },
            { id: uid('act'), type: 'SLIDER', trigger: 'overlay', action_entity: entity }
        ]
    }),
    sensor: (entity, cfg) => {
        const t = cfg.temperature_entity, h = cfg.humidity_entity;
        return {
            states: [
                { id: uid('st'), name: 'Temperature Cold', state_entity: t, operator: '<', value: '19', color: '#3b82f6', icon: '❄️' },
                { id: uid('st'), name: 'Temperature Comfort', state_entity: t, operator: 'between', value: '19-22', color: '#10b981', icon: '🌡️' },
                { id: uid('st'), name: 'Temperature Warm', state_entity: t, operator: '>', value: '22', color: '#f97316', icon: '🔥' },
                { id: uid('st'), name: 'Humidity Dry', state_entity: h, operator: '<', value: '40', color: '#eab308', icon: '🌵' },
                { id: uid('st'), name: 'Humidity Normal', state_entity: h, operator: 'between', value: '40-60', color: '#10b981', icon: '💧' },
                { id: uid('st'), name: 'Humidity Wet', state_entity: h, operator: '>', value: '60', color: '#3b82f6', icon: '🌧️' }
            ],
            actions: [
                // No tap action: a tap cycles the readings (#1743).
                { id: uid('act'), type: 'SENSOR_OVERLAY', trigger: 'long_press', action_entity: entity }
            ]
        };
    }
};

/** Fill in default states/actions for `type` when the shortcut has none. */
export function applyTypePreset(sc, type) {
    sc.type = type;
    if (!sc.config) sc.config = {};
    const cfg = sc.config;
    if (type === 'sensor') {
        cfg.temperature_entity = cfg.temperature_entity || sc.entity_id || 'sensor.room_temperature';
        cfg.humidity_entity = cfg.humidity_entity || 'sensor.room_humidity';
    }
    const make = PRESETS[type];
    if (!make) return;
    const preset = make(sc.entity_id || '', cfg);
    if (!cfg.states || cfg.states.length === 0) cfg.states = preset.states;
    if (!cfg.actions || cfg.actions.length === 0) cfg.actions = preset.actions;
}

export const SHORTCUT_TYPES = [
    { value: 'generic', label: 'Generic device' },
    { value: 'light', label: 'Light' },
    { value: 'sensor', label: 'Sensor (temperature / humidity)' },
    { value: 'vacuum', label: 'Robot vacuum' },
    { value: 'media', label: 'Media player' }
];

export function newObject(color) {
    return { id: `sc_${Date.now()}`, name: 'New object', type: 'generic', position: [50, 50], config: { shape: 'circle', color: color || '#0ea5e9' } };
}

/**
 * Scenery-only item: drawn furniture (shared/Furniture.js; a cabinet until
 * another kind is picked), rotates with the plan, never interactive.
 */
export function newDecor(kind = 'cabinet') {
    const size = (furnitureKinds().find(k => k.value === kind) || { size: [72, 72] }).size;
    return {
        id: `sc_${Date.now()}`, name: 'New decor', type: 'generic', position: [50, 50], scaleX: size[0] / 24, scaleY: size[1] / 24,
        config: { shape: 'rect', color: '#94a3b8', transparent: true, decor: true, autoRotate: true, proportional: false, furniture: kind }
    };
}
