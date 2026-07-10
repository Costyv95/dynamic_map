const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log('[ApiManager]', ...args); };

/**
 * The editor runs in an iframe panel without a `hass` object, so it cannot use
 * hass.callApi. The HA frontend keeps its auth tokens in localStorage on the
 * same origin; we reuse them so the backend views can require authentication.
 */
function authHeaders() {
    try {
        const tokens = JSON.parse(localStorage.getItem('hassTokens'));
        if (tokens && tokens.access_token) {
            return { 'Authorization': `Bearer ${tokens.access_token}` };
        }
    } catch (e) { /* no stored tokens — request goes out unauthenticated */ }
    return {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: { ...(options.headers || {}), ...authHeaders() },
    });
    if (res.status === 401) {
        throw new Error('Not authenticated. Log in to Home Assistant with "Keep me logged in", then reload the editor.');
    }
    return res;
}

async function apiJson(path, options = {}) {
    const res = await apiFetch(path, options);
    try {
        return await res.json();
    } catch (e) {
        return { success: false, error: `Invalid response from ${path} (HTTP ${res.status})` };
    }
}

function postJson(path, body) {
    return apiJson(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

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

export class ApiManager {
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
    static async fetchOutside() {
        try {
            const res = await fetch(`/dynamic_map_data/outside.json?t=${Date.now()}`);
            return res.ok ? await res.json() : [];
        } catch (e) {
            return [];
        }
    }

    static async saveOutside(items) {
        const res = await apiFetch('/api/dynamic_map/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'outside.json', content: items }),
        });
        if (!res.ok) throw new Error(`Outside dashboard save failed: ${res.statusText}`);
        return true;
    }

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
        // Strip the runtime _imgCache object from shortcuts to prevent serializing DOM Image objects
        const cleanShortcuts = JSON.parse(JSON.stringify(shortcuts, (key, value) => {
            if (key === '_imgCache') return undefined;
            return value;
        }));

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
