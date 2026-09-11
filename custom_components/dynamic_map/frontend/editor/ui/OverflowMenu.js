import { el, clear } from './dom.js?v=3.2.1';
import { openDialog } from './Dialog.js?v=3.2.1';
import { openBackgroundDialog } from './FloorDialogs.js?v=3.2.1';
import { openOutsideDialog } from './OutsideDialog.js?v=3.2.1';
import { openRecomputeDialog } from './RecomputeDialog.js?v=3.2.1';

const ROTATION = { auto: ['Auto (fits each screen)', 'horizontal'], horizontal: ['Always landscape', 'vertical'], vertical: ['Always portrait', 'auto'] };

/** The "⋯" menu: floor-level settings and tools that are rarely needed. */
export function openOverflowMenu(app, anchor) {
    const { canvas, state } = app;
    const existing = document.querySelector('.dm-menu');
    if (existing) { existing.remove(); return; }
    const menu = el('div.dm-menu', { role: 'menu' });
    const item = (label, hint, onClick) => el('button.dm-menu-item', { type: 'button', onClick: () => { menu.remove(); onClick(); } },
        el('span', {}, label), hint ? el('span.dm-hint', {}, hint) : null);
    const flipsOn = canvas.rotationMode !== 'auto';
    const f = canvas.flips[canvas.activeMode] || { h: false, v: false };
    menu.append(
        item(`🔁 Card rotation: ${ROTATION[canvas.rotationMode][0]}`, 'Click to cycle. Auto is recommended.', () => {
            canvas.rotationMode = ROTATION[canvas.rotationMode][1];
            canvas.layout(); app.ui.refresh();
        }),
        item(`↔ Flip horizontally ${f.h ? '(on)' : ''}`, flipsOn ? `For the ${canvas.activeMode} layout` : 'Only with a forced rotation', () => {
            if (!flipsOn) return;
            canvas.flips[canvas.activeMode].h = !canvas.flips[canvas.activeMode].h;
            canvas.layout();
        }),
        item(`↕ Flip vertically ${f.v ? '(on)' : ''}`, flipsOn ? `For the ${canvas.activeMode} layout` : 'Only with a forced rotation', () => {
            if (!flipsOn) return;
            canvas.flips[canvas.activeMode].v = !canvas.flips[canvas.activeMode].v;
            canvas.layout();
        }),
        item('🎨 Floor background…', 'Colour and canvas mode of this floor', () => openBackgroundDialog(app)),
        item('🌤️ Outside dashboard…', 'The fixed bar at the top of the card', () => openOutsideDialog(app)),
        item('⚙️ Recompute / delete floor…', 'Rebuild rooms from DXF/SVG, or remove a floor', () => openRecomputeDialog(app)),
        item('📄 Card YAML…', 'Copy the dashboard card configuration', () => openYamlDialog(app, state))
    );
    const r = anchor.getBoundingClientRect();
    menu.style.cssText = `position: fixed; top: ${r.bottom + 6}px; right: ${Math.max(8, window.innerWidth - r.right)}px; z-index: 900;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) menu.remove(); }, { once: true }), 0);
}

function openYamlDialog(app, state) {
    const floors = app.floors || [];
    const vacuum = (state.shortcuts || []).find(sc => sc.type === 'vacuum' && sc.entity_id);
    let yaml = `type: custom:custom-svg-map\ndefault_floor: ${state.activeFloor}\n`;
    if (floors.length) yaml += `floors: [${floors.join(', ')}]\n`;
    if (vacuum) yaml += `vacuum_entity: ${vacuum.entity_id}\n`;
    const ta = el('textarea', { readOnly: true, style: { fontFamily: 'ui-monospace, monospace' } });
    ta.value = yaml;
    openDialog({ title: 'Dashboard card YAML', body: [el('p', {}, 'Add a Manual card with this configuration. Remove the floors line to let the card discover floors on its own.'), ta],
        buttons: [{ label: 'Copy', value: 'copy' }, { label: 'Close', value: 'ok', primary: true }] })
        .then(v => { if (v === 'copy' && navigator.clipboard) navigator.clipboard.writeText(yaml).catch(() => {}); });
}
