import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';
import { DEFAULT_FLIPS } from '../../core/Viewport.js?v=3.2.1';

/**
 * Floor switcher buttons, "Add Floor" (Builder Mode: plan image or blank
 * canvas) and the floor background dialog. `app` provides loadFloor(n),
 * save(extra), canvas and state.
 */

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

export function listedFloors() {
    return [...document.querySelectorAll('.floor-btn[data-floor]')]
        .map(b => parseInt(b.dataset.floor)).filter(n => !isNaN(n)).sort((a, b) => a - b);
}

export function addFloorButton(n) {
    const list = document.getElementById('floorList');
    const el = document.createElement('div');
    el.className = 'floor-btn';
    el.dataset.floor = String(n);
    el.textContent = `Floor ${n}`;
    list.insertBefore(el, document.getElementById('addFloorBtn'));
}

export function setActiveFloorButton(floorNum) {
    document.querySelectorAll('.floor-btn[data-floor]').forEach(b => {
        b.classList.toggle('active', b.dataset.floor == floorNum);
    });
}

/** Discover floors from the backend (or probe the static files) and build the buttons. */
export async function initFloors(app) {
    let floors = [];
    try {
        const data = await ApiManager.fetchFloors();
        if (data.success && Array.isArray(data.floors)) floors = data.floors;
        if (data.version) {
            const title = document.querySelector('#sidebar h1');
            if (title) title.title = `Dynamic Map v${data.version}`;
        }
    } catch (err) {
        console.warn('[editor] Floor discovery failed:', err.message);
    }
    if (!floors.length) {
        // Authenticated API unavailable (companion-app webview without a web
        // session): probe the public data files so the list still populates.
        const t = Date.now();
        const probes = await Promise.all([...Array(12)].map((_, i) =>
            fetch(`/dynamic_map_data/rooms_floor${i + 1}.json?t=${t}`, { method: 'HEAD' })
                .then(r => (r.ok ? i + 1 : null)).catch(() => null)));
        floors = probes.filter(Boolean);
    }
    if (!floors.length) floors = [1];
    document.querySelectorAll('.floor-btn[data-floor]').forEach(b => b.remove());
    floors.forEach(addFloorButton);
    const remembered = parseInt(localStorage.getItem('dm_editor_last_floor'));
    const startFloor = floors.includes(remembered) ? remembered : floors[floors.length - 1];
    setActiveFloorButton(startFloor);
    app.loadFloor(startFloor);
}

async function addFloor(app) {
    const existing = listedFloors();
    const suggested = (existing.length ? Math.max(...existing) : 0) + 1;
    const numStr = prompt('New floor number (used in filenames — e.g. 3 for a Terrace):', suggested);
    if (numStr === null) return;
    const n = parseInt(numStr);
    if (isNaN(n)) { alert('Please enter a number.'); return; }
    if (existing.includes(n)) { alert(`Floor ${n} already exists.`); return; }
    const useImage = confirm('OK = upload a floor-plan / background image.\nCancel = start with a blank canvas to draw rooms on.');
    let dataUrl;
    if (useImage) {
        dataUrl = await pickImageFile();
        if (!dataUrl) return;
    } else {
        dataUrl = makeBlankCanvas(1600, 1000, '#1e293b');
    }
    try {
        await ApiManager.saveImage(`bg_floor${n}.png`, dataUrl);
        await ApiManager.saveToHA(n, [], [], { rotation_mode: 'auto', flips: DEFAULT_FLIPS() });
        addFloorButton(n);
        setActiveFloorButton(n);
        app.loadFloor(String(n));
    } catch (err) {
        console.error('Add floor failed', err);
        alert('Failed to add floor: ' + err.message);
    }
}

/** Floor background: colour + mode stored in config_floorN.json. */
function bindBackgroundDialog(app) {
    const canvas = app.canvas;
    document.getElementById('bgColorBtn').addEventListener('click', () => {
        document.getElementById('bgModalColor').value = canvas.backgroundColor || '#1e293b';
        const mode = canvas.backgroundMode === 'fit' ? 'fit' : 'around';
        document.querySelectorAll('input[name="bgMode"]').forEach(r => { r.checked = (r.value === mode); });
        document.getElementById('bgModalStatus').textContent = '';
        document.getElementById('bgModal').style.display = 'flex';
    });
    document.getElementById('closeBgModalBtn').addEventListener('click', () => {
        document.getElementById('bgModal').style.display = 'none';
    });
    document.getElementById('bgModalSaveBtn').addEventListener('click', async () => {
        const status = document.getElementById('bgModalStatus');
        const color = document.getElementById('bgModalColor').value;
        const choice = document.querySelector('input[name="bgMode"]:checked')?.value || 'around';
        canvas.backgroundColor = color;
        canvas.backgroundMode = (choice === 'fit') ? 'fit' : 'image';
        try {
            status.textContent = 'Saving…';
            const w = canvas.imgW || 1600, h = canvas.imgH || 1000;
            const floor = app.state.activeFloor;
            if (choice === 'repaint') {
                await ApiManager.saveImage(`bg_floor${floor}.png`, makeBlankCanvas(w, h, color));
            } else if (choice === 'fit') {
                await ApiManager.saveImage(`bg_floor${floor}.png`, makeBlankCanvas(w, h, null));
            }
            await app.save({ background_color: color, background_mode: canvas.backgroundMode });
            document.getElementById('bgModal').style.display = 'none';
            if (choice !== 'around') app.loadFloor(String(floor));
        } catch (err) {
            status.textContent = `❌ ${err.message}`;
        }
    });
}

export function bindFloorControls(app) {
    document.getElementById('floorList').addEventListener('click', (e) => {
        const btn = e.target.closest('.floor-btn[data-floor]');
        if (btn) {
            setActiveFloorButton(btn.dataset.floor);
            app.loadFloor(parseInt(btn.dataset.floor));
            return;
        }
        if (e.target.closest('#addFloorBtn')) addFloor(app);
    });
    bindBackgroundDialog(app);
}
