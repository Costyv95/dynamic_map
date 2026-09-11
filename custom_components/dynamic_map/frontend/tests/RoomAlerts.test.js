import { describe, it, expect, vi } from 'vitest';
import { roomAlerts, alertsSignature, buildRoomAlerts, updateRoomAlerts } from '../card/RoomAlerts.js';
import { buildTempLegend } from '../card/TempLegend.js';
import { buildQuickActions } from '../card/QuickActions.js';
import { collectQuickActions } from '../editor/ui/QuickActionsDialog.js';

const svgNS = 'http://www.w3.org/2000/svg';

function makeHass() {
    return {
        entities: { 'binary_sensor.door': { area_id: 'hall' }, 'binary_sensor.leak': { area_id: 'hall' }, 'binary_sensor.motion': { area_id: 'hall' }, 'light.hall': { area_id: 'hall' } },
        devices: {},
        states: {
            'binary_sensor.door': { state: 'on', attributes: { device_class: 'door', friendly_name: 'Front door' } },
            'binary_sensor.leak': { state: 'off', attributes: { device_class: 'moisture' } },
            'binary_sensor.motion': { state: 'on', attributes: { device_class: 'motion' } },
            'light.hall': { state: 'unavailable', attributes: { friendly_name: 'Hall light' } }
        }
    };
}
const room = { id: 'h', name: 'Hall', area_id: 'hall', polygon: [[10, 10], [50, 10], [50, 30], [10, 30]] };

describe('room alerts', () => {
    it('reports open doors, danger classes and unavailable devices, never motion', () => {
        const alerts = roomAlerts(makeHass(), room);
        expect(alerts.map(a => a.kind)).toEqual(['unavailable', 'open']);
        const h = makeHass();
        h.states['binary_sensor.leak'].state = 'on';
        expect(roomAlerts(h, room).some(a => a.kind === 'danger')).toBe(true);
        expect(roomAlerts(h, { id: 'x' })).toEqual([]);
    });

    it('renders a badge per room with alerts, coloured by severity, and hides it when clear', () => {
        const hass = makeHass();
        const mapRoot = document.createElementNS(svgNS, 'g');
        const host = { svgNS, mapRoot, rooms: [room], imgW: 1000, imgH: 1000, config: {}, isRotated: true, onRoomTap: vi.fn() };
        buildRoomAlerts(host);
        updateRoomAlerts(host, hass);
        const g = mapRoot.querySelector('.dm-room-alert');
        expect(g.querySelector('text').textContent).toBe('2');
        expect(g.querySelector('circle').getAttribute('fill')).toBe('#f59e0b');
        expect(g.getAttribute('transform')).toContain('rotate(-90)');
        g.dispatchEvent(new Event('click'));
        expect(host.onRoomTap).toHaveBeenCalledWith(room);
        hass.states['binary_sensor.leak'] = { state: 'on', attributes: { device_class: 'smoke' } };
        updateRoomAlerts(host, hass);
        expect(g.querySelector('circle').getAttribute('fill')).toBe('#ef4444');
        hass.states['binary_sensor.door'].state = 'off';
        hass.states['binary_sensor.leak'].state = 'off';
        hass.states['light.hall'].state = 'on';
        updateRoomAlerts(host, hass);
        expect(g.style.display).toBe('none');
        expect(alertsSignature({ config: { room_alerts: false }, rooms: [room] }, hass)).toBe('');
    });
});

describe('temperature legend and merged quick actions', () => {
    it('shows the legend only with room_temperature and labels the range', () => {
        const off = { renderRoot: document.createElement('div'), config: {} };
        buildTempLegend(off);
        expect(off.tempLegend).toBeNull();
        const on = { renderRoot: document.createElement('div'), config: { room_temperature: true, temperature_range: [18, 26] } };
        buildTempLegend(on);
        expect(on.tempLegend.textContent).toContain('18°');
        expect(on.tempLegend.textContent).toContain('26°');
    });

    it('merges YAML quick actions with the quick_actions.json items', () => {
        const host = { renderRoot: document.createElement('div'), config: { quick_actions: [{ entity: 'switch.a' }] }, quickActionItems: [{ name: 'Movie', service: 'scene.turn_on', data: { entity_id: 'scene.movie' } }], _hass: null };
        buildQuickActions(host);
        expect(host.renderRoot.querySelectorAll('.dm-quick-chip').length).toBe(2);
    });

    it('collects dialog rows into config entries and rejects bad JSON', async () => {
        const mod = await import('../editor/ui/QuickActionsDialog.js');
        expect(typeof mod.openQuickActionsDialog).toBe('function');
        const rows = document.createElement('div');
        expect(collectQuickActions(rows)).toEqual([]);
    });
});
