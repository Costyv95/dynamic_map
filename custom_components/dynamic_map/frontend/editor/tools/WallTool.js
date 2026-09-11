import { snapWallPoint, WALL_DEFAULT_THICKNESS, WALL_DEFAULT_COLOR } from '../../shared/WallGeometry.js?v=3.2.1';

/**
 * Walls layer: click to drop corners while drawing (axis-snapped unless
 * Shift; Enter commits, Escape cancels), drag a corner handle to reshape,
 * drag the body to move, click to select.
 */
export class WallTool {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state;
        this.mode = null;   // 'vertex' | 'body'
    }

    pct(pt) { return this.canvas.toPercent(pt.x, pt.y); }

    snapped(prev, raw, e) {
        return e.shiftKey ? raw : snapWallPoint(prev, raw, this.canvas.imgW, this.canvas.imgH);
    }

    onDown(e, hit, pt) {
        const state = this.state;
        if (state.drawingWall) {
            const raw = this.pct(pt);
            const prev = state.drawingWall[state.drawingWall.length - 1];
            state.drawingWall.push(this.snapped(prev, raw, e));
            state.requestDrawCallback();
            return true;
        }
        if (hit.kind === 'handle' && hit.handle === 'wall-vertex') {
            this.mode = 'vertex';
            this.vertexIdx = hit.vertexIdx;
            this.moved = false;
            return true;
        }
        if (hit.kind === 'wall') {
            state.selectedWallIdx = hit.wallIdx;
            state.selectedShortcutIdx = -1;
            state.selectedRooms = [];
            this.mode = 'body';
            this.last = pt;
            this.moved = false;
            state.updateUICallback();
            state.requestDrawCallback();
            return true;
        }
        if (state.selectedWallIdx !== -1) {
            state.selectedWallIdx = -1;
            state.updateUICallback();
            state.requestDrawCallback();
        }
        return false;
    }

    onHover(e, pt) {
        const state = this.state;
        if (!state.drawingWall) return;
        const raw = this.pct(pt);
        const prev = state.drawingWall[state.drawingWall.length - 1];
        const s = this.snapped(prev, raw, e);
        state.wallCursor = { x: (s[0] / 100) * this.canvas.imgW, y: (s[1] / 100) * this.canvas.imgH };
        state.requestDrawCallback();
    }

    onMove(e, pt) {
        const state = this.state;
        const sel = state.walls[state.selectedWallIdx];
        if (this.mode === 'vertex' && sel && sel.points[this.vertexIdx]) {
            const raw = this.pct(pt);
            // Snap against the neighbour so straight runs stay straight.
            const prev = sel.points[this.vertexIdx - 1] || sel.points[this.vertexIdx + 1];
            sel.points[this.vertexIdx] = this.snapped(prev, raw, e);
            this.moved = true;
            state.requestDrawCallback();
            return true;
        }
        if (this.mode === 'body' && sel) {
            const ddx = ((pt.x - this.last.x) / this.canvas.imgW) * 100;
            const ddy = ((pt.y - this.last.y) / this.canvas.imgH) * 100;
            sel.points = sel.points.map(([x, y]) => [x + ddx, y + ddy]);
            this.last = pt;
            this.moved = true;
            state.requestDrawCallback();
            return true;
        }
        return false;
    }

    onUp() {
        const was = this.mode;
        this.mode = null;
        if (!was) return false;
        if (this.moved) {
            this.state.saveState();
            this.state.updateUICallback();
        }
        this.state.requestDrawCallback();
        return true;
    }

    onKey(e) {
        const state = this.state;
        if (!state.drawingWall) return false;
        if (e.key === 'Enter') {
            if (state.drawingWall.length >= 2) {
                state.walls.push({
                    id: `wall_${Date.now()}`, points: state.drawingWall,
                    thickness: state.lastWallThickness || WALL_DEFAULT_THICKNESS,
                    color: state.lastWallColor || WALL_DEFAULT_COLOR
                });
                state.selectedWallIdx = state.walls.length - 1;
                state.saveState();
            }
        } else if (e.key !== 'Escape') {
            return false;
        }
        state.drawingWall = null;
        state.wallCursor = null;
        state.updateUICallback();
        state.requestDrawCallback();
        return true;
    }
}
