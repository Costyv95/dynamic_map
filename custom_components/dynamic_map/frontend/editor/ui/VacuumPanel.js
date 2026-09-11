import { el, field, section, textInput, select, numberInput } from './dom.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';
import { toast } from './Dialog.js?v=3.2.1';

/**
 * Vacuum specifics: room-sensor override and the mapping from the
 * vacuum's own room ids to rooms on this floor (plus segment ids).
 */
export function renderVacuumPanel(ctx, sc) {
    const { state } = ctx;
    const cfg = sc.config;
    if (!cfg.room_mapping) cfg.room_mapping = {};
    Object.keys(cfg.room_mapping).forEach(id => { if (id.startsWith('room_')) delete cfg.room_mapping[id]; });   // legacy inverted ids
    const commit = () => state.saveState();
    const fetched = state.lastFetchedVacuumOptions || [];
    const ids = new Set([...Object.keys(cfg.room_mapping), ...fetched.map(o => String(o.id))]);
    const names = Object.fromEntries(fetched.map(o => [String(o.id), o.name]));

    const fetchBtn = el('button', { type: 'button', onClick: async () => {
        if (!sc.entity_id) { toast('Set the vacuum entity first.', 'error'); return; }
        fetchBtn.disabled = true;
        try {
            state.lastFetchedVacuumOptions = await ApiManager.fetchVacuumRooms(sc.entity_id);
            toast(`Found ${state.lastFetchedVacuumOptions.length} rooms.`, 'ok');
            ctx.refresh();
        } catch (e) {
            toast(`Could not fetch rooms: ${e.message}`, 'error', 5000);
        } finally { fetchBtn.disabled = false; }
    } }, '⟳ Fetch rooms from HA');

    const rows = [...ids].map(roboId => {
        const opt = fetched.find(o => String(o.id) === roboId);
        let seg = cfg.segment_mapping?.[roboId];
        if ((seg === undefined || seg === '') && opt && opt.segId !== undefined && opt.segId !== '') {
            if (!cfg.segment_mapping) cfg.segment_mapping = {};
            seg = cfg.segment_mapping[roboId] = parseInt(opt.segId);
        }
        const label = names[roboId] && String(names[roboId]) !== roboId ? `${names[roboId]} (${roboId})` : `Room id ${roboId}`;
        const roomSel = select([{ value: '', label: '— Ignore —' }, ...state.rooms.filter(r => r.name).map(r => ({ value: r.id, label: r.name }))],
            cfg.room_mapping[roboId] || '', (v) => { if (v) cfg.room_mapping[roboId] = v; else delete cfg.room_mapping[roboId]; commit(); });
        const segIn = numberInput({ value: seg, placeholder: 'Segment', width: '96px', onChange: (v) => {
            if (!cfg.segment_mapping) cfg.segment_mapping = {};
            if (v === undefined) delete cfg.segment_mapping[roboId]; else cfg.segment_mapping[roboId] = Math.round(v);
            commit();
        } });
        return field(label, el('div.dm-row', {}, roomSel, segIn));
    });

    return section('Vacuum', [
        el('div.dm-hint', {}, 'The dock position is where this badge sits. Map the vacuum\'s rooms to rooms on this floor so "clean these rooms" works.'),
        field('Current-room sensor (optional)', textInput({ value: cfg.room_sensor || '', placeholder: 'sensor.vacuum_current_room', list: 'entityList',
            onChange: (v) => { if (v) cfg.room_sensor = v; else delete cfg.room_sensor; commit(); } })),
        fetchBtn,
        rows.length ? rows : el('div.dm-empty', {}, 'Fetch the rooms to start mapping.')
    ], { key: 'sc-vacuum' });
}
