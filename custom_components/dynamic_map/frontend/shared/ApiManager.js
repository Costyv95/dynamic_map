import { apiFetch, apiJson, postJson, setPanelHass, usesPanelHass } from './HassApi.js?v=3.2.1';

const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log('[ApiManager]', ...args); };

/** Merge a {segmentId: name|{name}} mapping into segmentMap / originalNames. */
function collectSegments(rawAttr, segmentMap, originalNames) {
    if (!rawAttr || typeof rawAttr !== 'object' || Array.isArray(rawAttr)) return;
    for (const [segId, value] of Object.entries(rawAttr)) {
        const name = typeof value === 'object' ? value.name : value;
        if (!name) continue;
        segmentMap[String(name).toLowerCase()] = parseInt(segId);
        segmentMap[String(name)] = parseInt(segId);
        if (!originalNames.includes(String(name))) originalNames.push(String(name));
    }
}

/** Deep-copy `value` without any key that starts with '_'. */
export function stripRuntimeKeys(value) {
    return JSON.parse(JSON.stringify(value, (key, v) => (typeof key === 'string' && key.startsWith('_') ? undefined : v)));
}

export class ApiManager {
    /** Custom panel mode: route API calls through hass.fetchWithAuth (no token juggling). */
    static setHass(hass) { setPanelHass(hass); }
    static get usesPanelHass() { return usesPanelHass(); }

    static async fetchState(entityId) {
        try {
            const data = await apiJson(`/api/dynamic_map/state?entity_id=${encodeURIComponent(entityId)}`);
            return data.success ? data : null;
        } catch (e) {
            log('fetchState failed', entityId, e);
            return null;
        }
    }

    static async fetchVacuumRooms(entityId) {
        let roomsFound = [];
        const segmentMap = {};
        const originalNames = [];

        log(`Fetching vacuum rooms for ${entityId}...`);
        try {
            // 1. Segment IDs from the vacuum entity attributes
            const vacuumState = await ApiManager.fetchState(entityId);
            if (vacuumState && vacuumState.attributes) {
                const attrs = vacuumState.attributes;
                collectSegments(attrs.rooms || attrs.room_mapping || attrs.room_mapping_dict, segmentMap, originalNames);
            }

            // 2. Fall back to map-camera entity attributes
            const baseName = entityId.startsWith('vacuum.') ? entityId.replace('vacuum.', '') : null;
            if (Object.keys(segmentMap).length === 0 && baseName) {
                for (const camName of [`camera.${baseName}_map`, `camera.roborock_map`, `camera.${baseName}_floormap`]) {
                    const camState = await ApiManager.fetchState(camName);
                    if (camState && camState.attributes) {
                        collectSegments(camState.attributes.rooms, segmentMap, originalNames);
                    }
                }
            }

            // 3. Fall back to the roborock.get_maps service proxy
            if (Object.keys(segmentMap).length === 0) {
                const rbData = await apiJson(`/api/dynamic_map/roborock_rooms?entity_id=${encodeURIComponent(entityId)}`);
                if (rbData.success && rbData.data) {
                    // Shape: { "vacuum.x": { "maps": [ { "rooms": { "16": "Kitchen" } } ] } }
                    const walk = (obj) => {
                        if (!obj || typeof obj !== 'object') return;
                        collectSegments(obj.rooms, segmentMap, originalNames);
                        Object.values(obj).forEach(walk);
                    };
                    walk(rbData.data);
                }
            }

            log('Extracted segment map:', segmentMap);

            // 4. Room names tracked by the current_room sensor, mapped to segments
            if (baseName) {
                const roomState = await ApiManager.fetchState(`sensor.${baseName}_current_room`);
                const options = roomState && roomState.attributes && roomState.attributes.options;
                if (Array.isArray(options)) {
                    roomsFound = options.map(o => {
                        const segId = segmentMap[o] !== undefined ? segmentMap[o]
                            : (segmentMap[String(o).toLowerCase()] !== undefined ? segmentMap[String(o).toLowerCase()] : "");
                        return { id: o, name: o, segId };
                    });
                }
            }

            // 5. No sensor options: use the segment names directly
            if (roomsFound.length === 0 && originalNames.length > 0) {
                roomsFound = originalNames.map(name => ({ id: name, name, segId: segmentMap[name] }));
            }
        } catch (e) {
            console.error('[ApiManager] Failed to fetch vacuum rooms', e);
        }

        // Last resort: Roborock segments conventionally start at 16
        if (roomsFound.length === 0) {
            for (let i = 16; i <= 25; i++) roomsFound.push({ id: `Room ${i}`, name: `Room ${i}`, segId: i });
        }
        log('Rooms found:', roomsFound);
        return roomsFound;
    }

    static async fetchFloorData(floorNum) {
        const t = Date.now();
        let rooms = [];
        let shortcuts = [];
        let config = { rotation_mode: 'auto', horizontal_flip: false, vertical_flip: false };

        const fetchJson = async (url) => {
            try {
                const res = await fetch(url);
                return res.ok ? await res.json() : null;
            } catch (e) {
                return null;
            }
        };

        rooms = (await fetchJson(`/dynamic_map_data/rooms_floor${floorNum}.json?t=${t}`)) || [];
        shortcuts = (await fetchJson(`/dynamic_map_data/shortcuts_floor${floorNum}.json?t=${t}`)) || [];
        const savedConfig = await fetchJson(`/dynamic_map_data/config_floor${floorNum}.json?t=${t}`);
        if (savedConfig) config = { ...config, ...savedConfig };

        return { rooms, shortcuts, config };
    }

    /** Global outside-dashboard items (fixed bar at the top of the card). */
    /** A global list file (outside.json, quick_actions.json); [] when missing. */
    static async fetchGlobalList(filename) {
        try {
            const res = await fetch(`/dynamic_map_data/${filename}?t=${Date.now()}`);
            const data = res.ok ? await res.json() : [];
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    static async saveGlobalList(filename, items, label) {
        const res = await apiFetch('/api/dynamic_map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content: items }),
        });
        if (!res.ok) throw new Error(`${label} save failed: ${res.statusText}`);
        return true;
    }

    static fetchOutside() { return ApiManager.fetchGlobalList('outside.json'); }
    static saveOutside(items) { return ApiManager.saveGlobalList('outside.json', items, 'Outside dashboard'); }
    static fetchQuickActions() { return ApiManager.fetchGlobalList('quick_actions.json'); }
    static saveQuickActions(items) { return ApiManager.saveGlobalList('quick_actions.json', items, 'Quick actions'); }

    /**
     * Ask the backend to draw a style-recipe texture with Claude and save it
     * into dynamic_map_data/icons/. Slow (up to a couple of minutes).
     * Returns { path } of the served SVG; throws with the backend's message.
     */
    static async generateTexture(description, { stateDescription, tileable, filename, style } = {}) {
        const body = { description };
        if (stateDescription) body.state_description = stateDescription;
        if (tileable) body.tileable = true;
        if (filename) body.filename = filename;
        if (style) body.style = style;
        const data = await postJson('/api/dynamic_map/generate_texture', body);
        if (!data.success) throw new Error(data.error || 'Texture generation failed');
        return data;
    }

    static async saveToHA(activeFloor, rooms, shortcuts, config) {
        // Underscore keys are editor-only runtime state (_expanded, caches):
        // never persist them.
        const cleanShortcuts = stripRuntimeKeys(shortcuts);
        rooms = stripRuntimeKeys(rooms);

        const save = async (filename, content, label) => {
            const res = await apiFetch('/api/dynamic_map/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, content }),
            });
            if (!res.ok) throw new Error(`${label} save failed: ${res.statusText}`);
        };

        await save(`rooms_floor${activeFloor}.json`, rooms, 'Rooms');
        await save(`shortcuts_floor${activeFloor}.json`, cleanShortcuts, 'Shortcuts');
        if (config) await save(`config_floor${activeFloor}.json`, config, 'Config');
        return true;
    }

    // Builder Mode: save a background PNG (data URL) as bg_floor{N}.png
    static async saveImage(filename, dataUrl) {
        const res = await apiFetch('/api/dynamic_map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, image_base64: dataUrl }),
        });
        if (!res.ok) throw new Error(`Image save failed: ${res.statusText}`);
        return true;
    }

    static async fetchAvailableFiles() {
        const res = await apiFetch('/api/dynamic_map/files');
        if (!res.ok) throw new Error('Failed to load files');
        return await res.json();
    }

    static async fetchFloors() {
        return await apiJson('/api/dynamic_map/floors');
    }

    static async deleteFloor(floorNum) {
        return await postJson('/api/dynamic_map/delete_floor', { floor_num: parseInt(floorNum) });
    }

    static async recomputeFloor(floorNum, svgFile, dxfFile) {
        return await postJson('/api/dynamic_map/recompute', {
            floor_num: parseInt(floorNum),
            svg_file: svgFile || null,
            dxf_file: dxfFile || null,
        });
    }

    static async fetchRegistry() {
        return await apiJson('/api/dynamic_map/registry');
    }

    static async fetchEntities() {
        return await apiJson('/api/dynamic_map/entities');
    }
}
