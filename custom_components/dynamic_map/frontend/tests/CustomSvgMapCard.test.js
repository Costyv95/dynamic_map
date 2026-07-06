import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../custom-svg-map.js';

function makeCard() {
    const card = document.createElement('custom-svg-map');
    return card;
}

function makeHass() {
    return {
        states: {},
        callService: vi.fn(),
        callApi: vi.fn().mockResolvedValue({ success: true, floors: [1, 2], version: '3.1.0' }),
    };
}

describe('CustomSvgMap card', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false });
        global.requestAnimationFrame = vi.fn();
        global.cancelAnimationFrame = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('setConfig', () => {
        it('uses configured floors and default_floor immediately', () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({ floors: [1, 2, 3], default_floor: 2 });
            expect(card.activeFloor).toBe(2);
            expect(card.loadData).toHaveBeenCalled();
        });

        it('defers to floor discovery when no floors configured', () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({ default_floor: 2 });
            expect(card._needsFloorDiscovery).toBe(true);
            expect(card.loadData).not.toHaveBeenCalled();
        });
    });

    describe('discoverFloors', () => {
        it('fetches floors from the backend and honors default_floor', async () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({ default_floor: 2 });
            const hass = makeHass();
            await card.discoverFloors(hass);
            expect(hass.callApi).toHaveBeenCalledWith('GET', 'dynamic_map/floors');
            expect(card.config.floors).toEqual([1, 2]);
            expect(card.activeFloor).toBe(2);
            expect(card.loadData).toHaveBeenCalled();
        });

        it('falls back to floor 1 when discovery fails', async () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({});
            const hass = makeHass();
            hass.callApi.mockRejectedValue(new Error('nope'));
            await card.discoverFloors(hass);
            expect(card.config.floors).toEqual([1]);
            expect(card.activeFloor).toBe(1);
        });

        it('ignores a default_floor that does not exist', async () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({ default_floor: 9 });
            await card.discoverFloors(makeHass());
            expect(card.activeFloor).toBe(1);
        });
    });

    describe('floorLabel', () => {
        it('uses floor_names overrides with a Floor N fallback', () => {
            const card = makeCard();
            card.loadData = vi.fn();
            card.setConfig({ floors: [1, 2], floor_names: { 1: 'Ground', 2: 'Upstairs' } });
            expect(card.floorLabel(1)).toBe('Ground');
            expect(card.floorLabel(2)).toBe('Upstairs');
            card.setConfig({ floors: [1, 2] });
            expect(card.floorLabel(2)).toBe('Floor 2');
        });
    });

    describe('onRoomTap', () => {
        function tapSetup(config = {}) {
            const card = makeCard();
            card.loadData = vi.fn();
            card.updateRoomStyles = vi.fn();
            card.syncFocusPill = vi.fn();
            card.zoomToRoom = vi.fn();
            card.zoomOutToDefault = vi.fn();
            card.setConfig({ floors: [1], ...config });
            card._hass = makeHass();
            return card;
        }

        it('zooms into the room by default', () => {
            const card = tapSetup();
            const room = { id: 'r1', entity_id: 'light.desk' };
            card.onRoomTap(room);
            expect(card.zoomToRoom).toHaveBeenCalledWith(room);
            expect(card.focusedRoomId).toBe('r1');
            expect(card._hass.callService).not.toHaveBeenCalled();
        });

        it('zooms back out when tapping the focused room again', () => {
            const card = tapSetup();
            const room = { id: 'r1' };
            card.onRoomTap(room);
            card.onRoomTap(room);
            expect(card.zoomOutToDefault).toHaveBeenCalled();
        });

        it('zoom works without hass (static floorplan browsing)', () => {
            const card = tapSetup();
            card._hass = null;
            card.onRoomTap({ id: 'r1' });
            expect(card.zoomToRoom).toHaveBeenCalled();
        });

        it('toggles the room entity when configured', () => {
            const card = tapSetup({ room_tap_action: 'toggle' });
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk' });
            expect(card._hass.callService).toHaveBeenCalledWith('light', 'toggle', { entity_id: 'light.desk' });
        });

        it('toggle falls back to area lights when the room has only an area', () => {
            const card = tapSetup({ room_tap_action: 'toggle' });
            card.onRoomTap({ id: 'r1', area_id: 'office' });
            expect(card._hass.callService).toHaveBeenCalledWith('light', 'toggle', {}, { area_id: 'office' });
        });

        it('supports area_toggle explicitly', () => {
            const card = tapSetup({ room_tap_action: 'area_toggle' });
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk', area_id: 'office' });
            expect(card._hass.callService).toHaveBeenCalledWith('light', 'toggle', {}, { area_id: 'office' });
        });

        it('fires hass-more-info for more-info action', () => {
            const card = tapSetup({ room_tap_action: 'more-info' });
            const listener = vi.fn();
            card.addEventListener('hass-more-info', listener);
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk' });
            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls[0][0].detail).toEqual({ entityId: 'light.desk' });
            expect(card._hass.callService).not.toHaveBeenCalled();
        });

        it('does nothing at all for none action', () => {
            const card = tapSetup({ room_tap_action: 'none' });
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk' });
            expect(card._hass.callService).not.toHaveBeenCalled();
            expect(card.zoomToRoom).not.toHaveBeenCalled();
        });

        it('per-room tap_action overrides the card default', () => {
            const card = tapSetup({ room_tap_action: 'none' });
            card.onRoomTap({ id: 'r1', entity_id: 'switch.fan', tap_action: 'toggle' });
            expect(card._hass.callService).toHaveBeenCalledWith('switch', 'toggle', { entity_id: 'switch.fan' });
        });

        it('multi-select mode collects room ids instead of acting', () => {
            const card = tapSetup();
            card.isSelectingRooms = true;
            card.selectedRoomIds = [];
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk' });
            expect(card.selectedRoomIds).toEqual(['r1']);
            card.onRoomTap({ id: 'r1', entity_id: 'light.desk' });
            expect(card.selectedRoomIds).toEqual([]);
            expect(card._hass.callService).not.toHaveBeenCalled();
        });
    });

    describe('zoom camera', () => {
        it('mapPointToView is identity without a transform', () => {
            const card = makeCard();
            expect(card.mapPointToView(30, 40)).toEqual({ x: 30, y: 40 });
        });

        it('mapPointToView applies rotation around the transform center', () => {
            const card = makeCard();
            card.transformCenter = { cx: 50, cy: 50 };
            card.isRotated = true;
            card.mapScaleX = 1;
            card.mapScaleY = 1;
            expect(card.mapPointToView(60, 50)).toEqual({ x: 50, y: 60 });
        });

        it('mapPointToView applies flips before rotation', () => {
            const card = makeCard();
            card.transformCenter = { cx: 50, cy: 50 };
            card.isRotated = true;
            card.mapScaleX = -1;
            card.mapScaleY = 1;
            expect(card.mapPointToView(60, 50)).toEqual({ x: 50, y: 40 });
        });

        it('zoomToRoom targets a padded, aspect-corrected viewBox around the room', () => {
            const card = makeCard();
            card.imgW = 1000;
            card.imgH = 1000;
            card.vb = { x: 0, y: 0, w: 1000, h: 1000 };
            card.animateViewBox = vi.fn();
            // Room spanning 10%..30% horizontally, 10%..20% vertically
            card.zoomToRoom({ id: 'r1', polygon: [[10, 10], [30, 10], [30, 20], [10, 20]] });
            const target = card._zoomTargetVb;
            expect(target).toBeTruthy();
            // Center preserved
            expect(target.x + target.w / 2).toBeCloseTo(200);
            expect(target.y + target.h / 2).toBeCloseTo(150);
            // Padded beyond the raw 200-wide bbox, and square (jsdom rect is 0 → ratio 1)
            expect(target.w).toBeCloseTo(200 * 1.24);
            expect(target.h).toBeCloseTo(target.w);
            expect(card.animateViewBox).toHaveBeenCalledWith(target);
        });

        it('zoomOutToDefault clears focus and animates to the default view', () => {
            const card = makeCard();
            card.defaultVb = { x: 0, y: 0, w: 1000, h: 800 };
            card.vb = { x: 100, y: 100, w: 200, h: 160 };
            card.animateViewBox = vi.fn();
            card.updateRoomStyles = vi.fn();
            card.syncFocusPill = vi.fn();
            card.focusedRoomId = 'r1';
            card.zoomOutToDefault();
            expect(card.focusedRoomId).toBeNull();
            expect(card.animateViewBox).toHaveBeenCalledWith({ x: 0, y: 0, w: 1000, h: 800 });
        });

        it('onCameraReset clears focus after a manual zoom-out snap', () => {
            const card = makeCard();
            card.updateRoomStyles = vi.fn();
            card.syncFocusPill = vi.fn();
            card.focusedRoomId = 'r1';
            card.onCameraReset();
            expect(card.focusedRoomId).toBeNull();
            expect(card.syncFocusPill).toHaveBeenCalled();
        });
    });

    describe('loadData stale-response guard', () => {
        it('drops results of a superseded floor load', async () => {
            const card = makeCard();
            card.setConfig({ floors: [1, 2], default_floor: 1 });

            let resolveFirst;
            const firstRooms = new Promise((resolve) => { resolveFirst = resolve; });
            global.fetch = vi.fn()
                // First load (floor 1) hangs until we resolve it later
                .mockImplementationOnce(() => firstRooms)
                .mockResolvedValue({ ok: false });

            card.buildSVG = vi.fn();
            const first = card.loadData();

            // Second load supersedes the first
            card.activeFloor = 2;
            await card.loadData();

            resolveFirst({ ok: true, json: () => Promise.resolve([{ id: 'stale' }]) });
            await first;

            expect(card.rooms.find(r => r.id === 'stale')).toBeUndefined();
        });
    });
});
