import { DEFAULT_FLIPS } from '../core/Viewport.js?v=3.2.1';
import { dataUrl, resolveDataUrl, dataFetch, dataImageUrl } from '../shared/DataUrl.js?v=3.2.1';
import { readFloorTone, tonedImageUrl, tonedDecor } from './FloorTone.js?v=3.2.1';
import { floorCanvas, floorBackgroundMode } from '../shared/FloorPlan.js?v=3.2.1';

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

// A floor's files are kept for the page's life: a floor switch shows the kept
// copy at once and re-reads the files behind it, rebuilding only if they
// changed. The picture's URL is stable per page (so the browser and the
// floor tone reuse it) and moves on when its floor's files change.
const kept = new Map();   // dataUrl('floorN') -> { files, stamp, w, h }

const fetchJson = async (url) => {
    try {
        const res = await dataFetch(url);
        return res.ok ? await res.json() : null;
    } catch (e) { return null; }
};

async function readFloorFiles(floor) {
    const t = Date.now();
    const [rooms, shortcuts, config, outside, quick] = await Promise.all([
        fetchJson(dataUrl(`rooms_floor${floor}.json?t=${t}`)),
        fetchJson(dataUrl(`shortcuts_floor${floor}.json?t=${t}`)),
        fetchJson(dataUrl(`config_floor${floor}.json?t=${t}`)),
        fetchJson(dataUrl(`outside.json?t=${t}`)),
        fetchJson(dataUrl(`quick_actions.json?t=${t}`))
    ]);
    return { rooms, shortcuts, config, outside, quick };
}

const imageSize = (url) => dataImageUrl(url).then(src => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 });
    img.onerror = () => resolve({ w: 1000, h: 1000 });
    img.src = src;
}));

/** Forget every kept floor (tests; a host that knows its files changed). */
export function forgetFloors() { kept.clear(); }

function applyFiles(host, { rooms, shortcuts, config, outside, quick }) {
    host.quickActionItems = Array.isArray(quick) ? quick : [];
    host.rooms = rooms || [];
    host.shortcuts = shortcuts || [];
    host.outsideItems = outside || [];
    const floorConfig = config || { rotation_mode: 'auto' };
    host.rotationMode = floorConfig.rotation_mode || 'auto';
    host.floorBgColor = floorConfig.background_color || null;
    host.floorBgMode = floorBackgroundMode(floorConfig);
    host.walls = floorConfig.walls || [];
    host.flips = floorConfig.flips || DEFAULT_FLIPS();
}

/**
 * Everything a floor needs before it is drawn: its size (the canvas, or a
 * legacy picture's) and toned copies of decor pictures.
 */
async function prepare(entry, floor, tone) {
    const canvas = floorCanvas(entry.files.config);
    if (canvas) {
        Object.assign(entry, canvas);
        const decorTones = await tonedDecor(entry.files.shortcuts, tone, resolveDataUrl);
        return { raw: null, bgUrl: null, decorTones };
    }
    const raw = dataUrl(`bg_floor${floor}.png?t=${entry.stamp}`);
    if (!entry.w) Object.assign(entry, await imageSize(raw));
    const [toned, decorTones] = await Promise.all([
        tonedImageUrl(raw, tone), tonedDecor(entry.files.shortcuts, tone, resolveDataUrl)
    ]);
    return { raw, bgUrl: toned || raw, decorTones };
}

/**
 * Once the first floor is up, read and prepare the others while the card is
 * idle, so switching to them shows a kept floor at once.
 */
function warmFloors(host) {
    if (host._floorsWarmed) return;
    host._floorsWarmed = true;
    const others = (host.config && host.config.floors || []).filter(f => f !== host.activeFloor);
    if (!others.length) return;
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn) => setTimeout(fn, 1500);
    idle(async () => {
        const tone = readFloorTone(host);
        for (const floor of others) {
            const key = dataUrl(`floor${floor}`);
            if (kept.has(key)) continue;
            try {
                const files = await readFloorFiles(floor);
                if (!files.rooms || kept.has(key)) continue;
                const entry = { files, stamp: Date.now() };
                kept.set(key, entry);
                await prepare(entry, floor, tone);
            } catch (e) { /* the floor loads normally when chosen */ }
        }
    });
}

/** Build one kept floor; a later show (a newer load, or fresher files) wins. */
async function showFloor(host, requestId, entry) {
    const showId = host._showSeq = (host._showSeq || 0) + 1;
    const tone = readFloorTone(host);
    const { raw, bgUrl, decorTones } = await prepare(entry, host.activeFloor, tone);
    if (requestId !== host._loadSeq || showId !== host._showSeq) return; // superseded
    applyFiles(host, entry.files);
    host.floorTone = tone;
    host.decorTones = decorTones;
    host.imgW = entry.w; host.imgH = entry.h;
    host.floorToned = !!raw && bgUrl !== raw;
    host.buildSVG(bgUrl);
    warmFloors(host);
}

const show = (host, requestId, entry) =>
    showFloor(host, requestId, entry).catch(e => console.error('Failed to build the map', e));

export async function loadData(host) {
    const floor = host.activeFloor;
    const requestId = ++host._loadSeq;
    const key = dataUrl(`floor${floor}`);
    try {
        const prior = kept.get(key);
        if (prior) {
            show(host, requestId, prior);
            const files = await readFloorFiles(floor);
            if (!files.rooms || JSON.stringify(files) === JSON.stringify(prior.files)) return;
            const entry = { files, stamp: Date.now() };
            kept.set(key, entry);
            if (requestId === host._loadSeq) show(host, requestId, entry);
            return;
        }
        const files = await readFloorFiles(floor);
        if (requestId !== host._loadSeq) return; // superseded by a newer floor switch
        const entry = { files, stamp: Date.now() };
        // An unreadable floor is not kept, so the next load asks again.
        if (files.rooms) kept.set(key, entry);
        show(host, requestId, entry);
    } catch (e) {
        console.error('Failed to load map data', e);
        host.renderRoot.innerHTML = `<div class="dm-error">Failed to load map data. Ensure rooms_floor${floor}.json exists in /config/dynamic_map_data/.</div>`;
    }
}
