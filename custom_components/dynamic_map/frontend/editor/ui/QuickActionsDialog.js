import { el, textInput, checkbox } from './dom.js?v=3.2.1';
import { openDialog, toast } from './Dialog.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';

/**
 * Quick actions: chips at the bottom of every card, stored in the global
 * quick_actions.json. Each row is either a service call (with optional
 * JSON data) or an entity toggle.
 */
function row(item = {}) {
    const r = el('div.dm-card', {});
    const name = textInput({ value: item.name || '', placeholder: 'Label, e.g. All off' });
    const icon = textInput({ value: item.icon || '', placeholder: '🌙' });
    const service = textInput({ value: item.service || '', placeholder: 'Service, e.g. light.turn_off', list: 'serviceList', mono: true });
    const data = textInput({ value: item.data ? JSON.stringify(item.data) : '', placeholder: 'Data JSON, e.g. {"entity_id": "all"}', mono: true });
    const entity = textInput({ value: item.entity || '', placeholder: 'or an entity to toggle (chip lights up while on)', list: 'entityList' });
    const confirm = checkbox('Ask for a second tap', !!item.confirm, () => {});
    icon.style.flex = '0 0 60px';
    r.append(
        el('div.dm-row', {}, icon, name, el('button.danger', { type: 'button', title: 'Remove', onClick: () => r.remove() }, '×')),
        el('div.dm-row', {}, service, data),
        entity, confirm
    );
    r.read = () => {
        const out = {};
        if (name.value.trim()) out.name = name.value.trim();
        if (icon.value.trim()) out.icon = icon.value.trim();
        if (service.value.trim()) out.service = service.value.trim();
        if (data.value.trim()) { try { out.data = JSON.parse(data.value); } catch (e) { throw new Error(`Invalid JSON in "${out.name || out.service || 'action'}"`); } }
        if (entity.value.trim()) out.entity = entity.value.trim();
        if (confirm.querySelector('input').checked) out.confirm = true;
        return (out.service || out.entity) ? out : null;
    };
    return r;
}

export function collectQuickActions(rows) {
    return [...rows.querySelectorAll('.dm-card')].map(r => r.read()).filter(Boolean);
}

export async function openQuickActionsDialog() {
    const rows = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    let items = [];
    try { items = (await ApiManager.fetchQuickActions()) || []; } catch (e) { /* empty is fine */ }
    items.forEach(it => rows.appendChild(row(it)));
    if (!items.length) rows.appendChild(row());
    const v = await openDialog({ title: 'Quick actions', width: 640, body: [
        el('p.dm-hint', {}, 'Shown as chips at the bottom of every map card. A service call runs on tap (with a second tap when asked); an entity chip toggles it and lights up while it is on.'),
        rows,
        el('button', { type: 'button', onClick: () => rows.appendChild(row()) }, '＋ Add action')
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    try {
        const out = collectQuickActions(rows);
        await ApiManager.saveQuickActions(out);
        toast(`Saved ${out.length} quick action${out.length === 1 ? '' : 's'}.`, 'ok');
    } catch (err) {
        toast(err.message, 'error', 5000);
    }
}
