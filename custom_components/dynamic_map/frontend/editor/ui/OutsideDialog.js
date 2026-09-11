import { el, textInput } from './dom.js?v=3.2.1';
import { openDialog, toast } from './Dialog.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';

/**
 * Outside dashboard: the global outside.json, a fixed info bar
 * (temperature, pollen, weather…) at the top of the card.
 */
function row(item = {}) {
    const r = el('div.outside-row', { style: { display: 'flex', gap: '5px', alignItems: 'center' } },
        textInput({ value: item.entity_id || '', placeholder: 'entity_id, e.g. sensor.outdoor_temp', list: 'entityList' }),
        textInput({ value: item.icon || '', placeholder: '🌡️' }),
        textInput({ value: item.name || '', placeholder: 'Label' }),
        textInput({ value: item.unit !== undefined ? item.unit : '', placeholder: 'Unit' }),
        textInput({ value: item.attribute || '', placeholder: 'Attr' }),
        el('button.danger', { type: 'button', title: 'Remove', onClick: () => r.remove() }, '×'));
    const [entity, icon, name, unit, attr] = r.querySelectorAll('input');
    entity.classList.add('o-entity'); icon.classList.add('o-icon'); name.classList.add('o-name'); unit.classList.add('o-unit'); attr.classList.add('o-attr');
    entity.style.flex = '3'; icon.style.flex = '0 0 52px'; name.style.flex = '2'; unit.style.flex = '0 0 60px'; attr.style.flex = '0 0 72px';
    return r;
}

/** Read the rows back into outside.json items (empty entity rows dropped). */
export function collectRows(root) {
    const items = [];
    root.querySelectorAll('.outside-row').forEach(r => {
        const entity = r.querySelector('.o-entity').value.trim();
        if (!entity) return;
        const item = { entity_id: entity };
        const icon = r.querySelector('.o-icon').value.trim();
        const name = r.querySelector('.o-name').value.trim();
        const unit = r.querySelector('.o-unit').value.trim();
        const attr = r.querySelector('.o-attr').value.trim();
        if (icon) item.icon = icon;
        if (name) item.name = name;
        if (unit) item.unit = unit;
        if (attr) item.attribute = attr;
        items.push(item);
    });
    return items;
}

export async function openOutsideDialog() {
    const rows = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    let items = [];
    try { items = (await ApiManager.fetchOutside()) || []; } catch (e) { /* empty is fine */ }
    items.forEach(it => rows.appendChild(row(it)));
    if (!items.length) rows.appendChild(row());
    const v = await openDialog({ title: 'Outside dashboard', width: 720, body: [
        el('p.dm-hint', {}, 'Shown as a fixed bar at the top of the card. Weather entities show a condition icon and the temperature; leave the label empty to show just the value; "Attr" reads an attribute instead of the state.'),
        rows,
        el('button', { type: 'button', onClick: () => rows.appendChild(row()) }, '＋ Add item')
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    const out = collectRows(rows);
    try {
        await ApiManager.saveOutside(out);
        toast(`Saved ${out.length} outside item${out.length === 1 ? '' : 's'}.`, 'ok');
    } catch (err) {
        toast(`Save failed: ${err.message}`, 'error', 5000);
    }
}
