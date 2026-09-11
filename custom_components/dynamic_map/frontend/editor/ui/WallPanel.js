import { el, field, section, numberInput, colorInput } from './dom.js?v=3.2.1';
import { WALL_DEFAULT_THICKNESS, WALL_DEFAULT_COLOR } from '../../shared/WallGeometry.js?v=3.2.1';

/** Walls layer inspector: draw tool, the selected wall's props, the list. */
export function renderWallPanel(ctx) {
    const { state } = ctx;
    const sel = state.walls[state.selectedWallIdx];
    const commit = () => { state.saveState(); state.requestDrawCallback(); };
    const drawBtn = el(`button${state.drawingWall ? '' : '.primary'}`, { type: 'button', onClick: () => {
        if (state.drawingWall) { state.drawingWall = null; state.wallCursor = null; }
        else { state.drawingWall = []; state.selectedWallIdx = -1; }
        ctx.refresh(); state.requestDrawCallback();
    } }, state.drawingWall ? '✕ Cancel drawing' : '✏️ Draw wall');

    const props = sel ? section(`Wall ${state.selectedWallIdx + 1}`, [
        el('div.dm-row', {},
            field('Thickness (map units)', el('div.dm-row', {},
                el('button', { type: 'button', onClick: () => bump(-1) }, '−'),
                numberInput({ value: Number(sel.thickness) || WALL_DEFAULT_THICKNESS, min: 1, max: 60, onChange: (v) => { if (v >= 1) { sel.thickness = Math.min(60, v); state.lastWallThickness = sel.thickness; commit(); } } }),
                el('button', { type: 'button', onClick: () => bump(1) }, '+'))),
            field('Colour', colorInput(sel.color || WALL_DEFAULT_COLOR, (v) => { sel.color = v; state.requestDrawCallback(); }, (v) => { if (v) { sel.color = v; state.lastWallColor = v; } commit(); }))),
        el('button.danger', { type: 'button', onClick: () => { state.walls.splice(state.selectedWallIdx, 1); state.selectedWallIdx = -1; commit(); ctx.refresh(); } }, '🗑 Delete wall')
    ], { key: 'wall' }) : null;

    function bump(d) {
        if (!sel) return;
        sel.thickness = Math.max(1, Math.min(60, (Number(sel.thickness) || WALL_DEFAULT_THICKNESS) + d));
        state.lastWallThickness = sel.thickness;
        commit(); ctx.refresh();
    }

    const list = state.walls.map((w, idx) => el(`div.dm-list-item${idx === state.selectedWallIdx ? '.active' : ''}`, {
        onClick: () => { state.selectedWallIdx = idx; ctx.select(); }
    }, `🧱 Wall ${idx + 1}`, el('span.dm-hint', {}, `${w.points.length} corners · ${Number(w.thickness) || WALL_DEFAULT_THICKNESS}px`)));

    return [
        el('div.dm-help', {},
            el('p', {}, el('b', {}, 'Draw: '), 'click on the map to place corners (they snap straight; hold ', el('kbd', {}, 'Shift'), ' for free angles). ', el('kbd', {}, 'Enter'), ' finishes, ', el('kbd', {}, 'Esc'), ' cancels.'),
            el('p', {}, el('b', {}, 'Edit: '), 'click a wall to select it, drag its corner handles to reshape, drag the body to move.')),
        drawBtn,
        props,
        section('Walls on this floor', list.length ? el('div.dm-list', {}, list) : el('div.dm-empty', {}, state.drawingWall ? 'Drawing… click on the map to place corners.' : 'No walls yet.'), { key: 'walls-list' })
    ];
}
