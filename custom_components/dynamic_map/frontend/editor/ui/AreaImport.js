import { el, section } from './dom.js?v=3.2.1';
import { toast } from './Dialog.js?v=3.2.1';
import { applyTypePreset } from './Presets.js?v=3.2.1';
import { areaEntities, describeEntity } from '../../card/RoomEntities.js?v=3.2.1';
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

/** Median scale of the badges already on the floor, so imports match them. */
export function typicalScale(shortcuts) {
    const vals = (shortcuts || []).map(sc => {
        const v = sc.scaleX !== undefined ? sc.scaleX : sc.scale;
        const n = v && typeof v === 'object' ? v.horizontal : v;
        return Number(n);
    }).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : 3;
}

/** Build one badge for an entity, using the type presets. */
export function badgeFor(hass, id, pos, roomId, scale = 3) {
    const domain = id.split('.')[0];
    const st = hass.states[id] || { attributes: {} };
    const name = (st.attributes && st.attributes.friendly_name) || id.split('.')[1].replace(/_/g, ' ');
    const sc = { id: `sc_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, name, entity_id: id, position: pos, parent: roomId,
        scale, scaleX: scale, scaleY: scale, config: { shape: 'circle', color: '#0ea5e9' } };
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
    const scale = typicalScale(state.shortcuts);
    ids.forEach((id, i) => state.shortcuts.push(badgeFor(hass, id, pts[i], room.id, scale)));
    state.saveState();
    state.requestDrawCallback();
    ctx.refresh();
    toast(`Added ${ids.length} device${ids.length === 1 ? '' : 's'} from the area. Drag them into place.`, 'ok');
    return ids.length;
}

/** Place one badge for `id` in the room, then jump to it on the objects layer. */
export function importOne(ctx, room, id) {
    const { state, canvas } = ctx;
    const [pos] = gridInRoom(room, 1, canvas.imgW, canvas.imgH);
    const sc = badgeFor(canvas._hass, id, pos, room.id, typicalScale(state.shortcuts));
    state.shortcuts.push(sc);
    state.saveState();
    selectBadge(ctx, sc.id);
    toast(`Added ${sc.name}. Drag it into place.`, 'ok');
    return sc;
}

/** Switch to the objects layer with the badge that holds `entityId` selected. */
export function selectBadge(ctx, idOrEntity) {
    const { state } = ctx;
    const idx = state.shortcuts.findIndex(sc => sc.id === idOrEntity || sc.entity_id === idOrEntity);
    if (idx === -1) return false;
    state.setActiveLayer('objects');
    state.selectedShortcutIdx = idx;
    state.selectedExtra = [];
    ctx.select();
    return true;
}

/** Section for the room panel: every device of the area, one row each. */
export function renderAreaImport(ctx, room) {
    const hass = ctx.canvas._hass;
    if (!room.area_id) return null;
    if (!hass || !hass.entities) {
        return section('Devices in this area', el('div.dm-hint', {}, 'Open the editor from the Home Assistant sidebar to see and import this area\'s devices.'), { key: 'area-import' });
    }
    const placed = placedEntities(ctx.state.shortcuts);
    const unplaced = unplacedAreaEntities(hass, room, ctx.state.shortcuts);
    const all = areaEntities(hass, room.area_id);
    const rows = all.slice(0, 40).map(id => deviceRow(ctx, room, describeEntity(hass, id), placed.has(id), unplaced.includes(id)));
    return section('Devices in this area', [
        rows.length ? el('div.dm-list.dm-device-list', {}, rows) : el('div.dm-hint', {}, 'No devices in this area.'),
        all.length > 40 ? el('div.dm-hint', {}, `…and ${all.length - 40} more`) : null,
        unplaced.length ? el('button.primary', { type: 'button', onClick: () => importArea(ctx, room) }, `＋ Add all ${unplaced.length} missing as objects`) : null
    ], { key: 'area-import' });
}

function deviceRow(ctx, room, d, isPlaced, canAdd) {
    const tail = isPlaced
        ? el('span.dm-hint', { title: 'Already on the map: click to select it' }, '✓ on map')
        : canAdd
            ? el('button', { type: 'button', title: 'Add as an object in this room', onClick: (e) => { e.stopPropagation(); importOne(ctx, room, d.id); } }, '＋')
            : el('span.dm-hint', { title: 'Sensors and diagnostics are shown in the card\'s room panel, not as objects' }, d.value);
    const row = el('div.dm-list-item', { title: d.id, onClick: () => { if (isPlaced) selectBadge(ctx, d.id); } },
        el('span', {}, d.icon), el('span', { style: { flex: '1' } }, d.name), tail);
    row.classList.toggle('dm-placed', isPlaced);
    return row;
}
