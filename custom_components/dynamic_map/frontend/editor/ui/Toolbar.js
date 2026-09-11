import { el, clear, segmented, iconButton } from './dom.js?v=3.2.1';
import { openOverflowMenu } from './OverflowMenu.js?v=3.2.1';

/**
 * Top toolbar: floors, layer, simulated layout + link, add menu, undo/redo,
 * save, and the overflow menu. `app` is the EditorApp; `sync()` re-reads
 * state after any change.
 */
export class Toolbar {
    constructor(root, app) {
        this.root = root;
        this.app = app;
        this.state = app.state;
        this.canvas = app.canvas;
        this.build();
    }

    build() {
        const { state, canvas, app } = this;
        clear(this.root);
        this.floorRow = el('div.dm-chip-row.dm-floors');
        this.layerSeg = segmented([
            { value: 'rooms', label: '🏠 Rooms', title: 'Draw and reshape rooms' },
            { value: 'objects', label: '📍 Objects', title: 'Interactive badges (lights, sensors, vacuum)' },
            { value: 'decor', label: '🪴 Decor', title: 'Scenery: furniture, plants (never clickable on the dashboard)' },
            { value: 'walls', label: '🧱 Walls', title: 'Architectural walls' }
        ], state.activeLayer, (v) => {
            state.setActiveLayer(v);
            if (v === 'walls' && !state.walls.length && !state.drawingWall) state.drawingWall = [];
            app.ui.refresh();
            state.requestDrawCallback();
        });
        this.layoutSeg = segmented([
            { value: 'horizontal', label: '🖥 Landscape', title: 'Edit the layout used on wide screens (TV, desktop)' },
            { value: 'vertical', label: '📱 Portrait', title: 'Edit the layout used on tall screens (phone upright)' }
        ], canvas.activeMode, (v) => app.setLayout(v));
        this.linkBtn = iconButton('🔗', '', () => app.setLinked(!canvas.linkOrientations));
        this.addBtn = el('button.primary', { type: 'button', title: 'Add to the active layer', onClick: () => this.onAdd() }, '＋ Add');
        this.undoBtn = iconButton('↩', 'Undo (Ctrl+Z)', () => state.undo());
        this.redoBtn = iconButton('↪', 'Redo (Ctrl+Shift+Z)', () => state.redo());
        this.saveBtn = el('button.primary', { type: 'button', title: 'Save this floor to Home Assistant', onClick: () => app.saveWithFeedback() }, '💾 Save');
        this.moreBtn = iconButton('⋯', 'More: rotation, flips, background, outside dashboard, recompute, YAML', (e) => openOverflowMenu(app, e.currentTarget));
        this.root.append(
            el('span.dm-brand', { title: 'Dynamic Map' }, 'Map'),
            this.floorRow, this.layerSeg, this.layoutSeg, this.linkBtn,
            el('span.dm-spacer'),
            this.addBtn, this.undoBtn, this.redoBtn, this.saveBtn, this.moreBtn
        );
        this.sync();
    }

    onAdd() {
        const { state, app } = this;
        switch (state.activeLayer) {
            case 'rooms': app.ui.toast('Shift-click on the map to place corners, Enter to close the room.'); break;
            case 'decor': app.addDecor(); break;
            case 'walls': state.drawingWall = []; state.selectedWallIdx = -1; app.ui.refresh(); state.requestDrawCallback(); break;
            default: app.addObject();
        }
    }

    setFloors(floors, active) {
        clear(this.floorRow);
        floors.forEach(f => this.floorRow.appendChild(el('button.dm-chip', {
            type: 'button', dataset: { floor: String(f) }, onClick: () => this.app.switchFloor(f)
        }, `Floor ${f}`)));
        this.floorRow.appendChild(el('button.dm-chip.dm-add-floor', { type: 'button', title: 'Add a floor from a plan image or a blank canvas', onClick: () => this.app.addFloor() }, '＋'));
        this.setActiveFloor(active);
    }

    setActiveFloor(active) {
        this.floorRow.querySelectorAll('[data-floor]').forEach(b => b.classList.toggle('active', b.dataset.floor === String(active)));
    }

    sync() {
        const { state, canvas } = this;
        this.layerSeg.set(state.activeLayer);
        this.layoutSeg.set(canvas.activeMode);
        const linked = canvas.linkOrientations !== false;
        this.linkBtn.textContent = linked ? '🔗' : '⛓️‍💥';
        this.linkBtn.classList.toggle('active', linked);
        this.linkBtn.title = linked
            ? 'Linked: moving and resizing applies to both layouts. Click to edit only the selected layout.'
            : 'Unlinked: edits apply to the selected layout only. Click to link both layouts again.';
        this.undoBtn.disabled = !state.historyManager.canUndo();
        this.redoBtn.disabled = !state.historyManager.canRedo();
        const addLabel = { rooms: '＋ Room', objects: '＋ Object', decor: '＋ Decor', walls: '＋ Wall' };
        this.addBtn.textContent = addLabel[state.activeLayer] || '＋ Add';
    }
}
