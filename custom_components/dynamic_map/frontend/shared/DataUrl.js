/**
 * The one place that knows where dynamic_map's data files live. HA serves
 * them at /dynamic_map_data; a host on another origin (Portal) sets the
 * card option `data_base` to its own files route. Stored data (shortcut
 * images, presets) keeps the canonical /dynamic_map_data/ prefix and is
 * rebased here when rendered, so the saved JSON stays host-neutral.
 *
 * HA serves the data dir through an authenticated view (#1646), so a read
 * from it carries the session: JSON through dataFetch, pictures as blob URLs
 * through dataImageUrl / setDataHref. Another host's base is read as is.
 */
export const DEFAULT_DATA_BASE = '/dynamic_map_data';

let base = DEFAULT_DATA_BASE;

/** Set the data root; empty/absent restores the HA default. Trailing slashes are dropped. */
export function setDataBase(value) {
    const v = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
    base = v || DEFAULT_DATA_BASE;
}

export function getDataBase() { return base; }

/** URL of a data file, e.g. dataUrl('rooms_floor1.json'). */
export function dataUrl(path) {
    return `${base}/${String(path).replace(/^\/+/, '')}`;
}

/** Rebase a stored URL that points into the HA data dir; any other URL passes through. */
export function resolveDataUrl(url) {
    if (typeof url !== 'string') return url;
    const prefix = `${DEFAULT_DATA_BASE}/`;
    return url.startsWith(prefix) ? dataUrl(url.slice(prefix.length)) : url;
}

const XLINK = 'http://www.w3.org/1999/xlink';
// HA hands a card its config before hass: a read that comes first waits this
// long for the session fetch, then tries without it.
const FETCH_WAIT_MS = 5000;
let authFetch = null;
let markReady;
let ready;
const arm = () => { ready = new Promise(resolve => { markReady = resolve; }); };
arm();
const blobs = new Map();   // url -> Promise<string> (blob URL, '' when it failed)

/** The fetch that carries HA's session (hass.fetchWithAuth); null for plain fetch. */
export function setDataFetch(fn) {
    authFetch = typeof fn === 'function' ? fn : null;
    if (authFetch) markReady(); else arm();
}

const inHaDataDir = url => typeof url === 'string' && url.startsWith(`${DEFAULT_DATA_BASE}/`);

async function sessionFetch() {
    if (!authFetch) await Promise.race([ready, new Promise(r => setTimeout(r, FETCH_WAIT_MS))]);
    return authFetch;
}

/** fetch() for a data file: through the session when it is HA's data dir. */
export async function dataFetch(url, init) {
    const viaSession = inHaDataDir(url) ? await sessionFetch() : null;
    return viaSession ? viaSession(url, init) : fetch(url, init);
}

/** A URL an <img>/<image> can load: a blob URL for an HA data file, else the URL. '' when the read failed. */
export function dataImageUrl(url) {
    if (!inHaDataDir(url)) return Promise.resolve(url);
    if (!blobs.has(url)) {
        const job = sessionFetch().then(async viaSession => {
            if (!viaSession) return url;   // no session to give: let the browser try
            const res = await viaSession(url);
            return res && res.ok ? URL.createObjectURL(await res.blob()) : '';
        }).catch(() => '');
        blobs.set(url, job);
        job.then(src => { if (!src || src === url) blobs.delete(url); });   // retry on the next draw
    }
    return blobs.get(url);
}

/** Point an SVG <image> at a data URL (already rebased); an HA data file arrives once read. */
export function setDataHref(el, url) {
    const set = (v) => { el.setAttribute('href', v); el.setAttributeNS(XLINK, 'xlink:href', v); };
    el._dmHref = url;   // a later call wins over a read still in flight
    if (!inHaDataDir(url)) { set(url); return; }
    dataImageUrl(url).then(src => { if (src && el._dmHref === url) set(src); });
}
