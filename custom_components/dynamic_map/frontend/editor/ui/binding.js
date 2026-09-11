import { el } from './dom.js?v=3.2.1';

/**
 * Where a shortcut field reads from and writes to. With a state previewed
 * (state.previewStateIdx), look fields target that state's override;
 * otherwise sc.config. Size/rotation go through ShortcutGeometry instead.
 */
export function previewState(sc, state) {
    const idx = state.previewStateIdx;
    return (idx !== -1 && sc.config && sc.config.states && sc.config.states[idx]) || null;
}

export function targetOf(sc, state) {
    if (!sc.config) sc.config = {};
    return previewState(sc, state) || sc.config;
}

/** Effective value: state override, then config, then fallback. */
export function readProp(sc, state, prop, fallback) {
    const st = previewState(sc, state);
    if (st && st[prop] !== undefined) return st[prop];
    if (sc.config && sc.config[prop] !== undefined) return sc.config[prop];
    return fallback;
}

/** Write to the current target; undefined deletes the key (reverts an override). */
export function writeProp(ctx, sc, prop, value, { commit = true } = {}) {
    const target = targetOf(sc, ctx.state);
    if (value === undefined || value === '' || Number.isNaN(value)) delete target[prop];
    else target[prop] = value;
    if (commit) ctx.state.saveState();
    ctx.state.requestDrawCallback();
}

/**
 * Small badge next to a label while a state is previewed: "inherited"
 * or "overridden ×" (click × to drop the override).
 */
export function overrideBadge(ctx, sc, prop) {
    const st = previewState(sc, ctx.state);
    if (!st) return null;
    if (st[prop] === undefined) return el('span.dm-badge.dm-inherit', { title: 'Uses the object default' }, 'inherited');
    return el('span.dm-badge', { title: 'This state overrides the object default' }, 'override',
        el('button', { type: 'button', title: 'Remove the override', onClick: (e) => {
            e.preventDefault();
            delete st[prop];
            ctx.state.saveState();
            ctx.state.requestDrawCallback();
            ctx.refresh();
        } }, '×'));
}

/** Layer of a shortcut object. */
export const layerOf = (sc) => (sc.config && sc.config.decor ? 'decor' : 'objects');
