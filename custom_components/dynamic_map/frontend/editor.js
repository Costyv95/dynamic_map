import { ApiManager } from './shared/ApiManager.js?v=3.2.0';
import { CanvasEngine } from './editor/CanvasEngine.js?v=3.2.0';
import { EditorStateManager } from './editor/EditorStateManager.js?v=3.2.0';
import { EditorInteractionManager } from './editor/EditorInteractionManager.js?v=3.2.0';
import { EditorUIManager } from './editor/EditorUIManager.js?v=3.2.0';

console.log('[DynamicMapDebug] Active Map Editor Loaded (Version: 3.1.0)');

const DEBUG = false;
const dlog = (...args) => { if (DEBUG) console.log('[DynamicMapDebug]', ...args); };

const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const engine = new CanvasEngine(canvas, ctx);

let animationFrameId = null;

const stateManager = new EditorStateManager(
    () => uiManager.updateSidebar(),
    () => draw()
);

const uiManager = new EditorUIManager(stateManager, engine);
const interactionManager = new EditorInteractionManager(canvas, engine, stateManager);

window.togglePreviewState = function(idx) {
    const res = stateManager.togglePreviewState(idx);
    window.previewStateIdx = res;
    return res;
};

// Expose state for UI/draw
function draw() {
    engine.draw({
        bgImage: stateManager.bgImage,
        rooms: stateManager.rooms,
        selectedRooms: stateManager.selectedRooms,
        isSplitting: stateManager.isSplitting,
        splitStart: stateManager.splitStart,
        splitEnd: stateManager.splitEnd,
        shortcuts: stateManager.shortcuts,
        selectedShortcutIdx: stateManager.selectedShortcutIdx,
        previewStateIdx: stateManager.previewStateIdx,
        isTransitioning: stateManager.isTransitioning,
        isEditMode: stateManager.isEditMode,
        drawingPolygon: stateManager.drawingPolygon,
        requestDraw: () => draw()
    });
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(draw);
}

// Global hotkeys
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); stateManager.undo(); }
        if (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); stateManager.redo(); }
    }
});

// Setup Resizer
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
if (resizer) {
    let startX, startY, startW, startH;
    resizer.addEventListener('pointerdown', (e) => {
        const rect = sidebar.getBoundingClientRect();
        startW = rect.width; startH = rect.height;
        startX = e.clientX; startY = e.clientY;
        resizer.setPointerCapture(e.pointerId);
        resizer.classList.add('resizing');
        document.body.style.cursor = window.innerWidth <= 768 ? 'row-resize' : 'col-resize';
        e.preventDefault();
    });
    resizer.addEventListener('pointermove', (e) => {
        if (!resizer.hasPointerCapture(e.pointerId)) return;
        if (window.innerWidth <= 768) {
            const dy = e.clientY - startY;
            sidebar.style.height = `${Math.max(100, Math.min(window.innerHeight - 100, startH + dy))}px`;
            sidebar.style.maxHeight = 'none';
        } else {
            const dx = e.clientX - startX;
            sidebar.style.width = `${Math.max(200, Math.min(window.innerWidth - 200, startW + dx))}px`;
        }
        engine.resizeCanvas(stateManager);
        draw();
    });
    resizer.addEventListener('pointerup', (e) => {
        resizer.releasePointerCapture(e.pointerId);
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        engine.resizeCanvas(stateManager);
        draw();
    });
}

// Floor and Data loading
async function loadFloor(floorNum) {
    dlog(`loadFloor starting for Floor ${floorNum}...`);
    stateManager.activeFloor = floorNum;
    localStorage.setItem('dm_editor_last_floor', String(floorNum));
    stateManager.isTransitioning = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let imgLoaded = false;
    let dataLoaded = false;
    
    const checkAutoCrop = () => {
        dlog(`checkAutoCrop checking: imgLoaded=${imgLoaded}, dataLoaded=${dataLoaded}`);
        if (imgLoaded && dataLoaded) {
            try {
                dlog(`Calculating auto crop...`);
                engine.calculateAutoCrop(stateManager.bgImage, stateManager.rooms, true);
                uiManager.updateRotationUI();
                stateManager.isTransitioning = false;
                dlog(`Transition complete! Initializing map draw loop.`);
                draw();
            } catch (err) {
                console.error(`[DynamicMapDebug] Error during calculateAutoCrop:`, err);
                stateManager.isTransitioning = false;
                draw();
            }
        }
    };
    
    const bgUrl = `/dynamic_map_data/bg_floor${floorNum}.png?t=${Date.now()}`;
    dlog(`Setting up image handlers for: "${bgUrl}"`);
    
    stateManager.bgImage.onload = () => {
        // Synchronize .width/.height from intrinsic dimensions.
        // In iframe-sandboxed or shadow-DOM contexts, unattached Image elements
        // may report .width/.height as 0 even after load completes.
        // .naturalWidth/.naturalHeight always reflect the true pixel dimensions.
        const nw = stateManager.bgImage.naturalWidth;
        const nh = stateManager.bgImage.naturalHeight;
        if (nw > 0) stateManager.bgImage.width = nw;
        if (nh > 0) stateManager.bgImage.height = nh;
        dlog(`bgImage loaded successfully. Dimensions: ${nw}x${nh} (synced w=${stateManager.bgImage.width}, h=${stateManager.bgImage.height})`);
        imgLoaded = true;
        checkAutoCrop();
    };
    
    stateManager.bgImage.onerror = (err) => {
        console.error(`[DynamicMapDebug] bgImage FAILED to load. URL: "${bgUrl}"`, err);
        // Assign safe recovery dimensions so the editor canvas remains usable
        stateManager.bgImage.width = 1280;
        stateManager.bgImage.height = 1920;
        imgLoaded = true;
        checkAutoCrop();
    };
    
    // Set src after handlers are fully registered to avoid synchronous cache bugs
    stateManager.bgImage.src = bgUrl;
    
    try {
        dlog(`Fetching floor data for floor ${floorNum}...`);
        const data = await ApiManager.fetchFloorData(floorNum);
        dlog(`Floor data loaded. Rooms: ${data.rooms?.length || 0}, Shortcuts: ${data.shortcuts?.length || 0}`);
        stateManager.rooms = data.rooms || [];
        stateManager.shortcuts = data.shortcuts || [];
        
        if (data.config) {
            if (data.config.rotation_mode) engine.rotationMode = data.config.rotation_mode;
            if (data.config.flips) engine.flips = data.config.flips;
        } else {
            engine.rotationMode = 'auto';
            engine.flips = { horizontal: { h: false, v: false }, vertical: { h: false, v: false } };
        }
        stateManager.saveState();
        uiManager.updateSidebar();
        dataLoaded = true;
        checkAutoCrop();
    } catch (err) {
        console.error("[DynamicMapDebug] Failed to load floor JSON", err);
        // Force recovery on JSON failure
        stateManager.rooms = [];
        stateManager.shortcuts = [];
        dataLoaded = true;
        checkAutoCrop();
    }
}

// Floor switching + Add Floor (delegated so dynamically-added floors work)
document.getElementById('floorList').addEventListener('click', (e) => {
    const btn = e.target.closest('.floor-btn[data-floor]');
    if (btn) {
        setActiveFloorButton(btn.dataset.floor);
        loadFloor(parseInt(btn.dataset.floor));
        return;
    }
    if (e.target.closest('#addFloorBtn')) addFloor();
});

function setActiveFloorButton(floorNum) {
    document.querySelectorAll('.floor-btn[data-floor]').forEach(b => {
        b.classList.toggle('active', b.dataset.floor == floorNum);
    });
}

// Discover existing floors from the backend and build the switcher buttons.
async function initFloors() {
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
    if (!floors.length) floors = [1];

    document.querySelectorAll('.floor-btn[data-floor]').forEach(b => b.remove());
    floors.forEach(addFloorButton);

    const remembered = parseInt(localStorage.getItem('dm_editor_last_floor'));
    const startFloor = floors.includes(remembered) ? remembered : floors[floors.length - 1];
    setActiveFloorButton(startFloor);
    loadFloor(startFloor);
}

// --- Builder Mode: create a new floor without the DXF pipeline (e.g. a Terrace) ---
function pickImageFile() {
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
function makeBlankCanvas(w, h, color) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = color; cx.fillRect(0, 0, w, h);
    return c.toDataURL('image/png');
}
function addFloorButton(n) {
    const list = document.getElementById('floorList');
    const el = document.createElement('div');
    el.className = 'floor-btn';
    el.dataset.floor = String(n);
    el.textContent = `Floor ${n}`;
    list.insertBefore(el, document.getElementById('addFloorBtn'));
}
async function addFloor() {
    const existing = [...document.querySelectorAll('.floor-btn[data-floor]')]
        .map(b => parseInt(b.dataset.floor)).filter(x => !isNaN(x));
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
        await ApiManager.saveToHA(n, [], [], {
            rotation_mode: 'auto',
            flips: { horizontal: { h: false, v: false }, vertical: { h: false, v: false } }
        });
        addFloorButton(n);
        document.querySelectorAll('.floor-btn[data-floor]').forEach(b => b.classList.remove('active'));
        document.querySelector(`.floor-btn[data-floor="${n}"]`).classList.add('active');
        loadFloor(String(n));
    } catch (err) {
        console.error('Add floor failed', err);
        alert('Failed to add floor: ' + err.message);
    }
}

// Toolbar buttons
document.getElementById('undoBtn').addEventListener('click', () => stateManager.undo());
document.getElementById('redoBtn').addEventListener('click', () => stateManager.redo());

document.getElementById('exportJsonBtn').addEventListener('click', async () => {
    if (stateManager.selectedRooms.length === 1) uiManager.saveRoomName();
    const btn = document.getElementById('exportJsonBtn');
    btn.textContent = "Saving to HA...";
    try {
        await ApiManager.saveToHA(stateManager.activeFloor, stateManager.rooms, stateManager.shortcuts, {
            rotation_mode: engine.rotationMode, flips: engine.flips
        });
        btn.textContent = "✅ Saved to HA Successfully!";
    } catch (err) {
        btn.textContent = "❌ Save Failed";
    }
    setTimeout(() => { btn.textContent = "💾 Save JSON"; }, 3000);
});

document.getElementById('exportYamlBtn').addEventListener('click', () => {
    const floors = [...document.querySelectorAll('.floor-btn[data-floor]')]
        .map(b => parseInt(b.dataset.floor)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const vacuum = (stateManager.shortcuts || []).find(sc => sc.type === 'vacuum' && sc.entity_id);
    let yaml = `type: custom:custom-svg-map\ndefault_floor: ${stateManager.activeFloor}\n`;
    if (floors.length) yaml += `floors: [${floors.join(', ')}]\n`;
    if (vacuum) yaml += `vacuum_entity: ${vacuum.entity_id}\n`;
    document.getElementById('yamlOutput').value = yaml;
});

// Recompute Logic
async function loadAvailableFiles() {
    try {
        const data = await ApiManager.fetchAvailableFiles();
        if (data.success && data.files) {
            const svgSelect = document.getElementById('reconSvg');
            const dxfSelect = document.getElementById('reconDxf');
            svgSelect.innerHTML = '<option value="">-- Optional (Select SVG) --</option>';
            dxfSelect.innerHTML = '<option value="">-- Optional (Select DXF) --</option>';
            data.files.forEach(f => {
                if (f.endsWith('.svg')) svgSelect.innerHTML += `<option value="${f}">${f}</option>`;
                if (f.endsWith('.dxf')) dxfSelect.innerHTML += `<option value="${f}">${f}</option>`;
            });
        }
        if (data.success && data.icons) {
            const iconList = document.getElementById('iconList');
            if (iconList) {
                iconList.innerHTML = '';
                data.icons.forEach(iconPath => { iconList.innerHTML += `<option value="${iconPath}"></option>`; });
            }
        }
    } catch (err) {
        console.warn('[editor] Failed to load available files:', err.message);
    }
}

// ----- Outside Dashboard editor -----
// Manages the global outside.json: a fixed info bar (temperature, pollen,
// weather...) rendered at the top of the floorplan card.

function addOutsideRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'outside-row';
    row.style.cssText = 'display:flex; gap:5px; align-items:center;';
    row.innerHTML = `
        <input class="o-entity" list="entityList" placeholder="entity_id (e.g. sensor.outdoor_temp)" value="${item.entity_id || ''}" style="flex:3; margin:0; min-width:0;">
        <input class="o-icon" placeholder="🌡️" title="Icon (emoji, optional)" value="${item.icon || ''}" style="flex:0 0 44px; margin:0; text-align:center;">
        <input class="o-name" placeholder="Label" title="Small label under the value (optional)" value="${item.name || ''}" style="flex:2; margin:0; min-width:0;">
        <input class="o-unit" placeholder="Unit" title="Unit override (optional, blank = entity unit)" value="${item.unit !== undefined ? item.unit : ''}" style="flex:0 0 52px; margin:0;">
        <input class="o-attr" placeholder="Attr" title="Entity attribute to display instead of state (optional)" value="${item.attribute || ''}" style="flex:0 0 64px; margin:0;">
        <button class="o-del danger" title="Remove item" style="width:28px; height:28px; padding:0; margin:0; flex:none;">×</button>
    `;
    row.querySelector('.o-del').addEventListener('click', () => row.remove());
    document.getElementById('outsideRows').appendChild(row);
}

async function openOutsideModal() {
    const rows = document.getElementById('outsideRows');
    rows.innerHTML = '';
    document.getElementById('outsideStatus').textContent = '';
    const items = await ApiManager.fetchOutside();
    (items || []).forEach(addOutsideRow);
    if (!items || !items.length) addOutsideRow();
    document.getElementById('outsideModal').style.display = 'flex';
}

document.getElementById('outsideBtn').addEventListener('click', openOutsideModal);
document.getElementById('closeOutsideBtn').addEventListener('click', () => {
    document.getElementById('outsideModal').style.display = 'none';
});
document.getElementById('addOutsideRowBtn').addEventListener('click', () => addOutsideRow());
document.getElementById('saveOutsideBtn').addEventListener('click', async () => {
    const status = document.getElementById('outsideStatus');
    const items = [];
    document.querySelectorAll('#outsideRows .outside-row').forEach(row => {
        const entity = row.querySelector('.o-entity').value.trim();
        if (!entity) return;
        const item = { entity_id: entity };
        const icon = row.querySelector('.o-icon').value.trim();
        const name = row.querySelector('.o-name').value.trim();
        const unit = row.querySelector('.o-unit').value.trim();
        const attr = row.querySelector('.o-attr').value.trim();
        if (icon) item.icon = icon;
        if (name) item.name = name;
        if (unit) item.unit = unit;
        if (attr) item.attribute = attr;
        items.push(item);
    });
    try {
        status.textContent = 'Saving…';
        await ApiManager.saveOutside(items);
        status.textContent = `✅ Saved ${items.length} item${items.length === 1 ? '' : 's'}. Reload the dashboard to see the bar.`;
    } catch (err) {
        status.textContent = `❌ ${err.message}`;
    }
});

document.getElementById('toggleRecomputeBtn').addEventListener('click', () => {
    const p = document.getElementById('recomputePanel');
    const isHidden = p.style.display === 'none';
    p.style.display = isHidden ? 'block' : 'none';
    sessionStorage.setItem('recomputeOpen', isHidden ? 'true' : 'false');
});
document.getElementById('closeRecomputeBtn').addEventListener('click', () => {
    document.getElementById('recomputePanel').style.display = 'none';
    sessionStorage.setItem('recomputeOpen', 'false');
});

document.getElementById('deleteFloorBtn').addEventListener('click', async () => {
    const floorNum = document.getElementById('reconFloor').value;
    if (!confirm(`Are you sure you want to permanently delete Floor ${floorNum}?`)) return;
    const status = document.getElementById('recomputeStatus');
    status.textContent = "Deleting floor files...";
    try {
        const data = await ApiManager.deleteFloor(floorNum);
        if (data.success) {
            status.textContent = "✅ Floor deleted! Refreshing...";
            sessionStorage.setItem('recomputeOpen', 'true');
            setTimeout(() => window.location.reload(), 1500);
        } else { status.textContent = "❌ Error: " + data.error; }
    } catch (e) { status.textContent = "❌ Failed to connect to HA API."; }
});

document.getElementById('recomputeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('recomputeBtn');
    const status = document.getElementById('recomputeStatus');
    btn.disabled = true;
    status.textContent = "Processing... (This takes a few seconds)";
    try {
        const data = await ApiManager.recomputeFloor(
            document.getElementById('reconFloor').value,
            document.getElementById('reconSvg').value,
            document.getElementById('reconDxf').value
        );
        if (data.success) {
            status.textContent = "✅ Success! Refreshing Map...";
            sessionStorage.setItem('recomputeOpen', 'true');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            status.textContent = "❌ Error: " + data.error;
            btn.disabled = false;
        }
    } catch (err) {
        status.textContent = "❌ Failed to connect to HA API.";
        btn.disabled = false;
    }
});

// Registry logic
async function loadRegistry() {
    try {
        const data = await ApiManager.fetchRegistry();
        if (data.success) {
            stateManager.haAreas = data.areas;
            stateManager.haFloors = data.floors;
            const select = document.getElementById('roomArea');
            select.innerHTML = '<option value="">-- Unmapped --</option>';
            stateManager.haAreas.forEach(a => { select.innerHTML += `<option value="${a.id}">${a.name}</option>`; });
        }
    } catch (err) {
        console.warn('[editor] Failed to load HA registry:', err.message);
    }
}

document.getElementById('roomArea').addEventListener('change', (e) => {
    const area = stateManager.haAreas.find(a => a.id === e.target.value);
    if (area && area.default_light) {
        const entInput = document.getElementById('roomEntity');
        if (!entInput.value) entInput.value = area.default_light;
    }
});

if (sessionStorage.getItem('recomputeOpen') === 'true') {
    document.getElementById('recomputePanel').style.display = 'block';
}

function setupAutocomplete(inputId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;width:100%;';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement); wrapper.appendChild(dropdown);

    inputElement.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        dropdown.innerHTML = '';
        let filtered = stateManager.allEntities || [];
        if (val) filtered = filtered.filter(ent => ent.id.toLowerCase().includes(val) || ent.name.toLowerCase().includes(val));
        filtered = filtered.slice(0, 100);
        
        if (filtered.length === 0) { dropdown.style.display = 'none'; return; }
        
        filtered.forEach(ent => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = ent.name !== ent.id ? `${ent.name} (${ent.id})` : ent.id;
            item.onclick = () => {
                inputElement.value = ent.id;
                dropdown.style.display = 'none';
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            };
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    });
    document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) dropdown.style.display = 'none'; });
    inputElement.addEventListener('focus', () => inputElement.dispatchEvent(new Event('input', { bubbles: false })));
}

async function fetchAllEntities() {
    try {
        const data = await ApiManager.fetchEntities();
        if (data.success && data.entities) {
            stateManager.allEntities = data.entities;
            setupAutocomplete('roomEntity');
            setupAutocomplete('scEntity');
            // Native datalist used by action/condition entity inputs (list="entityList")
            const entityList = document.getElementById('entityList');
            if (entityList) {
                entityList.innerHTML = data.entities.map(ent => `<option value="${ent.id}"></option>`).join('');
            }
        }
    } catch (err) {
        console.warn('[editor] Failed to load entities for autocomplete:', err.message);
    }
}

loadRegistry();
loadAvailableFiles();
initFloors();
fetchAllEntities();

// Orientation Switcher Event Listeners
const canvasContainer = document.getElementById('canvas-container');

document.getElementById('toggleHorizontalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '100%';
    canvasContainer.style.margin = '0';
    
    document.getElementById('toggleHorizontalBtn').classList.add('active');
    document.getElementById('toggleVerticalBtn').classList.remove('active');
    
    engine.activeMode = 'horizontal';
    engine.resizeCanvas(stateManager);
    draw();
});

document.getElementById('toggleVerticalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    canvasContainer.style.width = '375px';
    canvasContainer.style.height = '667px';
    canvasContainer.style.margin = '0 auto';
    
    document.getElementById('toggleVerticalBtn').classList.add('active');
    document.getElementById('toggleHorizontalBtn').classList.remove('active');
    
    engine.activeMode = 'vertical';
    engine.resizeCanvas(stateManager);
    draw();
});
