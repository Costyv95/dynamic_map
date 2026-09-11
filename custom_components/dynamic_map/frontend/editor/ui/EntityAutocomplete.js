/**
 * Entity id autocomplete for text inputs: a dropdown filtered by id or
 * friendly name, plus the shared <datalist id="entityList"> used by the
 * action/condition rows.
 */
export function setupAutocomplete(inputElement, getEntities) {
    if (!inputElement) return;
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;width:100%;';
    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);
    wrapper.appendChild(dropdown);

    inputElement.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        dropdown.innerHTML = '';
        let filtered = getEntities() || [];
        if (val) filtered = filtered.filter(ent => ent.id.toLowerCase().includes(val) || ent.name.toLowerCase().includes(val));
        filtered = filtered.slice(0, 100);
        if (filtered.length === 0) { dropdown.style.display = 'none'; return; }
        filtered.forEach(ent => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = ent.name !== ent.id ? `${ent.name} (${ent.id})` : ent.id;
            item.onclick = () => {
                inputElement.value = ent.id;
                dropdown.style.display = 'none';
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            };
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    });
    document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) dropdown.style.display = 'none'; });
    inputElement.addEventListener('focus', () => inputElement.dispatchEvent(new Event('input', { bubbles: false })));
}

/** Fill the shared entity datalist. */
export function fillEntityDatalist(entities) {
    const entityList = document.getElementById('entityList');
    if (entityList) entityList.innerHTML = entities.map(ent => `<option value="${ent.id}"></option>`).join('');
}
