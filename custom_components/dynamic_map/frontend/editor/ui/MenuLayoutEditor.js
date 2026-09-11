import { el, numberInput } from './dom.js?v=3.2.1';
import { openDialog } from './Dialog.js?v=3.2.1';

const isMenu = (a) => a.trigger === 'long_press' || a.trigger === 'overlay';

/** Rough preview of a menu item, by action type. */
function itemPreview(act) {
    const icon = act.icon ? (act.icon.includes(':') ? `<ha-icon icon="${act.icon}" style="--mdc-icon-size:16px;margin-right:5px;"></ha-icon>` : `<span style="margin-right:5px;">${act.icon}</span>`) : '';
    const label = act.name || act.type;
    const unit = act.unit ? ' ' + act.unit : '';
    switch (act.type) {
        case 'SLIDER': return `<div style="display:flex;align-items:center;width:100%;height:100%;padding:0 5px;gap:5px;">${icon}<span>${label}</span><input type="range" value="50" style="flex:1;margin:0;"></div>`;
        case 'VALUE_SLIDER': return `<div style="display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;padding:0 5px;gap:2px;"><div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;">${icon}${label}</span><span style="color:#7dd3fc;font-weight:700;">00${unit}</span></div><input type="range" value="50" style="width:100%;margin:0;"></div>`;
        case 'TOGGLE': return `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;height:100%;padding:0 8px;"><span>${icon}${label}</span><span style="width:36px;height:20px;background:#10b981;border-radius:10px;display:inline-block;"></span></div>`;
        case 'INFO_DISPLAY': return `<div style="display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;padding:4px 8px;background:rgba(255,255,255,0.06);border-radius:8px;"><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;">${label}</span><span style="font-size:16px;font-weight:700;">${icon}00${unit}</span></div>`;
        case 'PROGRESS_BAR': return `<div style="display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;gap:3px;"><div style="display:flex;justify-content:space-between;font-size:11px;"><span>${icon}${label}</span><b>00${unit}</b></div><div style="height:${act.bar_height || 8}px;border-radius:999px;background:rgba(255,255,255,0.12);"><div style="width:60%;height:100%;border-radius:999px;background:#10b981;"></div></div></div>`;
        default: return `<div style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;gap:8px;">${icon}<span>${label}</span></div>`;
    }
}

/**
 * Visual layout of the long-press menu: drag items, resize from the
 * bottom-right corner, wheel to rotate. Positions are saved on the actions.
 */
export function openMenuLayoutEditor(ctx, sc) {
    const cfg = sc.config;
    if (!cfg.menuWidth) cfg.menuWidth = 200;
    if (!cfg.menuHeight) cfg.menuHeight = 250;
    const commit = () => ctx.state.saveState();
    const area = el('div.dm-menu-area');
    const apply = () => { area.style.width = cfg.menuWidth + 'px'; area.style.height = cfg.menuHeight + 'px'; };
    apply();
    cfg.actions.filter(isMenu).forEach((act, idx) => {
        if (act.pos_x === undefined) act.pos_x = 10;
        if (act.pos_y === undefined) act.pos_y = 10 + idx * 45;
        if (act.width === undefined) act.width = 180;
        if (act.height === undefined) act.height = 35;
        if (act.rotation === undefined) act.rotation = 0;
        const item = el('div', { title: 'Drag to move. Drag the corner to resize. Wheel to rotate.', style: {
            position: 'absolute', left: act.pos_x + 'px', top: act.pos_y + 'px', width: act.width + 'px', height: act.height + 'px',
            color: '#fff', fontSize: '12px', userSelect: 'none', boxSizing: 'border-box', cursor: 'grab',
            border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '6px', transform: `rotate(${act.rotation}deg)`
        } });
        item.innerHTML = itemPreview(act);
        item.querySelectorAll('*').forEach(n => { n.style.pointerEvents = 'none'; });
        const grip = el('div', { style: { position: 'absolute', right: '0', bottom: '0', width: '0', height: '0', borderLeft: '10px solid transparent', borderBottom: '10px solid rgba(255,255,255,0.8)', cursor: 'se-resize' } });
        item.appendChild(grip);
        let drag = null;
        item.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            drag = { x: e.clientX, y: e.clientY, px: act.pos_x, py: act.pos_y, w: act.width, h: act.height, resize: e.target === grip };
            item.setPointerCapture(e.pointerId);
        });
        item.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (drag.resize) {
                act.width = Math.max(20, Math.round(drag.w + dx)); act.height = Math.max(20, Math.round(drag.h + dy));
                item.style.width = act.width + 'px'; item.style.height = act.height + 'px';
            } else {
                act.pos_x = Math.round(drag.px + dx); act.pos_y = Math.round(drag.py + dy);
                item.style.left = act.pos_x + 'px'; item.style.top = act.pos_y + 'px';
            }
        });
        item.addEventListener('pointerup', (e) => { if (drag) { drag = null; item.releasePointerCapture(e.pointerId); commit(); } });
        item.addEventListener('wheel', (e) => {
            e.preventDefault();
            act.rotation = (((act.rotation || 0) + (e.deltaY > 0 ? 15 : -15)) % 360 + 360) % 360;
            item.style.transform = `rotate(${act.rotation}deg)`;
            commit();
        }, { passive: false });
        area.appendChild(item);
    });
    const body = [
        el('div.dm-row', {},
            el('label', {}, 'Menu width ', numberInput({ value: cfg.menuWidth, width: '80px', onChange: (v) => { cfg.menuWidth = v || 200; apply(); commit(); } })),
            el('label', {}, 'Menu height ', numberInput({ value: cfg.menuHeight, width: '80px', onChange: (v) => { cfg.menuHeight = v || 250; apply(); commit(); } })),
            el('span.dm-hint', {}, 'Drag items to move, drag the corner to resize, scroll to rotate.')),
        el('div.dm-menu-stage', {}, area)
    ];
    return openDialog({ title: 'Long-press menu layout', body, width: 900, buttons: [{ label: 'Done', value: 'ok', primary: true }] })
        .then(() => ctx.state.requestDrawCallback());
}
