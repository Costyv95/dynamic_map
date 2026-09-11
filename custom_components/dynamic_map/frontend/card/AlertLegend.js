/**
 * Small glass chip that explains the room alert badges while any is
 * visible ("● 1 open door/window · ● 2 alarms"). Sits above the
 * temperature legend when both are on. Tapping it opens the first room
 * that has an alert.
 */
const LABELS = {
    open: (n) => `${n} open door${n === 1 ? '' : 's'}/window${n === 1 ? '' : 's'}`,
    danger: (n) => `${n} alarm${n === 1 ? '' : 's'}`,
    unavailable: (n) => `${n} unavailable`
};
const DOT = { open: '#f59e0b', danger: '#ef4444', unavailable: '#94a3b8' };

export function buildAlertLegend(host) {
    host.alertLegend = null;
    if (!host.renderRoot) return;
    const el = document.createElement('div');
    el.className = 'dm-alert-legend';
    el.hidden = true;
    el.title = 'Corner badges count what needs attention in a room. Tap a badge for the list.';
    el.addEventListener('click', (e) => { e.stopPropagation(); if (host._firstAlertRoom && host.onAlertTap) host.onAlertTap(host._firstAlertRoom); });
    host.renderRoot.appendChild(el);
    host.alertLegend = el;
}

/** `counts` is { open, danger, unavailable } across all rooms; `firstRoom` the first room with an alert. */
export function updateAlertLegend(host, counts, firstRoom) {
    const el = host.alertLegend;
    if (!el) return;
    host._firstAlertRoom = firstRoom || null;
    const kinds = ['danger', 'open', 'unavailable'].filter(k => counts[k] > 0);
    el.hidden = kinds.length === 0;
    if (el.hidden) return;
    el.replaceChildren(...kinds.map(k => {
        const item = document.createElement('span');
        item.className = `dm-al-item dm-al-${k}`;
        const dot = document.createElement('span');
        dot.className = 'dm-al-dot';
        dot.style.background = DOT[k];
        item.append(dot, document.createTextNode(LABELS[k](counts[k])));
        return item;
    }));
    el.classList.toggle('dm-above-temp', !!host.tempLegend);
}
