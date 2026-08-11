const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log('[ApiManager]', ...args); };

/**
 * The editor runs in an iframe panel without its own `hass` object, so it
 * cannot use hass.callApi directly. It IS same-origin with the parent HA
 * frontend, though, so the most reliable token source is the parent app's
 * live `hass.auth` object — the frontend keeps that access token refreshed
 * for us, and we can force a refresh if it has expired.
 *
 * We fall back to the persisted `hassTokens` blob, checking BOTH localStorage
 * (written when the user ticks "Keep me logged in") and sessionStorage
 * (used otherwise), so a save still authenticates in either login mode.
 *
 * On the iOS/Android Companion apps none of the storage fallbacks can work:
 * those apps authenticate the frontend through the *external auth* bridge, so
 * no `hassTokens` blob is ever written. The only usable source there is the
 * parent app's live auth object, which we reach via `window.parent.
 * hassConnection` — a promise the HA frontend always publishes on its window,
 * independent of the DOM. That is why it is tried before the storage paths.
 */

/** Which source produced the last token — surfaced in the 401 message. */
let lastTokenSource = 'none';

/** Read a token out of an HA `auth` object, refreshing it if it has expired. */
async function tokenFromAuth(auth) {
    if (!auth || !auth.accessToken) return null;
    if (auth.expired && typeof auth.refreshAccessToken === 'function') {
        await auth.refreshAccessToken();
    }
    return auth.accessToken || null;
}

async function getAccessToken() {
    // 1. Live, auto-refreshed token from the parent HA app (best source).
    try {
        const ha = window.parent
            && window.parent.document
            && window.parent.document.querySelector('home-assistant');
        const token = await tokenFromAuth(ha && ha.hass && ha.hass.auth);
        if (token) { lastTokenSource = 'parent-hass'; return token; }
    } catch (e) { /* no parent hass (standalone/cross-origin) — try the next source */ }

    // 2. The parent frontend's connection promise. DOM-independent, and the ONLY
    //    source that works in the Companion apps (external auth writes no tokens).
    try {
        if (window.parent && window.parent.hassConnection) {
            const { auth } = await window.parent.hassConnection;
            const token = await tokenFromAuth(auth);
            if (token) { lastTokenSource = 'parent-hassConnection'; return token; }
        }
    } catch (e) { /* not exposed / cross-origin — fall through to storage */ }

    // 3. Persisted tokens — try both storages; refresh if expired via refresh_token.
    for (const store of [localStorage, sessionStorage]) {
        try {
            const tokens = JSON.parse(store.getItem('hassTokens'));
            if (!tokens || !tokens.access_token) continue;
            lastTokenSource = 'stored-tokens';
            const stillValid = !tokens.expires || tokens.expires - 30000 > Date.now();
            if (stillValid) return tokens.access_token;
            const refreshed = await refreshStoredToken(store, tokens);
            if (refreshed) return refreshed;
            return tokens.access_token; // last resort: send it and let the server decide
        } catch (e) { /* malformed entry — try the next store */ }
    }
    lastTokenSource = 'none';
    return null;
}

/** Exchange a stored refresh_token for a fresh access_token and persist it. */
async function refreshStoredToken(store, tokens) {
    if (!tokens.refresh_token) return null;
    try {
        const res = await fetch('/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: `${location.protocol}//${location.host}/`,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.access_token) return null;
        const updated = {
            ...tokens,
            access_token: data.access_token,
            expires: Date.now() + (data.expires_in || 1800) * 1000,
        };
        store.setItem('hassTokens', JSON.stringify(updated));
        return data.access_token;
    } catch (e) {
        return null;
    }
}

async function authHeaders() {
    const token = await getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: { ...(options.headers || {}), ...(await authHeaders()) },
    });
    if (res.status === 401) {
        throw new Error(
            lastTokenSource === 'none'
                // No source produced a token at all — the editor never saw the
                // parent app's auth. Naming this separately matters: in the
                // Companion apps it is the ONLY possible shape of failure.
                ? 'Not authenticated: no Home Assistant token available to the editor '
                  + '(token source: none). Reopen the Map Editor from the HA sidebar; '
                  + 'in a browser, log in with "Keep me logged in".'
                // A token WAS sent and the server still rejected it.
                : `Not authenticated: Home Assistant rejected the token (source: ${lastTokenSource}). `
                  + 'Reload the editor; if it persists, log out and back in.'
        );
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
