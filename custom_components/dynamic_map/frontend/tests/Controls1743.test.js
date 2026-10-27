import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildRoomPanelEl, showRoomPanel } from '../card/RoomPanel.js';
import { OverlayManager } from '../card/OverlayManager.js';
import { showRoomSelectionUI } from '../card/overlay/roomSelection.js';
import { onClick } from '../shortcuts/ShortcutInteractions.js';
import { describeEntity, controlCall } from '../card/RoomEntities.js';
import { applyTypePreset } from '../editor/ui/Presets.js';

const preset = (type, entity_id) => { const sc = { entity_id, config: {} }; applyTypePreset(sc, type); return sc.config; };

// Five card controls that did something other than their label says (#1743).
afterEach(() => { document.body.innerHTML = ''; });

describe('card controls (#1743)', () => {
    it('All off covers lights past room_panel_max', () => {
        const entities = {}, states = {};
        for (let i = 1; i <= 14; i++) {
            entities[`light.l${i}`] = { area_id: 'big' };
            states[`light.l${i}`] = { state: i === 9 ? 'on' : 'off', attributes: {} };
        }
        const hass = { entities, devices: {}, states, callService: vi.fn() };
        const host = { renderRoot: document.createElement('div'), config: {}, _hass: hass, zoomOutToDefault: vi.fn(), dispatchEvent: vi.fn() };
        buildRoomPanelEl(host);
        showRoomPanel(host, { id: 'r', name: 'Big', area_id: 'big' });
        // Ids sort as strings (l1, l10..l14, l2..l9), so l9 is row 14, past the 12 shown.
        expect(host.roomPanel.textContent).not.toContain('light.l9');
        const off = host.roomPanel.querySelector('.dm-rp-alloff');
        expect(off.hidden).toBe(false);
        off.click();
        expect(hass.callService).toHaveBeenCalledWith('homeassistant', 'turn_off', { entity_id: ['light.l9'] });
    });

    it('the vacuum preset gives a room picker the card draws, and old VACUUM_ROOMS configs still draw one', () => {
        const vac = preset('vacuum', 'vacuum.robot');
        expect(vac.actions.map(a => a.type)).toContain('ROOM_SELECTOR');
        for (const type of ['ROOM_SELECTOR', 'VACUUM_ROOMS']) {
            const ctx = { renderRoot: document.createElement('div'), _hass: { callService: vi.fn() } };
            ctx.renderRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
            const sc = { entity_id: 'vacuum.robot', config: {} };
            OverlayManager.showActionMenu(ctx, { sc }, [{ type, trigger: 'overlay', action_entity: 'vacuum.robot' }], { clientX: 100, clientY: 100 });
            expect(ctx.activeOverlay.querySelector('.dm-rooms-btn'), type).toBeTruthy();
        }
    });

    it('Mop Only sets the Roborock mop mode before cleaning', () => {
        const hass = { entities: { 'vacuum.robot': { platform: 'roborock' } }, callService: vi.fn(() => Promise.resolve()) };
        const ctx = {
            renderRoot: document.createElement('div'), _hass: hass, isSelectingRooms: true, selectedRoomIds: ['kitchen'],
            selectionVacuumTarget: 'vacuum.robot', updateRoomStyles: vi.fn(),
            shortcutElements: { v: { sc: { entity_id: 'vacuum.robot', config: { room_mapping: { 16: 'kitchen' } } } } }
        };
        showRoomSelectionUI(ctx);
        ctx.roomSelectionUI.querySelectorAll('select')[1].value = 'mop';
        ctx.roomSelectionUI.querySelector('.dm-rs-start').click();
        const calls = hass.callService.mock.calls.map(c => `${c[0]}.${c[1]}`);
        expect(calls).toEqual(['roborock.vacuum_set_mop_mode', 'vacuum.set_fan_speed', 'vacuum.send_command']);
        expect(hass.callService.mock.calls[0][2]).toEqual({ entity_id: 'vacuum.robot', mop_mode: 'standard' });
        clearInterval(ctx.selectionInterval);
    });

    it('a sensor badge tap cycles its readings instead of calling sensor.toggle', () => {
        expect(preset('sensor', 'sensor.t').actions.some(a => a.trigger === 'tap')).toBe(false);
        const hass = { callService: vi.fn() };
        const host = {
            sc: { type: 'sensor', entity_id: 'sensor.t' },
            config: { humidity_entity: 'sensor.h', actions: [{ type: 'TOGGLE', trigger: 'tap', action_entity: 'sensor.t' }] },
            mapContext: { _hass: hass }, updateState: vi.fn()
        };
        onClick(host);
        expect(hass.callService).not.toHaveBeenCalled();
        expect(host.displayOverride).toMatchObject({ entity: 'sensor.h' });
    });

    it('the climate stepper stays in min..max and does nothing without a single target', () => {
        const hass = (attrs) => ({ states: { 'climate.ac': { state: 'cool', attributes: { target_temp_step: 0.5, min_temp: 16, max_temp: 30, ...attrs } } } });
        expect(controlCall(describeEntity(hass({ temperature: 30 }), 'climate.ac'), 'up').data.temperature).toBe(30);
        expect(controlCall(describeEntity(hass({ temperature: 16 }), 'climate.ac'), 'down').data.temperature).toBe(16);
        const none = describeEntity(hass({ temperature: null }), 'climate.ac');
        expect(none.value).toBe('cool');
        expect(controlCall(none, 'up')).toBe(null);
    });
});
