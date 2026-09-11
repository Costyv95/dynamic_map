import { describe, it, expect, vi } from 'vitest';
import { zoomToRoom, sheetFraction } from '../card/RoomFocus.js';
import { buildRoomPanelEl, showRoomPanel } from '../card/RoomPanel.js';
import { applyAutoCrop } from '../card/CardViewport.js';

const room = { id: 'r', name: 'Bedroom', polygon: [[10, 10], [50, 10], [50, 40], [10, 40]] };
function host(width) {
    return { rooms: [room], imgW: 1000, imgH: 1000, config: {}, mapPointToView: (x, y) => ({ x, y }), getBoundingClientRect: () => ({ width, height: 800 }), animateViewBox: vi.fn(), renderRoot: document.createElement('div'), zoomOutToDefault: vi.fn(), _hass: { states: {}, entities: {} } };
}

describe('room panel as a phone bottom sheet', () => {
    it('keeps the room in the strip above the sheet: same width, taller viewBox, top aligned', () => {
        const wide = host(1200); wide.isNarrow = false;
        const phone = host(390); phone.isNarrow = true;
        zoomToRoom(wide, room);
        zoomToRoom(phone, room);
        const a = wide.animateViewBox.mock.calls[0][0], b = phone.animateViewBox.mock.calls[0][0];
        expect(sheetFraction(phone)).toBe(0.38);
        expect(sheetFraction({ ...phone, config: { room_panel: false } })).toBe(0);
        expect(b.y).toBeCloseTo(b.y, 5);
        // The room (y 100..400, centre 250) sits centred in the top 62%: the strip's centre is the room's centre.
        const stripCentre = b.y + (b.h * 0.62) / 2;
        expect(stripCentre).toBeCloseTo(250, 3);
        expect(a.y + a.h / 2).toBeCloseTo(250, 3);
    });

    it('the grip toggles expansion; swiping down when collapsed closes the panel', () => {
        const h = host(390);
        buildRoomPanelEl(h);
        showRoomPanel(h, { id: 'r', name: 'Bedroom', area_id: 'bed' });
        const grip = h.roomPanel.querySelector('.dm-rp-handle');
        expect(grip).toBeTruthy();
        grip.dispatchEvent(new MouseEvent('pointerdown', { clientY: 500 }));
        grip.dispatchEvent(new MouseEvent('pointerup', { clientY: 500 }));      // tap
        expect(h.roomPanel.classList.contains('dm-expanded')).toBe(true);
        grip.dispatchEvent(new MouseEvent('pointerdown', { clientY: 500 }));
        grip.dispatchEvent(new MouseEvent('pointerup', { clientY: 560 }));      // swipe down -> collapse
        expect(h.roomPanel.classList.contains('dm-expanded')).toBe(false);
        grip.dispatchEvent(new MouseEvent('pointerdown', { clientY: 500 }));
        grip.dispatchEvent(new MouseEvent('pointerup', { clientY: 560 }));      // again -> close
        expect(h.zoomOutToDefault).toHaveBeenCalled();
    });

    it('applyAutoCrop flags narrow cards on the render root', () => {
        const h = { ...host(390), rooms: [], syncFocusPill() {}, updateViewBox() {}, svg: null, rotationMode: 'auto', flips: null };
        h.roomPanel = null;
        applyAutoCrop(h);
        expect(h.isNarrow).toBe(true);
        expect(h.renderRoot.classList.contains('dm-narrow')).toBe(true);
    });
});
