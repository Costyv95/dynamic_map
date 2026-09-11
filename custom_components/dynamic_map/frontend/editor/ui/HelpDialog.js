import { el } from './dom.js?v=3.2.1';
import { openDialog } from './Dialog.js?v=3.2.1';

/** Keyboard and mouse reference, opened with ? or from the ⋯ menu. */
const GROUPS = [
    ['Objects & decor', [
        [['Shift', 'click'], 'Add to / remove from the selection'],
        [['Drag'], 'Move (snaps to other badges); hold Alt to move freely'],
        [['←', '→', '↑', '↓'], 'Nudge by 1 px, with Shift by 10 px'],
        [['Ctrl', 'D'], 'Duplicate the selection'],
        [['Delete'], 'Delete the selection'],
        [['Esc'], 'Clear the selection']
    ]],
    ['Rooms', [
        [['Shift', 'click'], 'Draw a room corner by corner; Enter finishes, Esc cancels'],
        [['Click edge'], 'Add a corner; Alt-click a corner removes it'],
        [['Right-drag'], 'Split the selected room along the line'],
        [['Ctrl', 'click'], 'Select a second room to merge']
    ]],
    ['Everything', [
        [['Ctrl', 'Z'], 'Undo'],
        [['Ctrl', 'Shift', 'Z'], 'Redo (also Ctrl+Y)'],
        [['Ctrl', 'S'], 'Save the floor'],
        [['Wheel', 'pinch'], 'Zoom; drag the empty canvas to pan'],
        [['?'], 'This list']
    ]]
];

export function openShortcutsHelp() {
    const body = GROUPS.map(([title, rows]) => el('div.dm-help-group', {},
        el('h4', {}, title),
        el('table.dm-help-table', {}, rows.map(([keys, what]) => el('tr', {},
            el('td', {}, keys.flatMap((k, i) => [i ? ' + ' : null, el('kbd', {}, k)])),
            el('td', {}, what))))));
    return openDialog({ title: 'Keyboard & mouse', body, buttons: [{ label: 'Close', value: 'ok', primary: true }], width: 520 });
}
