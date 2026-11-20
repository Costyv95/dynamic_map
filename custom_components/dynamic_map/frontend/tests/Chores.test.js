import { describe, it, expect, vi } from 'vitest';
import { roomChores, choreLevel, choreTint, choresSignature, sortedChores, lastDoneText, choreStatus, daysSince } from '../card/Chores.js';
import { buildChoresMode, updateChoresMode, setMapMode } from '../card/ChoresMode.js';
import { choresPanelBody } from '../card/ChoresPanel.js';
import { updateRoomStyles } from '../core/RoomStyles.js';
import { buildRoomPanelEl, updateRoomPanel } from '../card/RoomPanel.js';
import { onRoomTap } from '../card/RoomFocus.js';

const svgNS = 'http://www.w3.org/2000/svg';
const NOW = new Date('2026-11-20T18:00:00');
const people = [{ id: 7, name: 'Costin' }, { id: 9, name: 'Diana' }];

function makeHass() {
    return {
        areas: { living_room: { name: 'Living Room' }, bath: { name: 'Bathroom' } },
        entities: {}, devices: {},
        states: {
            'sensor.crumbs_house_chores': { state: '1', attributes: { due: 2, areas: {
                kitchen: { room: 'Kitchen', emoji: '🍳', due: 2, overdue: 1, people, chores: [
                    { id: 11, title: 'Wipe counters', due: true, late_days: 0, due_on: '2026-11-20', last_done: '2026-11-17T09:00:00', last_done_by: 'Diana' },
                    { id: 12, title: 'Mop floor', due: true, late_days: 3, due_on: '2026-11-17', last_done: null, last_done_by: null },
                    { id: 13, title: 'Descale kettle', due: false, late_days: 0, due_on: '2026-11-25', last_done: '2026-11-19T20:00:00', last_done_by: 'Costin' }
                ] },
                'living room': { room: 'Living', due: 1, overdue: 0, people, chores: [{ id: 21, title: 'Dust', due: true, late_days: 0 }] },
                bathroom: { room: 'Bath', due: 0, overdue: 0, people, chores: [] }
            } } }
        },
        callService: vi.fn(() => Promise.resolve())
    };
}
const square = [[10, 10], [50, 10], [50, 30], [10, 30]];
const rooms = [
    { id: 'k', name: 'Kitchen', area_id: 'kitchen', polygon: square },
    { id: 'l', name: 'Lounge', area_id: 'living_room', polygon: square },
    { id: 'b', name: 'Bathroom', polygon: square },
    { id: 'o', name: 'Office', area_id: 'office', polygon: square }
];

function makeHost(hass, config = {}) {
    const renderRoot = document.createElement('div');
    const topLeftUI = document.createElement('div');
    const mapRoot = document.createElementNS(svgNS, 'g');
    rooms.forEach(() => { const p = document.createElementNS(svgNS, 'polygon'); p.classList.add('room-polygon'); mapRoot.appendChild(p); });
    const host = Object.assign(new EventTarget(), {
        svgNS, renderRoot, topLeftUI, mapRoot, rooms, imgW: 1000, imgH: 1000, config, _hass: hass,
        zoomOutToDefault: vi.fn(), zoomToRoom: vi.fn(), syncFocusPill: vi.fn()
    });
    host.roomTint = (room) => (host.mapMode === 'chores' ? choreTint(host, host._hass, room) : null);
    host.updateRoomStyles = () => updateRoomStyles(host);
    host.refreshRoomPanel = () => updateRoomPanel(host, host._hass);
    host.onRoomTap = (room) => onRoomTap(host, room);
    return host;
}

describe('chores data', () => {
    it('matches a room by area id, then by area name or room name, case-insensitively', () => {
        const hass = makeHass(), host = makeHost(hass);
        expect(roomChores(host, hass, rooms[0]).room).toBe('Kitchen');
        expect(roomChores(host, hass, rooms[1]).room).toBe('Living');   // HA area name "Living Room"
        expect(roomChores(host, hass, rooms[2]).room).toBe('Bath');     // room name, no area
        expect(roomChores(host, hass, rooms[3])).toBe(null);
        expect(roomChores(makeHost(hass, { chores: false }), hass, rooms[0])).toBe(null);
    });

    it('colours overdue, due and calm rooms; unlinked rooms get no tint', () => {
        const hass = makeHass(), host = makeHost(hass);
        expect(rooms.map(r => choreLevel(roomChores(host, hass, r)))).toEqual(['overdue', 'due', 'calm', null]);
        expect(choreTint(host, hass, rooms[3])).toBe(null);
        expect(choresSignature(host, hass)).toBe('');
        host.mapMode = 'chores';
        expect(choresSignature(host, hass)).toBe('c:overdue1/2|due0/1|calm0/0|-');
    });

    it('orders chores most late first, then due, then by next date', () => {
        expect(sortedChores(makeHass().states['sensor.crumbs_house_chores'].attributes.areas.kitchen).map(c => c.id)).toEqual([12, 11, 13]);
    });

    it('words last done and status in local days', () => {
        expect(daysSince('2026-11-17T09:00:00', NOW)).toBe(3);
        expect(daysSince('2026-11-25', NOW)).toBe(-5);
        expect(lastDoneText({ last_done: '2026-11-17T09:00:00', last_done_by: 'Diana' }, NOW)).toBe('last done 3 d ago · Diana');
        expect(lastDoneText({ last_done: '2026-11-19T23:00:00' }, NOW)).toBe('done yesterday');
        expect(lastDoneText({ last_done: null }, NOW)).toBe('never done');
        expect(choreStatus({ late_days: 3 }, NOW)).toEqual({ text: '3 d late', level: 'overdue' });
        expect(choreStatus({ due: true, late_days: 0 }, NOW).text).toBe('due today');
        expect(choreStatus({ due_on: '2026-11-21' }, NOW).text).toBe('tomorrow');
        expect(choreStatus({ due_on: '2026-11-25' }, NOW).text).toBe('in 5 d');
    });
});

describe('chores mode', () => {
    it('shows the switch once the sensor exists and counts overdue on the Chores chip', () => {
        const hass = makeHass(), host = makeHost(hass);
        buildChoresMode(host);
        expect(host.mapMode).toBe('lights');
        expect(host.modeToggle.hidden).toBe(false);   // hass was already there at build
        updateChoresMode(host, { states: {} });
        expect(host.modeToggle.hidden).toBe(true);
        updateChoresMode(host, hass);
        expect(host.modeToggle.hidden).toBe(false);
        expect(host.modeToggle.querySelector('[data-mode="chores"]').textContent).toBe('🧹 Chores1');
        expect(makeHost(hass, { mode_toggle: false }).modeToggle).toBe(undefined);
    });

    it('switching colours rooms by chores, drops light glow, badges due rooms and fires dm-mode-change', () => {
        const hass = makeHass(), host = makeHost(hass);
        buildChoresMode(host);
        const seen = vi.fn();
        host.addEventListener('dm-mode-change', (e) => seen(e.detail.mode));
        host.modeToggle.querySelector('[data-mode="chores"]').click();
        expect(seen).toHaveBeenCalledWith('chores');
        expect(host.renderRoot.classList.contains('dm-mode-chores')).toBe(true);
        const fills = [...host.mapRoot.querySelectorAll('polygon.room-polygon')].map(p => p.getAttribute('fill'));
        expect(fills[0]).toMatch(/^rgba\(190, 30, 70/);
        expect(fills[1]).toMatch(/^rgba\(245, 158, 11/);
        expect(fills[2]).toMatch(/^rgba\(34, 197, 94/);
        expect(fills[3]).toBe('rgba(0, 0, 0, 0)');
        const badges = [...host.choreBadges.querySelectorAll('.dm-chore-badge')].filter(g => g.style.display !== 'none');
        expect(badges.map(g => g.textContent)).toEqual(['3', '1']);
        expect(host.choresLegend.textContent).toBe('1 overdue2 due today');
        setMapMode(host, 'lights');
        expect(host.renderRoot.classList.contains('dm-mode-chores')).toBe(false);
        expect(host.choresLegend.hidden).toBe(true);
    });

    it('default_mode: chores starts in Chores', () => {
        const host = makeHost(makeHass(), { default_mode: 'chores' });
        buildChoresMode(host);
        expect(host.mapMode).toBe('chores');
    });
});

describe('chores panel', () => {
    it('lists chores with status, last done and a button per person that completes the chore', async () => {
        const hass = makeHass(), host = makeHost(hass);
        const nodes = choresPanelBody(host, hass, rooms[0], NOW);
        const box = document.createElement('div');
        box.append(...nodes);
        expect(box.querySelector('.dm-rp-title').textContent).toBe('🍳 Kitchen');
        expect(box.querySelector('.dm-rp-count').textContent).toBe('3 to do');
        const rows = [...box.querySelectorAll('.dm-chore-row')];
        expect(rows.map(r => r.querySelector('.dm-chore-status').textContent)).toEqual(['3 d late', 'due today', 'in 5 d']);
        expect(rows[1].querySelector('.dm-chore-sub').textContent).toBe('last done 3 d ago · Diana');
        rows[0].querySelectorAll('.dm-chore-done')[1].click();
        expect(hass.callService).toHaveBeenCalledWith('crumbs', 'complete_chore', { task_id: 12, done_by: 9 });
        const again = document.createElement('div');
        again.append(...choresPanelBody(host, hass, rooms[0], NOW));
        const btns = again.querySelectorAll('.dm-chore-row')[0].querySelectorAll('.dm-chore-done');
        expect([...btns].map(b => [b.textContent, b.disabled])).toEqual([['Costin', true], ['✓ Diana', true]]);
    });

    it('shows a refusal under the chore and frees the buttons', async () => {
        const hass = makeHass(), host = makeHost(hass);
        hass.callService = vi.fn(() => Promise.reject(new Error('Diana cannot be credited for this room')));
        const box = document.createElement('div');
        box.append(...choresPanelBody(host, hass, rooms[0], NOW));
        box.querySelector('.dm-chore-done').click();
        await new Promise(r => setTimeout(r, 0));
        const again = document.createElement('div');
        again.append(...choresPanelBody(host, hass, rooms[0], NOW));
        expect(again.querySelector('.dm-chore-error').textContent).toBe('Diana cannot be credited for this room');
        expect(again.querySelector('.dm-chore-done').disabled).toBe(false);
    });

    it('explains an unlinked room', () => {
        const hass = makeHass(), host = makeHost(hass);
        const box = document.createElement('div');
        box.append(...choresPanelBody(host, hass, rooms[3], NOW));
        expect(box.querySelector('.dm-rp-empty').textContent).toMatch(/Home Assistant area/);
    });

    it('a room tap in Chores mode zooms and opens the chores panel even with room_panel off or a toggle tap action', () => {
        const hass = makeHass(), host = makeHost(hass, { room_panel: false, room_tap_action: 'toggle' });
        buildRoomPanelEl(host);
        buildChoresMode(host);
        setMapMode(host, 'chores');
        host.onRoomTap(rooms[0]);
        expect(hass.callService).not.toHaveBeenCalled();
        expect(host.zoomToRoom).toHaveBeenCalledWith(rooms[0]);
        expect(host.roomPanel.querySelectorAll('.dm-chore-row').length).toBe(3);
    });
});
