import { el, field, numberInput, colorInput } from './dom.js?v=3.2.1';
import { openDialog, confirmDialog, toast } from './Dialog.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';
import { DEFAULT_FLIPS } from '../../core/Viewport.js?v=3.2.1';
import { DEFAULT_CANVAS } from '../../shared/FloorPlan.js?v=3.2.1';

const DEFAULT_FLOOR_COLOR = '#eeeeee';

/** Fill the icon datalist from the data dir (custom icons). */
export async function loadIconList(root = document) {
    try {
        const data = await ApiManager.fetchAvailableFiles();
        const iconList = root.querySelector('#iconList');
        if (data.success && data.icons && iconList) iconList.innerHTML = data.icons.map(p => `<option value="${p}"></option>`).join('');
    } catch (err) {
        console.warn('[editor] Failed to load the icon list:', err.message);
    }
}

/**
 * "Add floor": a number and a canvas size. Floors are drawn, not imported:
 * rooms, walls, furniture, doors and windows all go on this canvas.
 */
export async function openAddFloorDialog(app) {
    const existing = app.floors || [];
    const suggested = (existing.length ? Math.max(...existing) : 0) + 1;
    const numIn = numberInput({ value: suggested, min: 1, step: 1 });
    const wIn = numberInput({ value: DEFAULT_CANVAS.w, min: 200, step: 10 });
    const hIn = numberInput({ value: DEFAULT_CANVAS.h, min: 200, step: 10 });
    let color = DEFAULT_FLOOR_COLOR;
    const v = await openDialog({ title: 'Add a floor', body: [
        field('Floor number', numIn, { hint: 'Used in the file names, e.g. 3 for a terrace.' }),
        el('div.dm-row', {}, field('Canvas width', wIn), field('Canvas height', hIn)),
        el('p.dm-hint', {}, 'Map units, not pixels: roughly 1 unit per centimetre works well. The card zooms to the rooms, so spare room on the canvas costs nothing.'),
        field('Floor colour', colorInput(color, (c) => { color = c; }, (c) => { if (c) color = c; }))
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const n = parseInt(numIn.value);
    const w = parseInt(wIn.value), h = parseInt(hIn.value);
    if (isNaN(n) || n < 1) { toast('Enter a floor number.', 'error'); return; }
    if (existing.includes(n)) { toast(`Floor ${n} already exists.`, 'error'); return; }
    if (!(w > 0 && h > 0)) { toast('Enter a canvas size.', 'error'); return; }
    try {
        await ApiManager.saveToHA(n, [], [], {
            canvas: { w, h }, background_mode: 'fit', background_color: color || DEFAULT_FLOOR_COLOR,
            rotation_mode: 'auto', flips: DEFAULT_FLIPS()
        });
        app.setFloors([...existing, n].sort((a, b) => a - b));
        app.switchFloor(n);
        toast(`Floor ${n} created. Draw its walls on the Walls layer, then rooms and furniture.`, 'ok', 5000);
    } catch (err) {
        toast(`Failed to add floor: ${err.message}`, 'error', 5000);
    }
}

/**
 * Floor colour. A floor still on a plan picture (made before floors were
 * drawn) can drop it here: its canvas keeps the picture's size, so rooms
 * and objects stay where they are.
 */
export async function openBackgroundDialog(app) {
    const canvas = app.canvas;
    const legacy = !canvas.canvasSize;
    let color = canvas.backgroundColor || DEFAULT_FLOOR_COLOR;
    let drop = false;
    const body = [field('Floor colour', colorInput(color, (c) => { color = c; }, (c) => { if (c) color = c; }),
        { hint: 'The plate under the rooms. Walls and furniture are drawn on it in the same tone.' })];
    if (legacy) {
        body.push(el('label.dm-check', { style: { alignItems: 'flex-start' } },
            el('input', { type: 'checkbox', onChange: (e) => { drop = e.target.checked; } }),
            el('span', {}, el('b', {}, 'Stop using the plan picture'),
                el('div.dm-hint', {}, `Draw this floor instead: walls on the Walls layer, furniture as decor. The canvas keeps the picture's size (${canvas.imgW} × ${canvas.imgH}); the picture file stays on disk, unused.`))));
    }
    const v = await openDialog({ title: 'Floor background', body,
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Apply', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    canvas.backgroundColor = color;
    const extra = { background_color: color };
    if (legacy && drop) {
        canvas.canvasSize = { w: canvas.imgW, h: canvas.imgH };
        canvas.backgroundMode = 'fit';
        extra.canvas = canvas.canvasSize;
        extra.background_mode = 'fit';
    }
    try {
        await app.save(extra);
        app.loadFloor(app.state.activeFloor);
        toast('Background saved.', 'ok');
    } catch (err) {
        toast(`Failed: ${err.message}`, 'error', 5000);
    }
}

/** Remove a floor and all its files. */
export async function openDeleteFloorDialog(app) {
    const floor = app.state.activeFloor;
    if (!(await confirmDialog('Delete floor', `Permanently delete "${app.floorLabel(floor)}" (floor ${floor}) and all its rooms, walls and objects?`, { okLabel: 'Delete', danger: true }))) return;
    try {
        const data = await ApiManager.deleteFloor(floor);
        if (!data.success) throw new Error(data.error || 'failed');
        toast('Floor deleted. Reloading…', 'ok');
        setTimeout(() => window.location.reload(), 1200);
    } catch (e) { toast(`Delete failed: ${e.message}`, 'error', 5000); }
}
