import { el, section } from './dom.js?v=3.2.1';
import { toast } from './Dialog.js?v=3.2.1';
import { applyTypePreset } from './Presets.js?v=3.2.1';
import { areaEntities } from '../../card/RoomEntities.js?v=3.2.1';
import { MapGeometry } from '../../shared/MapGeometry.js?v=3.2.1';
import { roomBox } from '../../core/RoomLabels.js?v=3.2.1';

/**
 * "Add this area's devices": one click places a badge for every device of
 * the room's HA area that is not on the floor yet. Needs live hass (the
 * panel gets it from HA; the standalone page reads the parent app).
 */
const TYPE_FOR = { light: 'light', media_player: 'media', vacuum: 'vacuum', climate: 'generic', switch: 'generic', fan: 'generic', input_boolean: 'generic', cover: 'generic', lock: 'generic' };
const ICON_FOR = { switch: '🔌', fan: '🌀', input_boolean: '🔘', cover: '🪟', lock: '🔒', climate: '🌡️', media_player: '🎵', light: '💡', vacuum: '🤖' };

/** Entities referenced anywhere on the floor (badge entity or sensor readings). */
export function placedEntities(shortcuts) {
    const out = new Set();
    (shortcuts || []).forEach(sc => {
        if (sc.entity_id) out.add(sc.entity_id);
        const c = sc.config || {};
        [c.temperature_entity, c.humidity_entity, c.state_entity].forEach(id => { if (id) out.add(id); });
    });
    return out;
}

/** Area entities worth a badge that are not placed yet. */
export function unplacedAreaEntities(hass, room, shortcuts) {
    if (!hass || !room || !room.area_id) return [];
    const placed = placedEntities(shortcuts);
    return areaEntities(hass, room.area_id).filter(id => {
        if (placed.has(id)) return false;
        const domain = id.split('.')[0];
        if (TYPE_FOR[domain]) return true;
        const st = hass.states[id];
        return domain === 'sensor' && st && st.attributes && st.attributes.device_class === 'temperature';
    });
}

/** Grid of points inside the room polygon (percent), centred on the room. */
export function gridInRoom(room, count, imgW, imgH) {
    const b = roomBox(room, imgW, imgH);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const stepX = Math.min(b.w * 0.6 / Math.max(cols, 1), 90), stepY = Math.min(b.h * 0.6 / Math.max(rows, 1), 90);
    const pts = [];
    for (let i = 0; i < count; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        let x = b.cx + (c - (cols - 1) / 2) * stepX, y = b.cy + (r - (rows - 1) / 2) * stepY;
        const pct = [(x / imgW) * 100, (y / imgH) * 100];
        pts.push(MapGeometry.isPointInPolygon(pct, room.polygon) ? pct : [(b.cx / imgW) * 100, (b.cy / imgH) * 100]);
    }
    return pts;
}

/** Build one badge for an entity, using the type presets. */
export function badgeFor(hass, id, pos, roomId) {
    const domain = id.split('.')[0];
    const st = hass.states[id] || { attributes: {} };
    const name = (st.attributes && st.attributes.friendly_name) || id.split('.')[1].replace(/_/g, ' ');
    const sc = { id: `sc_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, name, entity_id: id, position: pos, parent: roomId, config: { shape: 'circle', color: '#0ea5e9' } };
    if (domain === 'sensor') {
        sc.type = 'sensor';
        sc.config.temperature_entity = id;
        delete sc.config.shape;
    } else {
        sc.type = TYPE_FOR[domain] || 'generic';
        sc.config.icon = ICON_FOR[domain] || '';
    }
    applyTypePreset(sc, sc.type);
    if (sc.type === 'generic' && (!sc.config.actions || !sc.config.actions.length)) {
        sc.config.actions = [{ id: `act_${Date.now()}`, type: 'TOGGLE', trigger: 'tap', action_entity: id }];
    }
    return sc;
}

export function importArea(ctx, room) {
    const { state, canvas } = ctx;
    const hass = canvas._hass;
    const ids = unplacedAreaEntities(hass, room, state.shortcuts);
    if (!ids.length) { toast('Every device of this area is already on the map.'); return 0; }
    const pts = gridInRoom(room, ids.length, canvas.imgW, canvas.imgH);
    ids.forEach((id, i) => state.shortcuts.push(badgeFor(hass, id, pts[i], room.id)));
    state.saveState();
    state.requestDrawCallback();
    ctx.refresh();
    toast(`Added ${ids.length} device${ids.length === 1 ? '' : 's'} from the area. Drag them into place.`, 'ok');
    return ids.length;
}

/** Section for the room panel. */
export function renderAreaImport(ctx, room) {
    const hass = ctx.canvas._hass;
    if (!room.area_id) return null;
    if (!hass || !hass.entities) {
        return section('Devices in this area', el('div.dm-hint', {}, 'Open the editor from the Home Assistant sidebar to import this area\'s devices.'), { key: 'area-import' });
    }
    const ids = unplacedAreaEntities(hass, room, ctx.state.shortcuts);
    const names = ids.map(id => (hass.states[id]?.attributes?.friendly_name) || id);
    return section('Devices in this area', [
        ids.length
            ? el('div.dm-hint', {}, `${ids.length} not on the map yet: ${names.slice(0, 6).join(', ')}${names.length > 6 ? '…' : ''}`)
            : el('div.dm-hint', {}, 'Every device of this area is already on the map.'),
        ids.length ? el('button.primary', { type: 'button', onClick: () => importArea(ctx, room) }, `＋ Add ${ids.length} device${ids.length === 1 ? '' : 's'} as objects`) : null
    ], { key: 'area-import' });
}
