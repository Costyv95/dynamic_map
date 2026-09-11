import { el, clear, append } from './dom.js?v=3.2.1';
import { renderRoomPanel, renderRoomsOverview } from './RoomPanel.js?v=3.2.1';
import { renderShortcutPanel } from './ShortcutPanel.js?v=3.2.1';
import { renderWallPanel } from './WallPanel.js?v=3.2.1';
import { renderLayerList } from './LayerList.js?v=3.2.1';

/**
 * Contextual side panel: shows what is selected on the active layer. On
 * narrow screens it is a bottom sheet with a drag handle (collapsed /
 * half / expanded).
 */
export class Inspector {
    constructor(root, app) {
        this.root = root;
        this.app = app;
        this.state = app.state;
        this.handle = el('div.dm-inspector-handle', { onClick: () => this.cycle() }, el('span.dm-inspector-title', {}, 'Inspector'));
        this.body = el('div.dm-inspector-body');
        this.resizer = el('div.dm-inspector-resizer', { title: 'Drag to resize the panel' });
        root.append(this.resizer, this.handle, this.body);
        this.bindSheetDrag();
        this.bindWidthDrag();
    }

    /** Desktop: drag the panel's left edge to change its width (remembered). */
    bindWidthDrag() {
        const appRoot = this.root.closest('.dm-app') || this.root.parentElement;
        const saved = parseInt(localStorage.getItem('dm_inspector_w'));
        if (saved >= 260 && appRoot) appRoot.style.setProperty('--dm-inspector-w', `${saved}px`);
        let start = null;
        this.resizer.addEventListener('pointerdown', (e) => {
            start = { x: e.clientX, w: this.root.getBoundingClientRect().width };
            this.resizer.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        this.resizer.addEventListener('pointermove', (e) => {
            if (!start || !appRoot) return;
            const w = Math.max(260, Math.min(window.innerWidth * 0.6, start.w - (e.clientX - start.x)));
            appRoot.style.setProperty('--dm-inspector-w', `${Math.round(w)}px`);
        });
        this.resizer.addEventListener('pointerup', (e) => {
            if (!start) return;
            start = null;
            this.resizer.releasePointerCapture(e.pointerId);
            localStorage.setItem('dm_inspector_w', String(Math.round(this.root.getBoundingClientRect().width)));
            this.app.canvas.layout();
        });
    }

    cycle() {
        const r = this.root;
        if (r.classList.contains('dm-collapsed')) { r.classList.remove('dm-collapsed'); }
        else if (r.classList.contains('dm-expanded')) { r.classList.remove('dm-expanded'); r.classList.add('dm-collapsed'); }
        else { r.classList.add('dm-expanded'); }
        setTimeout(() => this.app.canvas.layout(), 220);
    }

    /** Swipe the handle up/down to expand/collapse the sheet. */
    bindSheetDrag() {
        let startY = null;
        this.handle.addEventListener('pointerdown', (e) => { startY = e.clientY; });
        this.handle.addEventListener('pointerup', (e) => {
            if (startY === null) return;
            const dy = e.clientY - startY;
            startY = null;
            if (Math.abs(dy) < 24) return;
            const r = this.root;
            if (dy < 0) { r.classList.remove('dm-collapsed'); if (!r.classList.contains('dm-expanded')) r.classList.add('dm-expanded'); }
            else { r.classList.remove('dm-expanded'); r.classList.add('dm-collapsed'); }
            setTimeout(() => this.app.canvas.layout(), 220);
        });
    }

    /** Open the sheet when something gets selected on a phone. */
    reveal() {
        if (this.root.classList.contains('dm-collapsed')) {
            this.root.classList.remove('dm-collapsed');
            setTimeout(() => this.app.canvas.layout(), 220);
        }
    }

    titleFor() {
        const { state } = this;
        if (state.selectedShortcutIdx !== -1 && state.shortcuts[state.selectedShortcutIdx]) return state.shortcuts[state.selectedShortcutIdx].name || 'Object';
        if (state.activeLayer === 'walls') return state.selectedWallIdx !== -1 ? `Wall ${state.selectedWallIdx + 1}` : 'Walls';
        if (state.selectedRooms.length === 1) return state.rooms[state.selectedRooms[0]]?.name || 'Room';
        if (state.selectedRooms.length > 1) return `${state.selectedRooms.length} rooms`;
        return { rooms: 'Rooms', objects: 'Objects', decor: 'Decor' }[state.activeLayer] || 'Inspector';
    }

    render() {
        const { state, app } = this;
        const ctx = app.ctx();
        // Keep the scroll position across re-renders of the same selection.
        const key = `${state.activeLayer}:${state.selectedShortcutIdx}:${state.selectedRooms.join(',')}:${state.selectedWallIdx}`;
        const scroll = this.lastKey === key ? this.root.scrollTop : 0;
        this.lastKey = key;
        clear(this.body);
        this.handle.querySelector('.dm-inspector-title').textContent = this.titleFor();

        let content;
        if (state.selectedShortcutIdx !== -1 && state.shortcuts[state.selectedShortcutIdx]) {
            content = renderShortcutPanel(ctx, state.shortcuts[state.selectedShortcutIdx]);
        } else if (state.activeLayer === 'walls') {
            content = renderWallPanel(ctx);
        } else if (state.activeLayer === 'rooms') {
            content = state.selectedRooms.length ? renderRoomPanel(ctx) : renderRoomsOverview(ctx);
        } else {
            content = renderLayerList(ctx, state.activeLayer);
        }
        append(this.body, content);
        this.root.scrollTop = scroll;
    }
}
