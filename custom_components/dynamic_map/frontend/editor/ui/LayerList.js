import { el, section } from './dom.js?v=3.2.1';
import { layerOf } from './binding.js?v=3.2.1';

/** Objects / decor layer with nothing selected: help plus a click-to-select list. */
export function renderLayerList(ctx, layer) {
    const { state } = ctx;
    const items = state.shortcuts
        .map((sc, idx) => ({ sc, idx }))
        .filter(({ sc }) => layerOf(sc) === layer)
        .map(({ sc, idx }) => el('div.dm-list-item', { onClick: () => { state.selectedShortcutIdx = idx; state.selectedRooms = []; ctx.select(); } },
            el('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: sc.config?.color || '#0ea5e9', flex: 'none' } }),
            el('span', { style: { flex: '1 1 55%' }, title: sc.name || sc.id }, sc.name || sc.id),
            el('span.dm-hint', { title: sc.entity_id || '' }, sc.entity_id || sc.type || '')));
    const help = layer === 'decor'
        ? el('div.dm-help', {}, el('p', {}, 'Decor is scenery: furniture, plants, rugs. It turns with the plan and is never clickable on the dashboard. Click ', el('b', {}, '＋ Decor'), ' to add one, then drag it into place.'))
        : el('div.dm-help', {}, el('p', {}, 'Objects are the interactive badges: lights, sensors, the vacuum. Click ', el('b', {}, '＋ Object'), ' to add one, drag it onto the map, then pick its entity and type.'),
            el('p', {}, 'Drag the square handles to resize, the round one above to rotate. ', el('kbd', {}, 'Shift'), '-click selects several objects to move or align together. ', el('kbd', {}, 'Delete'), ' removes the selection; ', el('kbd', {}, 'Ctrl'), '+', el('kbd', {}, 'Z'), ' undoes.'));
    return [help, section(layer === 'decor' ? 'Decor on this floor' : 'Objects on this floor',
        items.length ? el('div.dm-list', {}, items) : el('div.dm-empty', {}, 'Nothing here yet.'), { key: `${layer}-list` })];
}
