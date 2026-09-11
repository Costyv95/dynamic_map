import { stripRuntimeKeys } from '../shared/ApiManager.js?v=3.2.1';

/**
 * Unsaved-changes safety: a per-floor draft in localStorage written on
 * every undo step, restored after a reload, and dirty tracking against
 * the last successful save.
 */
const KEY = (floor) => `dm_draft_floor_${floor}`;

export function draftKey(floor) { return KEY(floor); }

/** Persist the floor's working copy (debounced by the caller). */
export function writeDraft(floor, { rooms, shortcuts, walls, config }, storage = localStorage) {
    try {
        storage.setItem(KEY(floor), JSON.stringify({ ts: Date.now(), rooms: stripRuntimeKeys(rooms || []), shortcuts: stripRuntimeKeys(shortcuts || []), walls: walls || [], config: config || {} }));
    } catch (e) { /* quota or private mode: drafts are best effort */ }
}

export function readDraft(floor, storage = localStorage) {
    try {
        const raw = storage.getItem(KEY(floor));
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d && Array.isArray(d.shortcuts) ? d : null;
    } catch (e) { return null; }
}

export function clearDraft(floor, storage = localStorage) {
    try { storage.removeItem(KEY(floor)); } catch (e) { /* ignore */ }
}

/** True when the draft differs from what the server returned. */
export function draftDiffers(draft, data) {
    if (!draft) return false;
    const same = (a, b) => JSON.stringify(stripRuntimeKeys(a || [])) === JSON.stringify(stripRuntimeKeys(b || []));
    return !(same(draft.rooms, data.rooms) && same(draft.shortcuts, data.shortcuts)
        && same(draft.walls, (data.config && data.config.walls) || []));
}

export function formatAge(ts, now = Date.now()) {
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(ts).toLocaleString();
}

/**
 * Dirty tracking: the state manager bumps `revision` on saveState; the
 * app remembers the revision it last saved.
 */
export class DirtyTracker {
    constructor() { this.revision = 0; this.saved = 0; this.listeners = []; }
    bump() { this.revision++; this.emit(); }
    markSaved() { this.saved = this.revision; this.emit(); }
    reset() { this.revision = 0; this.saved = 0; this.emit(); }
    get dirty() { return this.revision !== this.saved; }
    onChange(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach(fn => fn(this.dirty)); }
}
