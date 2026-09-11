import { DEFAULT_FLIPS } from '../core/Viewport.js?v=3.2.1';

/**
 * Floor discovery and per-floor data loading for the card. `host` is the
 * card element; results land on it (rooms, shortcuts, walls, flips…) and
 * end in host.buildSVG().
 */
export async function discoverFloors(host, hass) {
    host._needsFloorDiscovery = false;
    let floors = [1];
    try {
        const data = await hass.callApi('GET', 'dynamic_map/floors');
        if (data && data.floors && data.floors.length) floors = data.floors;
        if (data && data.names) host._floorNames = data.names;
    } catch (e) {
        console.warn('[custom-svg-map] Floor discovery failed, defaulting to floor 1', e);
    }
    host.config.floors = floors;
    const preferred = host.config.default_floor || host.config.floor;
    host.activeFloor = floors.includes(preferred) ? preferred : floors[0];
    host.loadData();
}

export function floorLabel(host, floorNum) {
    const names = host.config.floor_names || {};
    const stored = host._floorNames || {};
    return names[floorNum] || stored[String(floorNum)] || `Floor ${floorNum}`;
}

export async function loadData(host) {
    const floor = host.activeFloor;
    const requestId = ++host._loadSeq;
    const t = Date.now();
    const bgUrl = `/dynamic_map_data/bg_floor${floor}.png?t=${t}`;
    const fetchJson = async (url) => {
        try {
            const res = await fetch(url);
            return res.ok ? await res.json() : null;
        } catch (e) { return null; }
    };
    try {
        const [rooms, shortcuts, config, outside, quick] = await Promise.all([
            fetchJson(`/dynamic_map_data/rooms_floor${floor}.json?t=${t}`),
            fetchJson(`/dynamic_map_data/shortcuts_floor${floor}.json?t=${t}`),
            fetchJson(`/dynamic_map_data/config_floor${floor}.json?t=${t}`),
            fetchJson(`/dynamic_map_data/outside.json?t=${t}`),
            fetchJson(`/dynamic_map_data/quick_actions.json?t=${t}`)
        ]);
        host.quickActionItems = Array.isArray(quick) ? quick : [];
        if (requestId !== host._loadSeq) return; // superseded by a newer floor switch
        host.rooms = rooms || [];
        host.shortcuts = shortcuts || [];
        host.outsideItems = outside || [];
        const floorConfig = config || { rotation_mode: 'auto' };
        host.rotationMode = floorConfig.rotation_mode || 'auto';
        host.floorBgColor = floorConfig.background_color || null;
        host.floorBgMode = floorConfig.background_mode || 'image';
        host.walls = floorConfig.walls || [];
        host.flips = floorConfig.flips || DEFAULT_FLIPS();

        const img = new Image();
        const ready = (w, h) => {
            if (requestId !== host._loadSeq) return;
            host.imgW = w; host.imgH = h;
            host.buildSVG(bgUrl);
        };
        img.onload = () => ready(img.naturalWidth || 1000, img.naturalHeight || 1000);
        img.onerror = () => ready(1000, 1000);
        img.src = bgUrl;
    } catch (e) {
        console.error('Failed to load map data', e);
        host.renderRoot.innerHTML = `<div class="dm-error">Failed to load map data. Ensure rooms_floor${floor}.json exists in /config/dynamic_map_data/.</div>`;
    }
}
