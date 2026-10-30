import { describe, it, expect, vi, afterEach } from 'vitest';
import { OverlayManager } from '../card/OverlayManager.js';
import { showSchedulesSheet, daysLabel, scheduleSummary, schedulesFor } from '../card/overlay/vacuumSchedules.js';

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

const SCHED = [
    { id: 'b', entity_id: 'vacuum.r', enabled: true, time: '13:00', days: [1, 3], rooms: ['Kitchen'], mode: 'vac_mop', repeat: 1, suction: 'max', water: 'moderate', route: 'deep_plus' },
    { id: 'a', entity_id: 'vacuum.r', enabled: false, time: '10:00', days: [5, 6], rooms: [], mode: 'vacuum', repeat: 2 },
    { id: 'z', entity_id: 'vacuum.other', enabled: true, time: '09:00', days: [0], rooms: [], mode: 'mop', repeat: 1 }
];
const OFFER = { rooms: ['Kitchen', 'Bedroom'], suction: ['quiet', 'max'], water: ['low', 'high'], route: ['standard', 'deep_plus'] };

function setup() {
    const hass = {
        states: { 'sensor.vacuum_schedules': { state: '2', attributes: { schedules: SCHED, vacuums: { 'vacuum.r': OFFER } } } },
        callService: vi.fn(() => Promise.resolve())
    };
    const ctx = { renderRoot: document.createElement('div'), _hass: hass };
    document.body.appendChild(ctx.renderRoot);
    return { hass, ctx, ui: showSchedulesSheet(ctx, 'vacuum.r') };
}

describe('vacuum schedules sheet', () => {
    it('labels days and summarises a schedule', () => {
        expect(daysLabel([0, 1, 2, 3, 4])).toBe('Weekdays');
        expect(daysLabel([6, 5])).toBe('Weekends');
        expect(daysLabel([1, 3])).toBe('Tue Thu');
        expect(scheduleSummary(SCHED[1])).toBe('Whole house · Vacuum only · 2×');
        expect(schedulesFor({ states: {} }, 'vacuum.r').available).toBe(false);
    });

    it('lists only this vacuum\'s schedules, by time', () => {
        const { ui } = setup();
        const rows = [...ui.querySelectorAll('.dm-sc-when')].map(e => e.textContent);
        expect(rows).toEqual(['10:00 · Weekends', '13:00 · Tue Thu']);
    });

    it('the switch enables and disables through the save service', () => {
        const { ui, hass } = setup();
        ui.querySelector('.dm-ov-switch').click();
        expect(hass.callService).toHaveBeenCalledWith('dynamic_map', 'save_vacuum_schedule', { id: 'a', enabled: true });
    });

    it('delete needs a second tap', () => {
        const { ui, hass } = setup();
        const del = ui.querySelector('.dm-sc-del');
        del.click();
        expect(hass.callService).not.toHaveBeenCalled();
        del.click();
        expect(hass.callService).toHaveBeenCalledWith('dynamic_map', 'delete_vacuum_schedule', { id: 'a' });
    });

    it('adds a schedule with the picked days, rooms and modes', async () => {
        const { ui, hass } = setup();
        [...ui.querySelectorAll('button')].find(b => b.textContent.includes('Add schedule')).click();
        const chips = [...ui.querySelectorAll('.dm-sc-chip')];
        chips.slice(0, 5).forEach(c => c.click());           // drop Mon-Fri: weekends stay
        chips.find(c => c.textContent === 'Bedroom').click();
        const selects = ui.querySelectorAll('select');
        selects[1].value = 'max';
        [...ui.querySelectorAll('button')].find(b => b.textContent === 'Save').click();
        expect(hass.callService).toHaveBeenCalledWith('dynamic_map', 'save_vacuum_schedule', expect.objectContaining({
            time: '10:00', days: [5, 6], rooms: ['Bedroom'], entity_id: 'vacuum.r', mode: 'vac_mop',
            suction: 'max', water: null, enabled: true, repeat: 1
        }));
        await Promise.resolve(); await Promise.resolve();
        expect(ui.querySelector('.dm-sc-list')).toBeTruthy();
    });

    it('editing keeps saved modes the robot has not offered yet', () => {
        const { ui, hass } = setup();
        hass.states['sensor.vacuum_schedules'].attributes.vacuums = {};
        ui.querySelectorAll('.dm-sc-text')[1].click();
        const selects = ui.querySelectorAll('select');
        expect([...selects].slice(1, 4).map(s => s.value)).toEqual(['max', 'moderate', 'deep_plus']);
    });

    it('a VACUUM_SCHEDULES menu button opens the sheet', () => {
        const ctx = { renderRoot: document.createElement('div'), _hass: { states: {}, callService: vi.fn() } };
        ctx.renderRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
        OverlayManager.showActionMenu(ctx, { sc: { entity_id: 'vacuum.r', config: {} } },
            [{ type: 'VACUUM_SCHEDULES', trigger: 'long_press', action_entity: 'vacuum.r' }], { clientX: 50, clientY: 50 });
        ctx.activeOverlay.querySelector('.dm-rooms-btn').click();
        expect(ctx.renderRoot.querySelector('.dm-sched')).toBeTruthy();
        expect(ctx.activeOverlay).toBeNull();
    });
});
