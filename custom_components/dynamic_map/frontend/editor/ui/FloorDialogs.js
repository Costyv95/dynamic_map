import { el, field, numberInput, colorInput } from './dom.js?v=3.2.1';
import { openDialog, toast } from './Dialog.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';
import { DEFAULT_FLIPS } from '../../core/Viewport.js?v=3.2.1';

export function pickImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        };
        input.click();
    });
}

export function makeBlankCanvas(w, h, color) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    if (color) {
        const cx = c.getContext('2d');
        cx.fillStyle = color; cx.fillRect(0, 0, w, h);
    }
    return c.toDataURL('image/png');
}

/** "Add floor": a number plus either a plan image or a blank canvas. */
export async function openAddFloorDialog(app) {
    const existing = app.floors || [];
    const suggested = (existing.length ? Math.max(...existing) : 0) + 1;
    const numIn = numberInput({ value: suggested, min: 1, step: 1 });
    let source = 'blank';
    const pick = (v) => { source = v; blankBtn.classList.toggle('primary', v === 'blank'); imageBtn.classList.toggle('primary', v === 'image'); };
    const blankBtn = el('button', { type: 'button', onClick: () => pick('blank') }, '⬜ Blank canvas');
    const imageBtn = el('button', { type: 'button', onClick: () => pick('image') }, '🖼 Upload a plan image');
    pick('blank');
    const v = await openDialog({ title: 'Add a floor', body: [
        field('Floor number', numIn, { hint: 'Used in the file names, e.g. 3 for a terrace.' }),
        field('Start from', el('div.dm-row', {}, blankBtn, imageBtn), { hint: 'A blank canvas is a dark plate you draw rooms on; a plan image shows under the rooms.' })
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const n = parseInt(numIn.value);
    if (isNaN(n) || n < 1) { toast('Enter a floor number.', 'error'); return; }
    if (existing.includes(n)) { toast(`Floor ${n} already exists.`, 'error'); return; }
    let dataUrl;
    if (source === 'image') {
        dataUrl = await pickImageFile();
        if (!dataUrl) return;
    } else {
        dataUrl = makeBlankCanvas(1600, 1000, '#1e293b');
    }
    try {
        await ApiManager.saveImage(`bg_floor${n}.png`, dataUrl);
        await ApiManager.saveToHA(n, [], [], { rotation_mode: 'auto', flips: DEFAULT_FLIPS() });
        app.setFloors([...existing, n].sort((a, b) => a - b));
        app.switchFloor(n);
        toast(`Floor ${n} created.`, 'ok');
    } catch (err) {
        toast(`Failed to add floor: ${err.message}`, 'error', 5000);
    }
}

/** Floor background: colour + mode stored in config_floorN.json. */
export async function openBackgroundDialog(app) {
    const canvas = app.canvas;
    let mode = canvas.backgroundMode === 'fit' ? 'fit' : 'around';
    let color = canvas.backgroundColor || '#1e293b';
    const radio = (value, title, hint) => el('label.dm-check', { style: { alignItems: 'flex-start' } },
        el('input', { type: 'radio', name: 'dm-bg-mode', value, checked: mode === value, onChange: () => { mode = value; } }),
        el('span', {}, el('b', {}, title), el('div.dm-hint', {}, hint)));
    const v = await openDialog({ title: 'Floor background', body: [
        field('Colour', colorInput(color, (c) => { color = c; }, (c) => { if (c) color = c; })),
        radio('fit', 'Fit the rooms', 'No canvas: a rounded plate in this colour hugs the rooms. Best for blank floors.'),
        radio('repaint', 'Repaint the canvas', 'Fill the whole background image with this colour (keeps its size).'),
        radio('around', 'Around the plan', 'Keep the plan image; use this colour around and behind it.')
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Apply', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    canvas.backgroundColor = color;
    canvas.backgroundMode = mode === 'fit' ? 'fit' : 'image';
    try {
        const w = canvas.imgW || 1600, h = canvas.imgH || 1000;
        const floor = app.state.activeFloor;
        if (mode === 'repaint') await ApiManager.saveImage(`bg_floor${floor}.png`, makeBlankCanvas(w, h, color));
        else if (mode === 'fit') await ApiManager.saveImage(`bg_floor${floor}.png`, makeBlankCanvas(w, h, null));
        await app.save({ background_color: color, background_mode: canvas.backgroundMode });
        if (mode !== 'around') app.loadFloor(floor); else canvas.layout();
        toast('Background saved.', 'ok');
    } catch (err) {
        toast(`Failed: ${err.message}`, 'error', 5000);
    }
}
