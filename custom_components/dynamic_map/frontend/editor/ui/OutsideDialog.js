import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';

/**
 * Outside Dashboard editor: manages the global outside.json, a fixed
 * info bar (temperature, pollen, weather...) at the top of the card.
 */
function addRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'outside-row';
    row.style.cssText = 'display:flex; gap:5px; align-items:center;';
    row.innerHTML = `
        <input class="o-entity" list="entityList" placeholder="entity_id (e.g. sensor.outdoor_temp)" value="${item.entity_id || ''}" style="flex:3; margin:0; min-width:0;">
        <input class="o-icon" placeholder="🌡️" title="Icon (emoji, optional)" value="${item.icon || ''}" style="flex:0 0 44px; margin:0; text-align:center;">
        <input class="o-name" placeholder="Label" title="Small label under the value (optional)" value="${item.name || ''}" style="flex:2; margin:0; min-width:0;">
        <input class="o-unit" placeholder="Unit" title="Unit override (optional, blank = entity unit)" value="${item.unit !== undefined ? item.unit : ''}" style="flex:0 0 52px; margin:0;">
        <input class="o-attr" placeholder="Attr" title="Entity attribute to display instead of state (optional)" value="${item.attribute || ''}" style="flex:0 0 64px; margin:0;">
        <button class="o-del danger" title="Remove item" style="width:28px; height:28px; padding:0; margin:0; flex:none;">×</button>
    `;
    row.querySelector('.o-del').addEventListener('click', () => row.remove());
    document.getElementById('outsideRows').appendChild(row);
}

/** Read the rows back into outside.json items (empty entity rows dropped). */
export function collectRows(root = document) {
    const items = [];
    root.querySelectorAll('#outsideRows .outside-row').forEach(row => {
        const entity = row.querySelector('.o-entity').value.trim();
        if (!entity) return;
        const item = { entity_id: entity };
        const icon = row.querySelector('.o-icon').value.trim();
        const name = row.querySelector('.o-name').value.trim();
        const unit = row.querySelector('.o-unit').value.trim();
        const attr = row.querySelector('.o-attr').value.trim();
        if (icon) item.icon = icon;
        if (name) item.name = name;
        if (unit) item.unit = unit;
        if (attr) item.attribute = attr;
        items.push(item);
    });
    return items;
}

async function open() {
    const rows = document.getElementById('outsideRows');
    rows.innerHTML = '';
    document.getElementById('outsideStatus').textContent = '';
    const items = await ApiManager.fetchOutside();
    (items || []).forEach(addRow);
    if (!items || !items.length) addRow();
    document.getElementById('outsideModal').style.display = 'flex';
}

async function save() {
    const status = document.getElementById('outsideStatus');
    const items = collectRows();
    try {
        status.textContent = 'Saving…';
        await ApiManager.saveOutside(items);
        status.textContent = `✅ Saved ${items.length} item${items.length === 1 ? '' : 's'}. Reload the dashboard to see the bar.`;
    } catch (err) {
        status.textContent = `❌ ${err.message}`;
    }
}

export function bindOutsideDialog() {
    document.getElementById('outsideBtn').addEventListener('click', open);
    document.getElementById('closeOutsideBtn').addEventListener('click', () => {
        document.getElementById('outsideModal').style.display = 'none';
    });
    document.getElementById('addOutsideRowBtn').addEventListener('click', () => addRow());
    document.getElementById('saveOutsideBtn').addEventListener('click', save);
}
