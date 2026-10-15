/**
 * The one place that knows where dynamic_map's data files live. HA serves
 * them at /dynamic_map_data; a host on another origin (Portal) sets the
 * card option `data_base` to its own files route. Stored data (shortcut
 * images, presets) keeps the canonical /dynamic_map_data/ prefix and is
 * rebased here when rendered, so the saved JSON stays host-neutral.
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
