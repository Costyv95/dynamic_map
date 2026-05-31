# Stage 3 Guide: Visual Nested Query Builder

This document details the complete technical specifications and step-by-step implementation for Phase 3: creating the card-based, recursive **Nested Visual Query Builder** inside the Map Editor's configuration sidebar (`ShortcutConfigUI.js`), ensuring **zero hidden logic**.

---

## 🏛️ 1. Technical Design

* **Composite Rendering Scopes**: Since the logical schema can nest groups recursively, the UI builder must also be recursive. We define a rendering function `renderGroup(group, parentPath)` that calls itself when it encounters a sub-group.
* **Rounded Scope Cards**: Every group is rendered as a clean, styled HTML container card with a border, visual background tinting, and vertical left indentation lines to make logical boundaries obvious.
* **Autocomplete Autopreview**: Focus must be preserved while typing. Inputs are bound using unique `data-path` attributes (e.g. `rules.1.rules.0.state_entity`) to map directly to the underlying JSON without causing DOM focus loss during key strokes.

---

## 📐 2. Code Implementation (`ShortcutConfigUI.js` - Segment)

Add these recursive DOM-building helpers inside `custom_components/dynamic_map/frontend/editor/ShortcutConfigUI.js`:

```javascript
/**
 * Recursively renders a logical group inside the sidebar UI.
 */
function renderLogicalGroup(group, path, entities, onUpdate) {
    const container = document.createElement('div');
    container.className = 'query-group-card';
    container.style.border = '1px solid var(--border)';
    container.style.borderRadius = '8px';
    container.style.background = 'var(--bg-accent)';
    container.style.padding = '10px';
    container.style.margin = '8px 0';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.position = 'relative';

    // 1. Group Header: Logical operator switch (AND / OR)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const label = document.createElement('span');
    label.textContent = 'Logical Match:';
    label.style.fontSize = '12px';
    label.style.fontWeight = 'bold';
    header.appendChild(label);
    
    const operatorSwitcher = document.createElement('div');
    operatorSwitcher.style.display = 'flex';
    operatorSwitcher.style.gap = '4px';
    
    const operators = ['AND', 'OR'];
    operators.forEach(op => {
        const btn = document.createElement('button');
        btn.textContent = op;
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '10px';
        btn.style.borderRadius = '4px';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        
        const isActive = (group.type || 'AND') === op;
        btn.style.background = isActive ? 'var(--accent)' : 'var(--btn-hover)';
        btn.style.color = isActive ? 'white' : 'var(--text)';
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            group.type = op;
            onUpdate();
        });
        
        operatorSwitcher.appendChild(btn);
    });
    header.appendChild(operatorSwitcher);
    
    // Group Delete Button (Only for sub-groups)
    if (path !== 'root') {
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#ef4444';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '12px';
        delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            onUpdate({ action: 'delete_group', path });
        });
        header.appendChild(delBtn);
    }
    container.appendChild(header);

    // 2. Rules List (Leaf rows and nested groups)
    const rulesContainer = document.createElement('div');
    rulesContainer.style.display = 'flex';
    rulesContainer.style.flexDirection = 'column';
    rulesContainer.style.gap = '6px';
    rulesContainer.style.paddingLeft = '8px';
    rulesContainer.style.borderLeft = '2px solid var(--border)';
    
    const rules = group.rules || [];
    rules.forEach((rule, idx) => {
        const rulePath = path === 'root' ? `rules.${idx}` : `${path}.rules.${idx}`;
        
        if (rule.rules) {
            // Recursive subgroup rendering
            const subGroupEl = renderLogicalGroup(rule, rulePath, entities, onUpdate);
            rulesContainer.appendChild(subGroupEl);
        } else {
            // Leaf-level comparison row
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            row.style.alignItems = 'center';
            
            // Entity Input
            const entityInput = document.createElement('input');
            entityInput.type = 'text';
            entityInput.placeholder = 'entity_id';
            entityInput.value = rule.state_entity || '';
            entityInput.setAttribute('list', 'entityList');
            entityInput.style.flex = '2';
            entityInput.style.padding = '4px';
            entityInput.style.borderRadius = '4px';
            entityInput.style.border = '1px solid var(--border)';
            entityInput.addEventListener('input', (e) => {
                rule.state_entity = e.target.value;
                // Live sync first rule back to parent for lovelace backward-compatibility
                if (idx === 0 && path === 'root') {
                    onUpdate({ action: 'sync_parent_keys', rule });
                }
            });
            row.appendChild(entityInput);
            
            // Operator Select
            const opSelect = document.createElement('select');
            opSelect.style.flex = '1';
            opSelect.style.padding = '4px';
            opSelect.style.borderRadius = '4px';
            const ops = ['==', '!=', '<', '<=', '>', '>=', 'between'];
            ops.forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.textContent = op;
                if (rule.operator === op) opt.selected = true;
                opSelect.appendChild(opt);
            });
            opSelect.addEventListener('change', (e) => {
                rule.operator = e.target.value;
                if (idx === 0 && path === 'root') onUpdate({ action: 'sync_parent_keys', rule });
            });
            row.appendChild(opSelect);
            
            // Value Input
            const valInput = document.createElement('input');
            valInput.type = 'text';
            valInput.placeholder = 'Value';
            valInput.value = rule.value || '';
            valInput.style.flex = '1';
            valInput.style.padding = '4px';
            valInput.style.borderRadius = '4px';
            valInput.style.border = '1px solid var(--border)';
            valInput.addEventListener('input', (e) => {
                rule.value = e.target.value;
                if (idx === 0 && path === 'root') onUpdate({ action: 'sync_parent_keys', rule });
            });
            row.appendChild(valInput);
            
            // Delete Rule Button
            const delRuleBtn = document.createElement('button');
            delRuleBtn.textContent = '✕';
            delRuleBtn.style.background = 'none';
            delRuleBtn.style.border = 'none';
            delRuleBtn.style.color = 'var(--text-muted)';
            delRuleBtn.style.cursor = 'pointer';
            delRuleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                rules.splice(idx, 1);
                onUpdate();
            });
            row.appendChild(delRuleBtn);
            
            rulesContainer.appendChild(row);
        }
    });
    container.appendChild(rulesContainer);

    // 3. Bottom controls: Add Rule or Add Nested Group
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    controls.style.marginTop = '4px';
    
    const addRuleBtn = document.createElement('button');
    addRuleBtn.textContent = '+ Add Rule';
    addRuleBtn.style.padding = '4px 8px';
    addRuleBtn.style.fontSize = '10px';
    addRuleBtn.style.borderRadius = '4px';
    addRuleBtn.style.border = '1px dashed var(--border)';
    addRuleBtn.style.background = 'none';
    addRuleBtn.style.cursor = 'pointer';
    addRuleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        rules.push({ state_entity: '', operator: '==', value: '' });
        onUpdate();
    });
    controls.appendChild(addRuleBtn);

    const addGroupBtn = document.createElement('button');
    addGroupBtn.textContent = '+ Add Group';
    addGroupBtn.style.padding = '4px 8px';
    addGroupBtn.style.fontSize = '10px';
    addGroupBtn.style.borderRadius = '4px';
    addGroupBtn.style.border = '1px dashed var(--border)';
    addGroupBtn.style.background = 'none';
    addGroupBtn.style.cursor = 'pointer';
    addGroupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        rules.push({ type: 'AND', rules: [{ state_entity: '', operator: '==', value: '' }] });
        onUpdate();
    });
    controls.appendChild(addGroupBtn);
    
    container.appendChild(controls);
    
    return container;
}
```

---

## 🔬 3. Stage 3 Verification Checklist
- [ ] Mount editor, navigate to state configurations, and add 2 nested AND/OR subgroups.
- [ ] Drag, delete, and add comparison rules.
- [ ] Confirm no cursor focus loss occurs during typing and updates save immediately to **Raw JSON** on the canvas.
