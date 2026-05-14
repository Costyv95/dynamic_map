import { ApiManager } from './shared/ApiManager.js?v=2.68';
import { CanvasEngine } from './editor/CanvasEngine.js?v=2.68';
import { EditorStateManager } from './editor/EditorStateManager.js?v=2.68';
import { EditorInteractionManager } from './editor/EditorInteractionManager.js?v=2.68';
import { EditorUIManager } from './editor/EditorUIManager.js?v=2.68';

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
    return stateManager.togglePreviewState(idx);
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
        isTransitioning: stateManager.isTransitioning
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
    stateManager.activeFloor = floorNum;
    stateManager.isTransitioning = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let imgLoaded = false;
    let dataLoaded = false;
    
    const checkAutoCrop = () => {
        if (imgLoaded && dataLoaded) {
            engine.calculateAutoCrop(stateManager.bgImage, stateManager.rooms, true);
            uiManager.updateRotationUI();
            stateManager.isTransitioning = false;
            draw();
        }
    };
    
    stateManager.bgImage.src = `/dynamic_map_data/bg_floor${floorNum}.png?t=${Date.now()}`;
    stateManager.bgImage.onload = () => { imgLoaded = true; checkAutoCrop(); };
    
    try {
        const data = await ApiManager.fetchFloorData(floorNum);
        stateManager.rooms = data.rooms;
        stateManager.shortcuts = data.shortcuts;
        
        if (data.config) {
            if (data.config.rotation_mode) engine.rotationMode = data.config.rotation_mode;
            if (data.config.flips) engine.flips = data.config.flips;
        } else {
            engine.rotationMode = 'horizontal';
            engine.flips = { horizontal: { h: false, v: false }, vertical: { h: false, v: false } };
        }
        stateManager.saveState();
        uiManager.updateSidebar();
        dataLoaded = true;
        checkAutoCrop();
    } catch (err) {
        console.error("Failed to load floor JSON", err);
    }
}

document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadFloor(e.target.dataset.floor);
    });
});

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
    document.getElementById('yamlOutput').value = `type: custom:custom-svg-map\nvacuum_entity: vacuum.roborock_s7\ndefault_floor: ${stateManager.activeFloor}\nfloors: [1, 2]\n`;
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
    } catch (err) { }
}

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
    } catch (err) { }
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
    dropdown.style.cssText = 'position:absolute;background:#fff;border:1px solid #cbd5e1;border-radius:4px;max-height:200px;overflow-y:auto;display:none;z-index:9999;width:100%;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';
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
            item.textContent = ent.name !== ent.id ? `${ent.name} (${ent.id})` : ent.id;
            item.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:12px;color:#000;font-weight:500;';
            item.onmouseover = () => { item.style.background = '#e0f2fe'; item.style.color = '#0284c7'; };
            item.onmouseout = () => { item.style.background = '#fff'; item.style.color = '#000'; };
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
        }
    } catch (err) { }
}

loadRegistry();
loadAvailableFiles();
loadFloor(2);
fetchAllEntities();
