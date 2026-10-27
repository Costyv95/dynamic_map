import { el, section } from './dom.js?v=3.2.1';

/**
 * Proxies layer inspector: every Bluetooth proxy Bermuda knows, with
 * Place / Move / Remove for this floor (stored as config.ble_proxies).
 */
export function renderProxyPanel(ctx) {
    const { state, app } = ctx;
    const arm = (p) => { state.placingProxy = { id: p.id, name: p.name }; state.selectedProxyId = p.id; ctx.select(); };
    const remove = (p) => { if (state.removeProxy(p.id)) { state.saveState(); ctx.select(); } };
    const ids = new Set(state.knownProxies.map(p => p.id));
    // Placed here but no longer reported by Bermuda (renamed, removed): still listed so it can be removed.
    const rows = [...state.knownProxies, ...state.proxies.filter(p => !ids.has(p.id)).map(p => ({ ...p, gone: true }))];

    const items = rows.map(p => {
        const placed = state.proxies.find(q => q.id === p.id);
        const placing = state.placingProxy && state.placingProxy.id === p.id;
        const status = p.gone ? 'not in Bermuda' : (p.online === false ? 'offline' : (placed ? 'placed' : 'not placed'));
        return el(`div.dm-list-item${p.id === state.selectedProxyId ? '.active' : ''}`, {},
            el('span', { style: { width: '12px', height: '12px', borderRadius: '50%', flex: 'none',
                background: p.gone || p.online === false ? '#94a3b8' : '#7c3aed' } }),
            el('span', { style: { flex: '1 1 50%' }, title: p.id }, p.name || p.id),
            el('span.dm-hint', {}, status),
            p.gone ? null : el(`button${placing ? '' : '.primary'}`, { type: 'button',
                onClick: () => { if (placing) { state.placingProxy = null; ctx.select(); } else arm(p); } },
                placing ? 'Cancel' : (placed ? 'Move' : 'Place')),
            placed ? el('button.danger', { type: 'button', title: 'Take it off this floor', onClick: () => remove(p) }, '✕') : null);
    });

    return [
        el('div.dm-help', {},
            el('p', {}, 'Mark where each Bluetooth proxy physically sits. Room positioning uses these spots together with what the proxies hear.'),
            el('p', {}, el('b', {}, 'Place: '), 'press Place, then tap the exact spot on the map. Drag a marker to fine-tune it. Save when done.'),
            el('p', {}, 'Place each proxy on the floor where it is; a proxy on another floor stays listed here as "not placed".')),
        section('Proxies', items.length ? el('div.dm-list', {}, items)
            : el('div.dm-empty', {}, 'No proxies found. Bermuda lists a proxy once a tracked phone has a distance sensor for it.'),
            { key: 'proxies-list', actions: el('button', { type: 'button', title: 'Reload the list from Bermuda', onClick: () => app.loadProxies() }, '↻') })
    ];
}
