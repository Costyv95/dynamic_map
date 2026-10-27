/**
 * Floor tone: a host's own colours for the floor, baked in once instead of a
 * live CSS filter. When the host sets both `--dm-floor-paper` and
 * `--dm-floor-ink` (THEME.md), every grey of the floor (the background PNG,
 * the colour under it, the 'fit' plate and grey walls) is mapped by its
 * lightness: white becomes paper, black becomes ink, and the greys between
 * them blend. Saturated colours (a purple divider wall) are kept as drawn.
 *
 * The PNG is recoloured on a canvas once per URL and kept as a blob URL, so
 * a floor switch reuses it and the browser never repaints a filter.
 */

/** Up to this spread between channels (0-255) a colour counts as a grey of
 * the drawing, so near-black navy walls tone too; a purple divider does not. */
import { parseColor } from '../shared/Color.js?v=3.2.1';

const GREY_CHROMA = 40;

const toned = new Map();   // `${url}|${paper}|${ink}` -> Promise<string|null>

export { parseColor };

const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** The host's tone, or null when it set no (or an unreadable) paper and ink. */
export function readFloorTone(el) {
    if (typeof Element === 'undefined' || !(el instanceof Element)) return null;
    const style = getComputedStyle(el);
    const paper = parseColor(style.getPropertyValue('--dm-floor-paper'));
    const ink = parseColor(style.getPropertyValue('--dm-floor-ink'));
    return paper && ink ? { paper, ink } : null;
}

const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

/** One grey level (0 black .. 255 white) on the tone's scale. */
function toneLevel(tone, level) {
    const t = level / 255;
    return tone.ink.map((ink, i) => ink + (tone.paper[i] - ink) * t);
}

/** A floor colour in the tone; saturated colours and unparseable values pass through. */
export function toneColor(tone, value) {
    const rgb = parseColor(value);
    if (!tone || !rgb || chroma(...rgb) > GREY_CHROMA) return value;
    return hex(toneLevel(tone, 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]));
}

/** Recolour RGBA pixel data in place (greys only; alpha untouched). */
export function tonePixels(tone, data) {
    const lut = [];
    for (let level = 0; level < 256; level++) lut.push(toneLevel(tone, level));
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (chroma(r, g, b) > GREY_CHROMA) continue;   // a coloured pixel
        const out = lut[(0.299 * r + 0.587 * g + 0.114 * b) | 0];
        data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2];
    }
    return data;
}

async function renderToned(url, tone) {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    tonePixels(tone, img.data);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return blob ? URL.createObjectURL(blob) : null;
}

async function renderTonedSvg(url, tone) {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = (await res.text()).replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, c => toneColor(tone, c));
    return URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
}

const isSvg = url => /\.svg(?:[?#]|$)/i.test(url);

/**
 * Blob URL of the floor picture in the tone, or null (no canvas, the fetch
 * failed): the caller then shows the original under --dm-floor-filter.
 */
export function tonedImageUrl(url, tone) {
    if (!tone || typeof document === 'undefined') return Promise.resolve(null);
    if (!isSvg(url) && typeof createImageBitmap !== 'function') return Promise.resolve(null);
    const key = `${url}|${tone.paper}|${tone.ink}`;
    if (!toned.has(key)) {
        const job = (isSvg(url) ? renderTonedSvg(url, tone) : renderToned(url, tone)).catch(e => {
            console.warn('[custom-svg-map] Floor tone failed; showing the original picture', e);
            return null;
        });
        toned.set(key, job);
        job.then(result => { if (!result) toned.delete(key); });   // retry on the next load
    }
    return toned.get(key);
}

/** Image URLs a decor shortcut draws (its picture and its on/off pictures). */
function decorImages(shortcuts) {
    const urls = new Set();
    (shortcuts || []).forEach(sc => {
        const c = sc && sc.config;
        if (!c || !c.decor) return;
        [c.image, c.image_on, c.image_off].forEach(v => { if (typeof v === 'string' && v && !v.includes('{')) urls.add(v); });
    });
    return [...urls];
}

/**
 * Toned copies of every decor picture on a floor: resolved URL -> blob URL.
 * Pictures that could not be toned are left out and draw as they are.
 */
export async function tonedDecor(shortcuts, tone, resolve) {
    if (!tone) return null;
    const pairs = await Promise.all(decorImages(shortcuts).map(async raw => {
        const url = resolve(raw);
        return [url, await tonedImageUrl(url, tone)];
    }));
    return Object.fromEntries(pairs.filter(([, toned]) => toned));
}
