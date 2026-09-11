import { Toolbar } from './ui/Toolbar.js?v=3.2.1';
import { Inspector } from './ui/Inspector.js?v=3.2.1';
import { toast } from './ui/Dialog.js?v=3.2.1';
import { el } from './ui/dom.js?v=3.2.1';

/**
 * Owns the toolbar and the inspector and keeps them in step with the
 * state manager. `refresh()` is what the state manager calls as its
 * updateUICallback.
 */
export class EditorUI {
    constructor(app) {
        this.app = app;
        this.state = app.state;
        this.toolbar = new Toolbar(app.root.querySelector('#toolbar'), app);
        this.inspector = new Inspector(app.root.querySelector('#inspector'), app);
        this.status = el('div.dm-status', { hidden: true });
        app.container.appendChild(this.status);
        this._lastSel = null;
    }

    toast(message, kind = 'info') { toast(message, kind); }

    /** Re-render everything that reflects state. */
    refresh() {
        const { state } = this;
        if (!state.config?.states || state.previewStateIdx >= (state.shortcuts[state.selectedShortcutIdx]?.config?.states?.length ?? 0)) {
            if (state.previewStateIdx !== -1 && !state.shortcuts[state.selectedShortcutIdx]?.config?.states?.[state.previewStateIdx]) state.previewStateIdx = -1;
        }
        window.previewStateIdx = state.previewStateIdx;
        this.toolbar.sync();
        this.inspector.render();
        this.updateStatus();
        const sel = `${state.selectedShortcutIdx}:${state.selectedRooms.join(',')}:${state.selectedWallIdx}`;
        if (sel !== this._lastSel && (state.selectedShortcutIdx !== -1 || state.selectedRooms.length || state.selectedWallIdx !== -1)) this.inspector.reveal();
        this._lastSel = sel;
    }

    /** One-line hint over the map while a drawing tool is armed. */
    updateStatus() {
        const { state } = this;
        let text = null;
        if (state.drawingWall) text = state.drawingWall.length ? 'Click to add corners · Enter to finish · Esc to cancel' : 'Click on the map to start a wall';
        else if (state.drawingPolygon) text = `${state.drawingPolygon.length} corner${state.drawingPolygon.length === 1 ? '' : 's'} · Enter to close the room · Esc to cancel`;
        else if (state.activeLayer === 'rooms' && !state.rooms.length) text = 'Shift-click on the map to draw your first room';
        this.status.textContent = text || '';
        this.status.hidden = !text;
    }

    updateRotationUI() { this.toolbar.sync(); }
    updateSidebar() { this.refresh(); }
}
