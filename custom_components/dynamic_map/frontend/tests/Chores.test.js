import { describe, it, expect, vi } from 'vitest';
import { roomChores, choreLevel, choreTint, choresSignature, sortedChores, lastDoneText, choreStatus, daysSince } from '../card/Chores.js';
import { buildChoresMode, updateChoresMode, setMapMode } from '../card/ChoresMode.js';
import { choresPanelBody } from '../card/ChoresPanel.js';
import { updateRoomStyles } from '../core/RoomStyles.js';
import { buildRoomPanelEl, updateRoomPanel } from '../card/RoomPanel.js';
import { onRoomTap, zoomToRoom } from '../card/RoomFocus.js';
import { chorePeople, selectedPerson } from '../card/ChoreWho.js';
import { choreKinds, choreObject, roomFurniture, roomSpots } from '../card/ChoreObjects.js';

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
        expect(host.choresLegend.textContent).toBe('1 late2 due today');
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
    it('lists chores with status, last done and one Done button for the selected person', async () => {
        const hass = makeHass(), host = makeHost(hass);
        const nodes = choresPanelBody(host, hass, rooms[0], NOW);
        const box = document.createElement('div');
        box.append(...nodes);
        expect(box.querySelector('.dm-rp-title').textContent).toBe('🍳 Kitchen');
        expect(box.querySelector('.dm-rp-count').textContent).toBe('3 to do');
        const rows = [...box.querySelectorAll('.dm-chore-row')];
        expect(rows.map(r => r.querySelector('.dm-chore-status').textContent)).toEqual(['3 d late', 'due today', 'in 5 d']);
        expect(rows[1].querySelector('.dm-chore-sub').textContent).toBe('last done 3 d ago · Diana');
        expect([...rows[0].querySelectorAll('.dm-chore-done')].map(b => b.textContent)).toEqual(['Done · Costin']);
        host._choreWho = '9';
        const box2 = document.createElement('div');
        box2.append(...choresPanelBody(host, hass, rooms[0], NOW));
        box2.querySelector('.dm-chore-done').click();
        expect(hass.callService).toHaveBeenCalledWith('crumbs', 'complete_chore', { task_id: 12, done_by: 9 });
        const again = document.createElement('div');
        again.append(...choresPanelBody(host, hass, rooms[0], NOW));
        const btn = again.querySelectorAll('.dm-chore-row')[0].querySelector('.dm-chore-done');
        expect([btn.textContent, btn.disabled]).toEqual(['✓ Diana', true]);
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

describe("who's doing it", () => {
    it('lists everyone once, starts on the first and remembers the pick per device', () => {
        localStorage.removeItem('dm-chores-who');
        const hass = makeHass(), host = makeHost(hass);
        buildRoomPanelEl(host);
        buildChoresMode(host);
        expect(chorePeople(host, hass).map(p => p.name)).toEqual(['Costin', 'Diana']);
        expect(host.choresWho.hidden).toBe(true);   // Lights mode
        setMapMode(host, 'chores');
        const chips = [...host.choresWho.querySelectorAll('.dm-who-chip')];
        expect(chips.map(c => [c.textContent, c.classList.contains('active')])).toEqual([['Costin', true], ['Diana', false]]);
        chips[1].click();
        expect(localStorage.getItem('dm-chores-who')).toBe('9');
        expect(host.choresWho.querySelector('.active').textContent).toBe('Diana');
        expect(selectedPerson(makeHost(hass), chorePeople(host, hass)).name).toBe('Diana');   // a fresh card on this device
        localStorage.setItem('dm-chores-who', '42');   // someone no longer listed
        expect(selectedPerson(makeHost(hass), chorePeople(host, hass)).name).toBe('Costin');
        localStorage.removeItem('dm-chores-who');
    });
});

describe('object checks', () => {
    it('reads furniture kinds from chore titles', () => {
        expect(choreKinds('Change bedsheets')).toEqual(['bed']);
        expect(choreKinds('Clean bedroom')).toEqual([]);
        expect(choreKinds('Clean tub')).toEqual(['bathtub']);
        expect(choreKinds('Organize closets')).toEqual(['wardrobe']);
        expect(choreKinds('Clean cushions')).toEqual(['sofa']);
        expect(choreKinds('Dust and clean window sill')).toEqual(['window']);
        expect(choreKinds('Tidy up')).toEqual([]);
    });

    it('picks the furniture in the room, preferring a shared name word', () => {
        const furniture = [{ id: 'a', name: 'Coffee table', kind: 'table' }, { id: 'b', name: 'Dining table', kind: 'dining_table' }];
        expect(choreObject({ title: 'Oil dining table' }, furniture).id).toBe('b');
        expect(choreObject({ title: 'Clean coffee table' }, furniture).id).toBe('a');
        expect(choreObject({ title: 'Clean fridge' }, furniture)).toBe(null);
    });

    function withFurniture(host) {
        host.shortcuts = [
            { id: 'f_ctr', name: 'Counter', config: { decor: true, furniture: 'counter' } },
            { id: 'f_bed', name: 'Bed', config: { decor: true, furniture: 'bed' } },
            { id: 'light', name: 'Lamp', config: {} },
            { id: 'f_win', name: 'Window', config: { decor: true, furniture: 'window' } },
            { id: 'f_box', name: 'Box', config: { decor: true, furniture: 'cabinet' } }
        ];
        host.shortcutElements = { f_ctr: { px: 200, py: 200 }, f_bed: { px: 900, py: 900 }, light: { px: 210, py: 210 }, f_win: { px: 300, py: 90 }, f_box: { px: 300, py: 90 } };
        return host;
    }

    it('only furniture whose centre is inside the room counts, windows and doors also in the wall', () => {
        const host = withFurniture(makeHost(makeHass()));
        expect(roomFurniture(host, rooms[0]).map(f => f.id)).toEqual(['f_ctr', 'f_win']);
    });

    it('marks every chore of every room in Chores mode: on its object, else under the room name', () => {
        const hass = makeHass();
        hass.states['sensor.crumbs_house_chores'].attributes.areas.kitchen.chores[0].title = 'Scrub counters';
        const host = withFurniture(makeHost(hass));
        buildRoomPanelEl(host);
        buildChoresMode(host);
        expect(host.choreObjects.children.length).toBe(0);
        setMapMode(host, 'chores');
        const marks = () => [...host.choreObjects.querySelectorAll('.dm-chore-obj')];
        expect(marks().map(c => [c.dataset.chore, c.dataset.object, c.dataset.state])).toEqual([
            ['13', 'room:k', 'ok'], ['11', 'f_ctr', 'soon'], ['21', 'room:l', 'soon'], ['12', 'room:k', 'late']]);   // urgent on top
        expect(marks()[1].getAttribute('transform')).toMatch(/^translate\(200\.0, 200\.0\)/);
        expect(marks().map(m => m.querySelector('text').textContent)).toEqual(['', '!', '!', '!']);
        expect(marks()[3].querySelector('circle').getAttribute('fill')).toBe('rgb(190, 30, 70)');
        const [ok, , , late] = marks();
        expect(late.getAttribute('transform')).not.toBe(ok.getAttribute('transform'));   // side by side under the name
        // On the overview a tap opens the room; in the open room it credits the picked person.
        marks()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).not.toHaveBeenCalled();
        expect(host._roomPanelRoom).toBe(rooms[0]);
        host._choreWho = '9';
        host.choreObjects.querySelector('[data-object="f_ctr"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hass.callService).toHaveBeenCalledWith('crumbs', 'complete_chore', { task_id: 11, done_by: 9 });
        expect(host.choreObjects.querySelector('[data-object="f_ctr"]').classList.contains('dm-busy')).toBe(true);
        host.zoomOutToDefault = () => { host._roomPanelRoom = null; };
        setMapMode(host, 'lights');
        expect(host.choreObjects.children.length).toBe(0);
    });

    it('wraps marks under the name to the room width', () => {
        const host = { imgW: 1000, imgH: 1000 };
        const spots = roomSpots(host, { polygon: [[0, 0], [5, 0], [5, 40], [0, 40]] }, 10, 5);   // 50 wide: 2 a row
        expect(new Set(spots.map(p => p.y)).size).toBe(3);
        expect(spots[0].x).toBeCloseTo(25 - 11.5);
        expect(spots[4].x).toBeCloseTo(25);
        const rotated = roomSpots({ ...host, isRotated: true }, { polygon: [[0, 0], [40, 0], [40, 5], [0, 5]] }, 10, 2);
        expect(rotated.map(p => p.x)).toEqual([226, 226]);   // screen-down is map +x when turned
        expect(rotated[0].y).toBeCloseTo(25 + 11.5);
    });
});

describe('docked chores panel', () => {
    function cameraHost(width, mode) {
        const host = makeHost(makeHass());
        host.mapMode = mode;
        host.getBoundingClientRect = () => ({ width, height: 600 });
        host.mapPointToView = (x, y) => ({ x, y });
        host.animateViewBox = vi.fn();
        return host;
    }

    it('frames the room beside the left column on a wide card in Chores mode only', () => {
        const wide = cameraHost(1000, 'chores');
        zoomToRoom(wide, rooms[0]);
        const lights = cameraHost(1000, 'lights');
        zoomToRoom(lights, rooms[0]);
        const a = wide._zoomTargetVb, b = lights._zoomTargetVb;
        expect(a.w / a.h).toBeCloseTo(1000 / 600, 5);   // still fills the card
        const dock = 340 / 1000;
        expect(a.x + a.w * dock).toBeLessThanOrEqual(100 + 1e-6);   // the room's left edge clears the column
        expect(b.x).toBeGreaterThan(a.x);
    });

    it('docks the panel with its width on wide cards and keeps the sheet on phones', () => {
        const hass = makeHass();
        const wide = makeHost(hass);
        wide.getBoundingClientRect = () => ({ width: 1000, height: 600 });
        buildRoomPanelEl(wide);
        buildChoresMode(wide);
        setMapMode(wide, 'chores');
        wide.onRoomTap(rooms[0]);
        expect(wide.renderRoot.classList.contains('dm-chores-dock')).toBe(true);
        expect(wide.renderRoot.style.getPropertyValue('--dm-dock-w')).toBe('340px');
        const phone = makeHost(hass);
        phone.getBoundingClientRect = () => ({ width: 400, height: 800 });
        buildRoomPanelEl(phone);
        buildChoresMode(phone);
        setMapMode(phone, 'chores');
        phone.onRoomTap(rooms[0]);
        expect(phone.renderRoot.classList.contains('dm-chores-dock')).toBe(false);
    });
});
