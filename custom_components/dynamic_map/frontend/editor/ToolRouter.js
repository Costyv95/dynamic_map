import { describeTarget } from './HitTest.js?v=3.2.1';
import { ShortcutTool } from './tools/ShortcutTool.js?v=3.2.1';
import { RoomTool } from './tools/RoomTool.js?v=3.2.1';
import { WallTool } from './tools/WallTool.js?v=3.2.1';

const TAP_SLOP_PX = 5;

/**
 * Turns pointer/keyboard events on the editor SVG into tool calls. One
 * tool owns a gesture from pointerdown to pointerup; anything nobody
 * claims becomes a camera pan, and a pan that never moved is a tap that
 * selects a room or clears the selection.
 */
export class ToolRouter {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state;
        this.shortcutTool = new ShortcutTool(canvas, state);
        this.roomTool = new RoomTool(canvas, state);
        this.wallTool = new WallTool(canvas, state);
        this.active = null;
        this.panCandidate = null;
        this.bind();
    }

    bind() {
        const svg = this.canvas.svg;
        svg.addEventListener('contextmenu', e => e.preventDefault());
        svg.addEventListener('pointerdown', e => this.onPointerDown(e));
        svg.addEventListener('pointermove', e => this.onPointerMove(e));
        svg.addEventListener('pointerup', e => this.onPointerUp(e));
        svg.addEventListener('pointercancel', e => this.onPointerUp(e));
        document.addEventListener('keydown', e => this.onKeyDown(e));
    }

    tools() {
        return this.state.activeLayer === 'walls'
            ? [this.wallTool]
            : [this.shortcutTool, this.roomTool];
    }

    onPointerDown(e) {
        const canvas = this.canvas;
        canvas.camera.pointerDown(e);
        if (canvas.camera.pointers.size > 1) { this.active = null; this.panCandidate = null; return; }
        const hit = describeTarget(e.target);
        const pt = canvas.clientToMap(e.clientX, e.clientY);
        try { canvas.svg.setPointerCapture(e.pointerId); } catch (err) { /* jsdom */ }
        for (const tool of this.tools()) {
            if (tool.onDown(e, hit, pt)) {
                this.active = tool;
                e.preventDefault();
                return;
            }
        }
        this.active = null;
        this.panCandidate = { hit, pt, x: e.clientX, y: e.clientY };
        canvas.camera.startPan(e);
    }

    onPointerMove(e) {
        const canvas = this.canvas;
        if (canvas.camera.pinch) { canvas.camera.pointerMove(e); return; }
        const pt = canvas.clientToMap(e.clientX, e.clientY);
        if (this.active) {
            e.preventDefault();
            this.active.onMove(e, pt);
            return;
        }
        if (this.panCandidate) {
            if (canvas.camera.pointerMove(e)) e.preventDefault();
            return;
        }
        if (this.state.activeLayer === 'walls') this.wallTool.onHover(e, pt);
    }

    onPointerUp(e) {
        const canvas = this.canvas;
        const dragged = canvas.camera.pointerUp(e);
        try { canvas.svg.releasePointerCapture(e.pointerId); } catch (err) { /* jsdom */ }
        if (this.active) {
            this.active.onUp(e);
            this.active = null;
            return;
        }
        const cand = this.panCandidate;
        this.panCandidate = null;
        if (!cand || dragged) return;
        const moved = Math.hypot(e.clientX - cand.x, e.clientY - cand.y) > TAP_SLOP_PX;
        if (moved || e.button === 2) return;
        if (this.state.activeLayer !== 'walls') this.roomTool.onClick(e, cand.hit, cand.pt);
    }

    onKeyDown(e) {
        if (this.wallTool.onKey(e)) return;
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
        const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (ARROWS[e.key] && !typing && this.state.selectedShortcutIdx !== -1) {
            const step = e.shiftKey ? 10 : 1;
            if (this.shortcutTool.nudge(ARROWS[e.key][0] * step, ARROWS[e.key][1] * step)) e.preventDefault();
            return;
        }
        if (e.key === 'Escape' && !typing && !this.state.drawingPolygon && !this.state.drawingWall) {
            this.state.selectedShortcutIdx = -1;
            this.state.selectedRooms = [];
            this.state.selectedWallIdx = -1;
            this.state.updateUICallback();
            this.state.requestDrawCallback();
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (typing) return;
            if (this.state.deleteSelection()) e.preventDefault();
            return;
        }
        this.roomTool.onKey(e);
    }
}
