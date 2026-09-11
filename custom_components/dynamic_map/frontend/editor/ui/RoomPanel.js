import { el, field, section, textInput, select, colorInput } from './dom.js?v=3.2.1';
import { confirmDialog } from './Dialog.js?v=3.2.1';

/** Help shown on the rooms layer when nothing is selected. */
export function renderRoomsOverview(ctx) {
    const { state } = ctx;
    const items = state.rooms.map((r, idx) => el('div.dm-list-item', {
        onClick: () => { state.selectedRooms = [idx]; ctx.select(); }
    }, el('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: r.color || '#64748b', flex: 'none' } }), r.name || 'Unnamed room'));
    return [
        el('div.dm-help', {},
            el('p', {}, el('b', {}, 'Draw a room: '), 'hold ', el('kbd', {}, 'Shift'), ' and click the corners, then press ', el('kbd', {}, 'Enter'), '. ', el('kbd', {}, 'Esc'), ' cancels.'),
            el('p', {}, el('b', {}, 'Edit a room: '), 'click it, then drag the round corner handles. Click an edge to add a corner, ', el('kbd', {}, 'Alt'), '-click a corner to remove it.'),
            el('p', {}, el('b', {}, 'Split / merge: '), 'right-drag a line across a selected room to split it. ', el('kbd', {}, 'Ctrl'), '-click a second room, then Merge.')),
        section('Rooms on this floor', items.length ? el('div.dm-list', {}, items) : el('div.dm-empty', {}, 'No rooms yet.'), { key: 'rooms-list' })
    ];
}

export function renderRoomPanel(ctx) {
    const { state, app } = ctx;
    if (state.selectedRooms.length >= 2) return renderMergePanel(ctx);
    const room = state.rooms[state.selectedRooms[0]];
    if (!room) return renderRoomsOverview(ctx);
    const areas = [{ value: '', label: '— Not linked —' }, ...(state.haAreas || []).map(a => ({ value: a.id, label: a.name }))];
    const commit = () => { state.saveState(); state.requestDrawCallback(); ctx.syncLists(); };

    const entityInput = textInput({ value: room.entity_id || '', placeholder: 'e.g. light.living_room', list: 'entityList',
        onInput: (v) => { room.entity_id = v; }, onChange: commit });
    const entityField = app.attachAutocomplete(entityInput);

    return [
        section('Room', [
            field('Name', textInput({ value: room.name || '', placeholder: 'e.g. Living room',
                onInput: (v) => { room.name = v; state.requestDrawCallback(); }, onChange: commit })),
            field('Home Assistant area', select(areas, room.area_id || '', (v) => {
                room.area_id = v;
                const area = (state.haAreas || []).find(a => a.id === v);
                if (area && area.default_light && !room.entity_id) { room.entity_id = area.default_light; entityInput.value = area.default_light; }
                commit();
            }), { hint: 'Links the room to an HA area so "toggle area lights" and presence work.' }),
            field('Light entity (optional)', entityField, { hint: 'The room fills with its colour while this entity is on.' }),
            field('Colour', colorInput(room.color || '#333333',
                (v) => { room.color = v; localStorage.setItem('lastRoomColor', v); state.requestDrawCallback(); },
                (v) => { if (v) room.color = v; commit(); }))
        ], { key: 'room' }),
        el('div.dm-row', {},
            el('button.danger', { type: 'button', onClick: async () => {
                if (!(await confirmDialog('Delete room', `Delete "${room.name || 'this room'}"? Undo is available afterwards.`, { okLabel: 'Delete', danger: true }))) return;
                state.rooms.splice(state.selectedRooms[0], 1);
                state.selectedRooms = [];
                state.saveState();
                ctx.select();
            } }, '🗑 Delete room'))
    ];
}

function renderMergePanel(ctx) {
    const { state } = ctx;
    const names = state.selectedRooms.map(i => state.rooms[i]?.name || 'room').join(' + ');
    return section('Merge rooms', [
        el('p.dm-help', {}, `Merge ${names} into one room. The first room keeps its settings.`),
        el('button.primary', { type: 'button', onClick: () => {
            if (state.selectedRooms.length !== 2 || !window.PolyBool) return;
            const r1 = state.rooms[state.selectedRooms[0]];
            const r2 = state.rooms[state.selectedRooms[1]];
            const comb = window.PolyBool.union({ regions: [r1.polygon], inverted: false }, { regions: [r2.polygon], inverted: false });
            if (!comb.regions.length) return;
            r1.polygon = comb.regions[0];
            r1.name = r1.name || r2.name;
            state.rooms.splice(state.selectedRooms[1], 1);
            state.selectedRooms = [state.selectedRooms[0]];
            state.saveState();
            ctx.select();
        } }, 'Merge selected rooms')
    ]);
}
