import { MapGeometry } from '../../shared/MapGeometry.js?v=3.2.1';
import { polygonArea, projectOnSegment } from '../HitTest.js?v=3.2.1';

/**
 * Rooms: select (Ctrl for multi), drag corners, insert a corner on an
 * edge, Alt/Ctrl-click to delete a corner, Shift-click to draw a new
 * polygon (Enter closes, Escape cancels), right-drag to split.
 */
export class RoomTool {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state;
        this.mode = null;  // 'vertex' | 'split'
    }

    pct(pt) { return this.canvas.toPercent(pt.x, pt.y); }

    onDown(e, hit, pt) {
        const state = this.state;
        if (e.button === 2) {
            if (state.isEditMode && state.selectedRooms.length === 1) {
                this.mode = 'split';
                state.splitStart = pt;
                state.isSplitting = false;
            }
            return true;
        }
        if (e.shiftKey && state.isEditMode) {
            if (!state.drawingPolygon) state.drawingPolygon = [];
            state.drawingPolygon.push(this.pct(pt));
            state.requestDrawCallback();
            return true;
        }
        if (hit.kind === 'handle' && hit.handle === 'vertex') {
            const poly = state.rooms[hit.roomIdx]?.polygon;
            if (!poly) return false;
            if ((e.altKey || e.ctrlKey || e.metaKey) && poly.length > 3) {
                poly.splice(hit.vertexIdx, 1);
                state.saveState();
                state.requestDrawCallback();
                return true;
            }
            this.mode = 'vertex';
            state.selectedVertex = { roomIdx: hit.roomIdx, vertexIdx: hit.vertexIdx };
            this.moved = false;
            return true;
        }
        if (hit.kind === 'handle' && hit.handle === 'edge') {
            const poly = state.rooms[hit.roomIdx]?.polygon;
            if (!poly) return false;
            const a = poly[hit.edgeIdx], b = poly[(hit.edgeIdx + 1) % poly.length];
            const p = projectOnSegment(this.pct(pt), a, b);
            const j = hit.edgeIdx + 1;
            poly.splice(j, 0, [p.x, p.y]);
            this.mode = 'vertex';
            state.selectedVertex = { roomIdx: hit.roomIdx, vertexIdx: j };
            this.moved = true;
            state.requestDrawCallback();
            return true;
        }
        return false;
    }

    onMove(e, pt) {
        const state = this.state;
        if (this.mode === 'split') {
            state.isSplitting = true;
            state.splitEnd = pt;
            state.requestDrawCallback();
            return true;
        }
        if (this.mode === 'vertex' && state.selectedVertex) {
            const { roomIdx, vertexIdx } = state.selectedVertex;
            const room = state.rooms[roomIdx];
            if (room && room.polygon && room.polygon[vertexIdx]) {
                room.polygon[vertexIdx] = this.pct(pt);
                this.moved = true;
                state.requestDrawCallback();
            }
            return true;
        }
        return false;
    }

    onUp() {
        const state = this.state;
        const was = this.mode;
        this.mode = null;
        if (was === 'split') {
            if (state.splitStart && state.splitEnd) this.split(state.selectedRooms[0], state.splitStart, state.splitEnd);
            state.isSplitting = false;
            state.splitStart = null;
            state.splitEnd = null;
            state.requestDrawCallback();
            return true;
        }
        if (was === 'vertex') {
            if (this.moved) { state.saveState(); state.updateUICallback(); }
            state.selectedVertex = null;
            state.requestDrawCallback();
            return true;
        }
        return false;
    }

    /** A tap (no drag) on the map: select the room under it, or clear. */
    onClick(e, hit, pt) {
        const state = this.state;
        const pctPos = this.pct(pt);
        let idx = -1;
        if (hit.kind === 'room') idx = state.rooms.findIndex(r => String(r.id) === hit.id);
        if (idx === -1) idx = state.rooms.findIndex(r => MapGeometry.isPointInPolygon(pctPos, r.polygon));
        if (idx !== -1) {
            if (state.isEditMode && (e.ctrlKey || e.metaKey)) {
                const i = state.selectedRooms.indexOf(idx);
                if (i === -1) state.selectedRooms.push(idx); else state.selectedRooms.splice(i, 1);
            } else {
                state.selectedRooms = [idx];
            }
            state.selectedShortcutIdx = -1;
        } else {
            state.selectedRooms = [];
        }
        state.updateUICallback();
        state.requestDrawCallback();
    }

    onKey(e) {
        const state = this.state;
        if (e.key === 'Enter' && state.drawingPolygon && state.drawingPolygon.length > 2) {
            if (polygonArea(state.drawingPolygon) < 1e-6) {
                state.drawingPolygon = null;
                state.requestDrawCallback();
                return true;
            }
            state.rooms.push({
                id: `room_${Date.now()}`, name: 'New Room', polygon: state.drawingPolygon,
                color: localStorage.getItem('lastRoomColor') || '#333333'
            });
            state.drawingPolygon = null;
            state.selectedRooms = [state.rooms.length - 1];   // open its panel right away
            state.selectedShortcutIdx = -1;
            state.saveState();
            state.updateUICallback();
            state.requestDrawCallback();
            return true;
        }
        if (e.key === 'Escape' && state.drawingPolygon) {
            state.drawingPolygon = null;
            state.requestDrawCallback();
            return true;
        }
        return false;
    }

    /** Cut a room in two along the line p1-p2 (map px) with PolyBool. */
    split(roomIdx, p1, p2) {
        const state = this.state;
        const room = state.rooms[roomIdx];
        if (!room || !window.PolyBool) return;
        const { imgW, imgH } = this.canvas;
        const polyWorld = room.polygon.map(pt => [(pt[0] / 100) * imgW, (pt[1] / 100) * imgH]);
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 10) return;
        const nx = -dy / len, ny = dx / len;
        const BIG = 10000;
        const box = [
            [p1.x - dx * BIG, p1.y - dy * BIG],
            [p1.x + nx * BIG - dx * BIG, p1.y + ny * BIG - dy * BIG],
            [p2.x + nx * BIG + dx * BIG, p2.y + ny * BIG + dy * BIG],
            [p2.x + dx * BIG, p2.y + dy * BIG]
        ];
        try {
            const pb1 = { regions: [polyWorld], inverted: false };
            const pbBox = { regions: [box], inverted: false };
            const cut1 = window.PolyBool.intersect(pb1, pbBox);
            const cut2 = window.PolyBool.difference(pb1, pbBox);
            if (!(cut1.regions.length && cut2.regions.length)) return;
            state.rooms.splice(roomIdx, 1);
            const add = (reg, part) => {
                if (MapGeometry.getPolygonArea(reg) <= 2.0) return;
                state.rooms.push({
                    id: `room_${Date.now()}_${part}`, name: `${room.name || 'Room'} Part ${part}`,
                    polygon: reg.map(pt => [(pt[0] / imgW) * 100, (pt[1] / imgH) * 100]),
                    color: room.color || localStorage.getItem('lastRoomColor') || '#333333'
                });
            };
            cut1.regions.forEach((reg, i) => add(reg, `A${i}`));
            cut2.regions.forEach((reg, i) => add(reg, `B${i}`));
            state.selectedRooms = [];
            state.saveState();
        } catch (err) {
            console.error('Split failed', err);
        }
    }
}
