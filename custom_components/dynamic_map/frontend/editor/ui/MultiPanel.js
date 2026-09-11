import { el, section } from './dom.js?v=3.2.1';
import { confirmDialog } from './Dialog.js?v=3.2.1';
import { framesOf, alignTargets, distributeTargets, applyTargets, matchSizeTargets, applySizes } from '../Align.js?v=3.2.1';

/** Inspector for two or more selected badges: align, distribute, match, delete. */
export function renderMultiPanel(ctx) {
    const { state, canvas, app } = ctx;
    const idxs = state.selectionIndices();
    const shortcuts = idxs.map(i => state.shortcuts[i]).filter(Boolean);
    const opts = () => ({ mode: canvas.activeMode, imgW: canvas.imgW, imgH: canvas.imgH, hass: canvas._hass });
    const writeOpts = () => ({ ...opts(), mode: canvas.linkOrientations === false ? canvas.activeMode : 'both' });
    const run = (fn) => { fn(); state.saveState(); state.requestDrawCallback(); ctx.refresh(); };
    const primary = shortcuts[0];
    const btn = (label, title, onClick) => el('button', { type: 'button', title, onClick: () => run(onClick) }, label);
    const align = (how) => () => applyTargets(alignTargets(framesOf(shortcuts, opts()), how, framesOf([primary], opts())[0]), writeOpts());
    const distribute = (axis) => () => applyTargets(distributeTargets(framesOf(shortcuts, opts()), axis), writeOpts());
    return [
        el('div.dm-help', {}, el('p', {}, `${shortcuts.length} objects selected. `, el('b', {}, primary.name || 'The first one'), ' is the reference for alignment and size. Drag any of them to move all; ', el('kbd', {}, 'Shift'), '-click to add or remove one.')),
        section('Align to reference', [
            el('div.dm-row', {}, btn('⇤ Left', 'Align left edges', align('left')), btn('↔ Centre', 'Align centres', align('center')), btn('⇥ Right', 'Align right edges', align('right'))),
            el('div.dm-row', {}, btn('⤒ Top', 'Align top edges', align('top')), btn('↕ Middle', 'Align middles', align('middle')), btn('⤓ Bottom', 'Align bottom edges', align('bottom')))
        ], { key: 'multi-align' }),
        section('Distribute & size', [
            el('div.dm-row', {},
                el('button', { type: 'button', title: 'Even horizontal spacing (3 or more)', disabled: shortcuts.length < 3, onClick: () => run(distribute('x')) }, '⋯ Spread horizontally'),
                el('button', { type: 'button', title: 'Even vertical spacing (3 or more)', disabled: shortcuts.length < 3, onClick: () => run(distribute('y')) }, '⋮ Spread vertically')),
            btn('Same size and rotation as reference', 'Copy the reference badge\'s width, height and rotation', () => applySizes(matchSizeTargets(framesOf(shortcuts, opts())), writeOpts()))
        ], { key: 'multi-size' }),
        el('div.dm-row', {},
            el('button', { type: 'button', onClick: () => { state.clearExtraSelection(); ctx.select(); } }, 'Select only the reference'),
            el('button.danger', { type: 'button', onClick: async () => {
                if (!(await confirmDialog('Delete objects', `Delete ${shortcuts.length} objects? Undo is available afterwards.`, { okLabel: 'Delete', danger: true }))) return;
                state.deleteSelection();
                ctx.select();
            } }, `🗑 Delete ${shortcuts.length}`))
    ];
}
