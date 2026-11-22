import { describe, it, expect, vi } from 'vitest';
import { choreTint } from '../card/Chores.js';
import { buildChoresMode, setMapMode } from '../card/ChoresMode.js';
import { updateRoomStyles } from '../core/RoomStyles.js';
import { buildRoomPanelEl, updateRoomPanel } from '../card/RoomPanel.js';
import { onRoomTap } from '../card/RoomFocus.js';
import { lateChoreAreas } from '../card/LateChores.js';

const svgNS = 'http://www.w3.org/2000/svg';
const people = [{ id: 7, name: 'Costin' }];
const chore = (id, title, state, extra = {}) => ({ id, title, state, due: false, late_days: 0, due_on: '2026-11-30', ...extra });

function makeHass() {
    return {
        areas: {}, floors: {}, entities: {}, devices: {},
        states: {
            'sensor.crumbs_house_chores': { state: '3', attributes: { due: 1, late: [], areas: {
                kitchen: { room: 'Kitchen', emoji: '🍳', state: 'late', people, chores: [chore(1, 'Scrub counters', 'late', { late_days: 2 }), chore(2, 'Clean fridge', 'soon')] },
                office: { room: 'Office', state: 'late', people, chores: [chore(3, 'Tidy up', 'late', { late_days: 5 }), chore(4, 'Dust', 'done')] },
                second_floor: { room: 'Second floor', state: 'late', people, chores: [chore(5, 'Mop', 'late', { late_days: 1 })] },
                stairs: { room: 'Stairs', state: 'soon', people, chores: [chore(6, 'Dust and mop', 'soon')] }
            } } }
        },
        callService: vi.fn(() => Promise.resolve())
    };
}
const square = [[10, 10], [50, 10], [50, 30], [10, 30]];
const rooms = [
    { id: 'k', name: 'Kitchen', area_id: 'kitchen', polygon: square },
    { id: 's', name: 'Stairs', area_id: 'stairs', polygon: square }
];

function makeHost(hass, width = 1000) {
    const renderRoot = document.createElement('div');
    const mapRoot = document.createElementNS(svgNS, 'g');
    rooms.forEach(() => { const p = document.createElementNS(svgNS, 'polygon'); p.classList.add('room-polygon'); mapRoot.appendChild(p); });
    const host = Object.assign(new EventTarget(), {
        svgNS, renderRoot, topLeftUI: document.createElement('div'), mapRoot, rooms, imgW: 1000, imgH: 1000,
        config: {}, _hass: hass, activeFloor: '2', floorLabel: (n) => `Floor ${n}`,
        zoomOutToDefault: vi.fn(), zoomToRoom: vi.fn(), syncFocusPill: vi.fn(),
        getBoundingClientRect: () => ({ width, height: 600 })
    });
    host.roomTint = (room) => (host.mapMode === 'chores' ? choreTint(host, host._hass, room) : null);
    host.updateRoomStyles = () => updateRoomStyles(host);
    host.refreshRoomPanel = () => updateRoomPanel(host, host._hass);
    host.onRoomTap = (room) => onRoomTap(host, room);
    buildRoomPanelEl(host);
    buildChoresMode(host);
    setMapMode(host, 'chores');
    return host;
}
const lateChip = (host) => host.choresLegend.querySelector('.dm-cl-late');
const panelOpen = (host) => host.roomPanel.classList.contains('dm-visible');
const titles = (host) => [...host.roomPanel.querySelectorAll('.dm-chore-title')].map(t => t.textContent);

describe('late chores list', () => {
    it('collects late chores house-wide, most late first', () => {
        const host = makeHost(makeHass());
        expect(lateChoreAreas(host, host._hass).map(a => [a.key, a.chores.map(c => c.id)])).toEqual([['office', [3]], ['kitchen', [1]], ['second_floor', [5]]]);
    });

    it('legend says "N late" and "N soon"; the late chip opens the list docked, grouped by room, with Done buttons', () => {
        const hass = makeHass();
        const host = makeHost(hass);
        expect(host.choresLegend.textContent).toContain('3 late');
        expect(host.choresLegend.textContent).toContain('2 soon');
        expect(panelOpen(host)).toBe(false);
        lateChip(host).click();
        expect(panelOpen(host)).toBe(true);
        expect(host.renderRoot.classList.contains('dm-chores-dock')).toBe(true);
        expect(host.roomPanel.querySelector('.dm-rp-count').textContent).toBe('3 late');
        expect([...host.roomPanel.querySelectorAll('.dm-rp-subhead')].map(s => s.textContent)).toEqual(['Office', '🍳 Kitchen', 'Second floor']);
        expect(titles(host)).toEqual(['Tidy up', 'Scrub counters', 'Mop']);
        host.roomPanel.querySelector('.dm-chore-done').click();
        expect(hass.callService).toHaveBeenCalledWith('crumbs', 'complete_chore', { task_id: 3, done_by: 7 });
        expect(host.roomPanel.querySelector('.dm-chore-done').disabled).toBe(true);   // re-rendered busy
    });

    it('a room heading on this floor opens the room; ✕ and Lights mode close it; the floor chip replaces it', () => {
        const host = makeHost(makeHass(), 400);
        lateChip(host).click();
        const subs = [...host.roomPanel.querySelectorAll('.dm-rp-subhead')];
        expect(subs.map(s => s.classList.contains('dm-rp-link'))).toEqual([false, true, false]);
        subs[1].click();
        expect(host._roomPanelRoom).toBe(rooms[0]);
        expect(host._lateChoresOpen).toBe(false);
        const other = makeHost(makeHass());
        lateChip(other).click();
        other.roomPanel.querySelector('.dm-rp-close').click();
        expect(panelOpen(other)).toBe(false);
        expect(other.zoomOutToDefault).not.toHaveBeenCalled();
        lateChip(other).click();
        other.choresLegend.querySelector('.dm-cl-floor:not(.dm-cl-late)').click();
        expect(other.roomPanel.querySelector('.dm-rp-title').textContent).toBe('🏠 Second floor');
        lateChip(other).click();
        setMapMode(other, 'lights');
        expect(panelOpen(other)).toBe(false);
        setMapMode(other, 'chores');
        expect(panelOpen(other)).toBe(false);
    });

    it('no late chores: no chip', () => {
        const hass = makeHass();
        Object.values(hass.states['sensor.crumbs_house_chores'].attributes.areas).forEach(a => a.chores.forEach(c => { c.state = 'ok'; }));
        expect(lateChip(makeHost(hass))).toBe(null);
    });
});
