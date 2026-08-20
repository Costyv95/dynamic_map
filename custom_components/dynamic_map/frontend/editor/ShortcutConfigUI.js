export function renderActionsAndStates(sc, onStateChange) {
    const actionsList = document.getElementById('scActionsList');
    const statesList = document.getElementById('scStatesList');
    actionsList.innerHTML = '';
    statesList.innerHTML = '';
    
    if (!sc.config) sc.config = {};
    if (!sc.config.actions) sc.config.actions = [];
    if (!sc.config.states) sc.config.states = [];
    const hasLongPress = sc.config.actions.some(a => a.trigger === 'long_press' || a.trigger === 'overlay');
    if (hasLongPress) {
        const layoutBtn = document.createElement('button');
        layoutBtn.textContent = '📐 Visual Menu Layout';
        layoutBtn.style.width = '100%';
        layoutBtn.style.marginBottom = '10px';
        layoutBtn.style.background = 'var(--accent)';
        layoutBtn.addEventListener('click', () => openMenuEditor(sc, onStateChange));
        actionsList.appendChild(layoutBtn);
    }
    
    sc.config.actions.forEach((act, idx) => {
        const isExpanded = act._expanded === true; // folded by default
        let typeText = act.type || 'Action';
        if (typeText === 'TOGGLE_ON') typeText = 'Turn On';
        if (typeText === 'TOGGLE_OFF') typeText = 'Turn Off';
        if (typeText === 'CALL_SERVICE') typeText = 'Call Service';
        if (typeText === 'ROOM_SELECTOR') typeText = 'Select Rooms';
        if (typeText === 'SENSOR_OVERLAY') typeText = 'Sensor Dials Overlay';
        if (typeText === 'COLOR_PICKER') typeText = 'Color Honeycomb';
        if (typeText === 'VALUE_SLIDER') typeText = 'Value Slider';
        if (typeText === 'INFO_DISPLAY') typeText = 'Info Display';
        if (typeText === 'PROGRESS_BAR') typeText = 'Progress Bar';

        const triggerText = (act.trigger === 'long_press' || act.trigger === 'overlay') ? 'Long Press' : 'Tap';
        const title = act.name || `${triggerText} - ${typeText}`;
        
        const div = document.createElement('div');
        div.style.background = 'var(--input-bg)';
        div.style.padding = '8px';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--input-border)';
        div.style.userSelect = 'none';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" class="act-header expandable-header">
                <div>
                    <span class="chevron ${isExpanded ? '' : 'collapsed'}">▼</span>
                    <strong style="font-size: 13px; color: var(--text);">${title}</strong>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="mv-up-act" data-idx="${idx}" style="width: auto; margin: 0; padding: 2px 5px; font-size: 10px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button class="mv-dn-act" data-idx="${idx}" style="width: auto; margin: 0; padding: 2px 5px; font-size: 10px;" ${idx === sc.config.actions.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="del-act" data-idx="${idx}" style="width: auto; margin: 0; padding: 2px 5px; font-size: 10px;" class="danger">X</button>
                </div>
            </div>
            <div class="act-body" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 10px; border-top: 1px solid var(--input-border); padding-top: 10px;">
                <input type="text" class="act-name" value="${act.name || ''}" placeholder="Action Name" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
                <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                    <select class="act-trigger" style="margin: 0; padding: 4px;">
                        <option value="tap" ${act.trigger === 'tap' ? 'selected' : ''}>Tap</option>
                        <option value="long_press" ${act.trigger === 'long_press' || act.trigger === 'overlay' ? 'selected' : ''}>Long Press</option>
                    </select>
                    <select class="act-type" style="margin: 0; padding: 4px;">
                        <option value="TOGGLE" ${act.type === 'TOGGLE' ? 'selected' : ''}>Toggle State</option>
                        <option value="TOGGLE_ON" ${act.type === 'TOGGLE_ON' ? 'selected' : ''}>Turn On (Enable)</option>
                        <option value="TOGGLE_OFF" ${act.type === 'TOGGLE_OFF' ? 'selected' : ''}>Turn Off (Disable)</option>
                        <option value="CALL_SERVICE" ${act.type === 'CALL_SERVICE' ? 'selected' : ''}>Call Service</option>
                        <option value="SLIDER" ${act.type === 'SLIDER' ? 'selected' : ''}>Slider (Brightness)</option>
                        <option value="VALUE_SLIDER" ${act.type === 'VALUE_SLIDER' ? 'selected' : ''}>Value Slider (live readout)</option>
                        <option value="INFO_DISPLAY" ${act.type === 'INFO_DISPLAY' ? 'selected' : ''}>Info Display (read-only)</option>
                        <option value="PROGRESS_BAR" ${act.type === 'PROGRESS_BAR' ? 'selected' : ''}>Progress Bar</option>
                        <option value="ROOM_SELECTOR" ${act.type === 'ROOM_SELECTOR' ? 'selected' : ''}>Select Rooms on Map</option>
                        <option value="SENSOR_OVERLAY" ${act.type === 'SENSOR_OVERLAY' ? 'selected' : ''}>Sensor Dials Overlay</option>
                        <option value="COLOR_PICKER" ${act.type === 'COLOR_PICKER' ? 'selected' : ''}>Color Honeycomb (Light)</option>
                    </select>
                </div>
                <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="act-target" list="entityList" value="${act.action_entity || ''}" placeholder="Action Entity" style="flex: 2; margin: 0; padding: 4px;">
                    <input type="text" class="act-icon" list="iconList" value="${act.icon || ''}" placeholder="Menu Icon" style="flex: 1; margin: 0; padding: 4px; text-align: center;">
                    <input type="text" class="act-width" value="${act.width || ''}" placeholder="Width (e.g. 150px)" style="flex: 1; margin: 0; padding: 4px; text-align: center;">
                </div>
                ${(act.type === 'CALL_SERVICE' || act.type === 'PROGRESS_BAR') ? `
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <input type="text" class="act-service" list="serviceList" value="${act.service || ''}" placeholder="${act.type === 'PROGRESS_BAR' ? 'Tap service (optional)' : 'Service (e.g. light.turn_on)'}" style="flex: 1; padding: 4px;">
                        <input type="text" class="act-payload" value='${act.payload || ''}' placeholder='Payload JSON e.g. {"repeat": 2}' style="flex: 1; padding: 4px;">
                    </div>
                ` : ''}
                ${act.type === 'SLIDER' ? `
                    <div style="display: flex; gap: 5px; margin-top: 5px; align-items: center;">
                        <input type="checkbox" class="act-symmetric" ${act.symmetric_scale ? 'checked' : ''}>
                        <label style="font-size: 12px; color: #ccc;">Symmetric Scale (e.g. 1/5x to 5x)</label>
                    </div>
                ` : ''}
                ${act.type === 'PROGRESS_BAR' ? `
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <input type="number" class="act-min" value="${act.min !== undefined ? act.min : ''}" placeholder="Min (0)" style="flex: 1; padding: 4px; text-align: center;">
                        <input type="text" class="act-max" value="${act.max !== undefined ? act.max : ''}" placeholder="Max (100 / entity)" style="flex: 1; padding: 4px; text-align: center;">
                        <label style="font-size: 12px; color: #ccc; display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" class="act-invert" ${act.invert ? 'checked' : ''}> Full = bad
                        </label>
                    </div>
                ` : ''}
                ${(act.type === 'INFO_DISPLAY' || act.type === 'VALUE_SLIDER' || act.type === 'PROGRESS_BAR') ? `
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        ${(act.type === 'INFO_DISPLAY' || act.type === 'PROGRESS_BAR') ? `<input type="text" class="act-attribute" value="${act.attribute || ''}" placeholder="Attribute (blank = state)" style="flex: 2; padding: 4px;">` : ''}
                        <input type="text" class="act-unit" value="${act.unit !== undefined ? act.unit : ''}" placeholder="Unit (e.g. °C)" style="flex: 1; padding: 4px; text-align: center;">
                        <input type="number" class="act-decimals" value="${act.decimals !== undefined ? act.decimals : ''}" placeholder="Decimals" style="flex: 1; padding: 4px; text-align: center;">
                    </div>
                ` : ''}
            </div>
        `;
        actionsList.appendChild(div);
        
        div.querySelector('.act-header').addEventListener('click', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            
            const headerElement = e.currentTarget;
            const sidebar = document.getElementById('sidebar');
            const rectBefore = headerElement.getBoundingClientRect();
            
            act._expanded = act._expanded === false ? true : false;
            div.querySelector('.act-body').style.display = act._expanded ? 'block' : 'none';
            const chevron = div.querySelector('.act-header .chevron');
            if (chevron) {
                if (act._expanded) chevron.classList.remove('collapsed');
                else chevron.classList.add('collapsed');
            }
            
            const rectAfter = headerElement.getBoundingClientRect();
            if (rectAfter.top !== rectBefore.top && sidebar) {
                sidebar.scrollTop += (rectAfter.top - rectBefore.top);
            }
        });

        div.querySelectorAll('.act-body input, .act-body select').forEach(el => {
            const updateActionObj = () => {
                act.name = div.querySelector('.act-name').value;
                act.trigger = div.querySelector('.act-trigger').value;
                act.type = div.querySelector('.act-type').value;
                act.action_entity = div.querySelector('.act-target').value;
                act.icon = div.querySelector('.act-icon').value;
                act.width = div.querySelector('.act-width').value;
                if (act.type === 'CALL_SERVICE' || act.type === 'PROGRESS_BAR') {
                    const srv = div.querySelector('.act-service');
                    if (srv) act.service = srv.value;
                    const pld = div.querySelector('.act-payload');
                    if (pld) act.payload = pld.value;
                }
                if (act.type === 'SLIDER') {
                    const symm = div.querySelector('.act-symmetric');
                    if (symm) act.symmetric_scale = symm.checked;
                }
                if (act.type === 'PROGRESS_BAR') {
                    const minEl = div.querySelector('.act-min');
                    if (minEl) act.min = minEl.value !== '' ? parseFloat(minEl.value) : undefined;
                    // max may be a number, an entity id, or "attribute:<name>"
                    const maxEl = div.querySelector('.act-max');
                    if (maxEl) act.max = maxEl.value !== '' ? (isNaN(parseFloat(maxEl.value)) ? maxEl.value : parseFloat(maxEl.value)) : undefined;
                    const invEl = div.querySelector('.act-invert');
                    if (invEl) act.invert = invEl.checked || undefined;
                }
                if (act.type === 'INFO_DISPLAY' || act.type === 'VALUE_SLIDER' || act.type === 'PROGRESS_BAR') {
                    const attrEl = div.querySelector('.act-attribute');
                    if (attrEl) act.attribute = attrEl.value || undefined;
                    const unitEl = div.querySelector('.act-unit');
                    if (unitEl) act.unit = unitEl.value !== '' ? unitEl.value : undefined;
                    const decEl = div.querySelector('.act-decimals');
                    if (decEl) act.decimals = decEl.value !== '' ? parseInt(decEl.value) : undefined;
                }
            };
            el.addEventListener('input', () => {
                updateActionObj();
                if (onStateChange) onStateChange(false);
            });
            el.addEventListener('change', () => {
                updateActionObj();
                if (onStateChange) onStateChange(true);
            });
        });
        div.querySelector('.del-act').addEventListener('click', () => {
            sc.config.actions.splice(idx, 1);
            if (onStateChange) onStateChange();
            renderActionsAndStates(sc, onStateChange);
        });
        
        const mvUp = div.querySelector('.mv-up-act');
        if (mvUp) {
            mvUp.addEventListener('click', (e) => {
                e.stopPropagation();
                if (idx > 0) {
                    const temp = sc.config.actions[idx];
                    sc.config.actions[idx] = sc.config.actions[idx - 1];
                    sc.config.actions[idx - 1] = temp;
                    if (onStateChange) onStateChange();
                    renderActionsAndStates(sc, onStateChange);
                }
            });
        }

        const mvDn = div.querySelector('.mv-dn-act');
        if (mvDn) {
            mvDn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (idx < sc.config.actions.length - 1) {
                    const temp = sc.config.actions[idx];
                    sc.config.actions[idx] = sc.config.actions[idx + 1];
                    sc.config.actions[idx + 1] = temp;
                    if (onStateChange) onStateChange();
                    renderActionsAndStates(sc, onStateChange);
                }
            });
        }
    });
    
    sc.config.states.forEach((st, idx) => {
        const isExpanded = st._expanded === true; // folded by default

        // Initialize conditions array for backward compatibility
        if (!st.conditions) {
            if (st.state_entity || st.operator || st.value) {
                st.conditions = [{
                    state_entity: st.state_entity || '',
                    operator: st.operator || '==',
                    value: st.value || ''
                }];
            } else {
                st.conditions = [];
            }
        }

        const title = st.is_default ? (st.name || 'Default State Fallback') : (st.name || st.state_entity || (st.conditions[0]?.state_entity) || 'New State');
        
        const div = document.createElement('div');
        div.style.background = window.previewStateIdx === idx ? 'rgba(14, 165, 233, 0.1)' : 'var(--input-bg)';
        div.style.padding = '8px';
        div.style.borderRadius = '6px';
        div.style.border = window.previewStateIdx === idx ? '2px solid var(--accent)' : '1px solid var(--input-border)';
        div.style.userSelect = 'none';
        
        let rootGroup;
        if (st.conditions.length === 1 && st.conditions[0].rules) {
            rootGroup = st.conditions[0];
        } else {
            rootGroup = {
                type: 'AND',
                rules: st.conditions
            };
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" class="st-header expandable-header">
                <div>
                    <span class="chevron ${isExpanded ? '' : 'collapsed'}">▼</span>
                    <strong style="font-size: 13px; color: ${window.previewStateIdx === idx ? 'var(--accent)' : 'var(--text)'};">${title}</strong>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="preview-st" data-idx="${idx}" style="width: auto; margin: 0; padding: 2px 5px; font-size: 10px; font-weight: bold; background: ${window.previewStateIdx === idx ? 'var(--accent)' : 'var(--btn-hover)'}; color: ${window.previewStateIdx === idx ? 'white' : 'var(--text)'}; border: 1px solid ${window.previewStateIdx === idx ? 'var(--accent)' : 'var(--input-border)'};">${window.previewStateIdx === idx ? '👁️ Previewing' : '👁️ Preview'}</button>
                    <button class="del-st" data-idx="${idx}" style="width: auto; margin: 0; padding: 2px 5px; font-size: 10px;" class="danger">X</button>
                </div>
            </div>
            <div class="st-body" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 10px; border-top: 1px solid var(--input-border); padding-top: 10px;">
                <input type="text" class="st-name" value="${st.name || ''}" placeholder="State Name" style="width: 100%; margin: 0 0 8px 0; padding: 4px;">
                
                <div style="margin-bottom: 8px;">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 11px; color: #ccc;">
                        <input type="checkbox" class="st-isdefault" ${st.is_default ? 'checked' : ''} style="width: auto; margin: 0;"> Is Default State (Fallback)
                    </label>
                </div>

                <div class="st-conditions-group-box" style="margin-bottom: 8px; border: 1px solid var(--input-border); border-radius: 6px; padding: 8px; background: rgba(0,0,0,0.15); display: ${st.is_default ? 'none' : 'block'};">
                    <div style="font-size: 11px; font-weight: bold; color: var(--text); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span>NESTED LOGIC CONDITIONS</span>
                    </div>
                    <div class="st-conditions-container">
                        <!-- Query Builder will be dynamically mounted here -->
                    </div>
                </div>

                <div class="st-default-info-box" style="margin-bottom: 8px; border: 1px solid var(--accent); border-radius: 6px; padding: 8px; background: rgba(14, 165, 233, 0.08); font-size: 11px; color: var(--text); display: ${st.is_default ? 'block' : 'none'};">
                    ℹ️ This state acts as the default fallback when no other conditions match.
                </div>

                <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
                        <input type="color" class="st-color" value="${st.color || '#ffffff'}" style="width: 30px; height: 28px; padding: 0; border: 1px solid var(--input-border); border-radius: 4px; cursor: pointer; flex-shrink: 0;">
                        <input type="text" class="st-color-text" value="${st.color || '#ffffff'}" style="flex: 1; min-width: 0; margin: 0; padding: 4px; font-size: 12px; font-family: monospace;" placeholder="#ffffff">
                    </div>
                    <input type="text" class="st-icon" list="iconList" value="${st.icon || ''}" placeholder="Icon/Emoji" style="flex: 1; margin: 0; padding: 4px;">
                </div>
                <input type="text" class="st-image" list="iconList" value="${st.image || ''}" placeholder="Image URL (e.g. /local/img.png)" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
                <input type="text" class="st-description" value="${st.description || ''}" placeholder="Appearance in this state (e.g. parked on its charging dock)" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
                <div style="margin-bottom: 5px;">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 11px; color: #ccc;">
                        <input type="checkbox" class="st-autorotate" ${st.autoRotate ? 'checked' : ''} style="width: auto; margin: 0;"> Auto-rotate state image with map
                    </label>
                </div>
            </div>
        `;
        statesList.appendChild(div);

        div.querySelector('.preview-st').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.togglePreviewState) {
                window.togglePreviewState(idx);
                
                // Manually update all preview buttons and their containers to reflect active state
                document.querySelectorAll('.preview-st').forEach(btn => {
                    const btnIdx = parseInt(btn.getAttribute('data-idx'));
                    const isActive = window.previewStateIdx === btnIdx;
                    
                    btn.style.background = isActive ? 'var(--accent)' : 'var(--btn-hover)';
                    btn.style.color = isActive ? 'white' : 'var(--text)';
                    btn.style.border = isActive ? '1px solid var(--accent)' : '1px solid var(--input-border)';
                    btn.innerHTML = isActive ? '👁️ Previewing' : '👁️ Preview';
                    
                    const parentDiv = btn.closest('.st-header').parentElement;
                    if (parentDiv) {
                        parentDiv.style.background = isActive ? 'rgba(14, 165, 233, 0.1)' : 'var(--input-bg)';
                        parentDiv.style.border = isActive ? '2px solid var(--accent)' : '1px solid var(--input-border)';
                    }
                    
                    const titleStrong = btn.closest('.st-header').querySelector('strong');
                    if (titleStrong) {
                        titleStrong.style.color = isActive ? 'var(--accent)' : 'var(--text)';
                    }
                });
            }
        });

        div.querySelector('.st-header').addEventListener('click', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            
            const headerElement = e.currentTarget;
            const sidebar = document.getElementById('sidebar');
            const rectBefore = headerElement.getBoundingClientRect();
            
            st._expanded = st._expanded === false ? true : false;
            div.querySelector('.st-body').style.display = st._expanded ? 'block' : 'none';
            const chevron = div.querySelector('.st-header .chevron');
            if (chevron) {
                if (st._expanded) chevron.classList.remove('collapsed');
                else chevron.classList.add('collapsed');
            }
            
            const rectAfter = headerElement.getBoundingClientRect();
            if (rectAfter.top !== rectBefore.top && sidebar) {
                sidebar.scrollTop += (rectAfter.top - rectBefore.top);
            }
        });

        // Bind explicit sync logic for state color swatches and text inputs
        const stColorInput = div.querySelector('.st-color');
        const stColorText = div.querySelector('.st-color-text');
        if (stColorInput && stColorText) {
            const syncStColor = (val) => {
                stColorInput.value = val;
                stColorText.value = val;
                localStorage.setItem('lastStateColor', val);
                st.color = val;
                if (onStateChange) onStateChange(false);
            };
            stColorInput.addEventListener('input', (e) => syncStColor(e.target.value));
            stColorInput.addEventListener('change', (e) => {
                syncStColor(e.target.value);
                if (onStateChange) onStateChange(true);
            });
            stColorText.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncStColor(val);
                }
            });
            stColorText.addEventListener('change', (e) => {
                let val = e.target.value.trim();
                if (/^[0-9A-F]{6}$/i.test(val)) {
                    val = '#' + val;
                }
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncStColor(val);
                    if (onStateChange) onStateChange(true);
                } else {
                    stColorText.value = st.color || '#ffffff';
                }
            });
        }

        // Dynamically mount Nested Query Builder
        const condContainer = div.querySelector('.st-conditions-container');
        if (condContainer) {
            const onUpdate = (rebuildUI) => {
                if (rebuildUI && typeof rebuildUI === 'object' && rebuildUI.action === 'delete_group') {
                    const deleteGroupByPath = (root, targetPath) => {
                        const parts = targetPath.split('.');
                        let curr = root;
                        for (let i = 0; i < parts.length - 2; i++) {
                            const key = parts[i];
                            curr = curr[key];
                        }
                        const lastArrKey = parts[parts.length - 2];
                        const idxToRemove = parseInt(parts[parts.length - 1]);
                        if (curr && Array.isArray(curr[lastArrKey])) {
                            curr[lastArrKey].splice(idxToRemove, 1);
                        }
                    };
                    deleteGroupByPath(rootGroup, rebuildUI.path);
                    rebuildUI = true;
                }
                
                const hasNested = rootGroup.rules.some(r => r.rules);
                if (rootGroup.type === 'AND' && !hasNested) {
                    st.conditions = rootGroup.rules;
                } else {
                    st.conditions = [rootGroup];
                }
                
                // Synchronize the first condition to the top-level keys
                if (st.conditions.length > 0) {
                    if (!hasNested && rootGroup.type === 'AND') {
                        st.state_entity = st.conditions[0].state_entity || '';
                        st.operator = st.conditions[0].operator || '==';
                        st.value = st.conditions[0].value || '';
                    } else {
                        const findFirstLeaf = (g) => {
                            for (const r of (g.rules || [])) {
                                if (r.rules) {
                                    const found = findFirstLeaf(r);
                                    if (found) return found;
                                } else {
                                    return r;
                                }
                            }
                            return null;
                        };
                        const firstLeaf = findFirstLeaf(rootGroup);
                        if (firstLeaf) {
                            st.state_entity = firstLeaf.state_entity || '';
                            st.operator = firstLeaf.operator || '==';
                            st.value = firstLeaf.value || '';
                        } else {
                            st.state_entity = '';
                            st.operator = '==';
                            st.value = '';
                        }
                    }
                } else {
                    st.state_entity = '';
                    st.operator = '==';
                    st.value = '';
                }
                
                if (rebuildUI === true) {
                    if (onStateChange) onStateChange(true);
                    renderActionsAndStates(sc, onStateChange);
                } else {
                    if (onStateChange) onStateChange(false);
                }
            };
            
            const rootEl = renderLogicalGroup(rootGroup, 'root', onUpdate);
            condContainer.appendChild(rootEl);
        }

        const isDefaultCheckbox = div.querySelector('.st-isdefault');
        if (isDefaultCheckbox) {
            isDefaultCheckbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                st.is_default = checked;
                if (checked) {
                    sc.config.states.forEach((otherSt, otherIdx) => {
                        if (otherIdx !== idx) {
                            otherSt.is_default = false;
                        }
                    });
                    st.conditions = [];
                    st.state_entity = '';
                    st.operator = '==';
                    st.value = '';
                }
                if (onStateChange) onStateChange(true);
                renderActionsAndStates(sc, onStateChange);
            });
        }

        // Generic inputs (excluding the color swatch, text hex, and condition rows)
        div.querySelectorAll('.st-body input, .st-body select').forEach(el => {
            if (el.classList.contains('st-color') || el.classList.contains('st-color-text') || el.classList.contains('st-isdefault')) return;
            if (el.closest('.cond-row') || el.classList.contains('add-cond-btn')) return;
            
            const updateStateObj = () => {
                st.name = div.querySelector('.st-name').value;
                st.icon = div.querySelector('.st-icon').value;
                st.image = div.querySelector('.st-image').value;
                st.description = div.querySelector('.st-description').value;
                st.autoRotate = div.querySelector('.st-autorotate').checked;
            };
            el.addEventListener('input', () => {
                updateStateObj();
                if (onStateChange) onStateChange(false);
            });
            el.addEventListener('change', () => {
                updateStateObj();
                if (onStateChange) onStateChange(true);
            });
        });
        div.querySelector('.del-st').addEventListener('click', () => {
            sc.config.states.splice(idx, 1);
            if (onStateChange) onStateChange(true);
            renderActionsAndStates(sc, onStateChange);
        });
    });
}

export function renderVacuumRoomMapping(sc, rooms, lastFetchedVacuumOptions, onStateChange) {
    const container = document.getElementById('roomMappingsList');
    container.innerHTML = '';
    if (!sc.config) sc.config = {};
    if (!sc.config.room_mapping) sc.config.room_mapping = {};
    
    // Clean up legacy inverted mapping IDs
    Object.keys(sc.config.room_mapping).forEach(id => {
        if (id.startsWith('room_')) delete sc.config.room_mapping[id];
    });
    
    // Collect all known Roborock IDs
    let roboRoomIds = new Set(Object.keys(sc.config.room_mapping));
    let optNames = {};
    if (lastFetchedVacuumOptions) {
        lastFetchedVacuumOptions.forEach(opt => {
            roboRoomIds.add(String(opt.id));
            optNames[opt.id] = opt.name;
        });
    }
    
    if (roboRoomIds.size === 0) {
        container.innerHTML = `<div style="font-size:11px; color:#888; margin-top:5px;">Click 'Fetch HA' to pull your vacuum's rooms.</div>`;
        return;
    }
    
    roboRoomIds.forEach(roboId => {
        let val = sc.config.room_mapping[roboId] || '';
        let segVal = (sc.config.segment_mapping && sc.config.segment_mapping[roboId] !== undefined) ? sc.config.segment_mapping[roboId] : '';
        
        // Auto-fill from fetched options if available and not set
        if (segVal === '' && lastFetchedVacuumOptions) {
            const opt = lastFetchedVacuumOptions.find(o => o.id === roboId);
            if (opt && opt.segId !== undefined && opt.segId !== '') {
                segVal = opt.segId;
                if (!sc.config.segment_mapping) sc.config.segment_mapping = {};
                sc.config.segment_mapping[roboId] = parseInt(segVal);
            }
        }
        
        let name = optNames[roboId] ? (String(optNames[roboId]) !== String(roboId) ? `${optNames[roboId]} (${roboId})` : roboId) : `Room ID ${roboId}`;
        let div = document.createElement('div');
        div.style.marginBottom = '5px';
        
        let selectHtml = `<div style="display:flex; gap:5px;"><select class="room-map-input" data-roboroomid="${roboId}" style="flex:1; padding:5px; margin-top:2px; background:var(--bg-secondary); color:var(--text-main); border:1px solid var(--input-border); border-radius:4px;">`;
        selectHtml += `<option value="">-- Ignore --</option>`;
        rooms.forEach(room => {
            if(!room.name) return;
            const selected = (val === room.id) ? 'selected' : '';
            selectHtml += `<option value="${room.id}" ${selected}>${room.name}</option>`;
        });
        selectHtml += `</select>`;
        selectHtml += `<input type="number" class="room-seg-input" data-roboroomid="${roboId}" value="${segVal}" placeholder="Seg ID (e.g. 16)" style="width:100px; padding:5px; margin-top:2px; background:var(--bg-secondary); color:var(--text-main); border:1px solid var(--input-border); border-radius:4px;"></div>`;
        
        div.innerHTML = `<span style="font-size:12px; color:#aaa">Vacuum: ${name}</span> ${selectHtml}`;
        
        container.appendChild(div);
    });
    
    // Real-time binding
    container.querySelectorAll('.room-map-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const rId = e.target.dataset.roboroomid;
            if (!sc.config) sc.config = {};
            if (!sc.config.room_mapping) sc.config.room_mapping = {};
            if (e.target.value === "") {
                delete sc.config.room_mapping[rId];
            } else {
                sc.config.room_mapping[rId] = e.target.value;
            }
            if (onStateChange) onStateChange();
        });
    });

    container.querySelectorAll('.room-seg-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const rId = e.target.dataset.roboroomid;
            if (!sc.config) sc.config = {};
            if (!sc.config.segment_mapping) sc.config.segment_mapping = {};
            if (e.target.value === "") {
                delete sc.config.segment_mapping[rId];
            } else {
                sc.config.segment_mapping[rId] = parseInt(e.target.value);
            }
            if (onStateChange) onStateChange();
        });
    });
}

export function openMenuEditor(sc, onStateChange) {
    const modal = document.getElementById('menuEditorModal');
    const area = document.getElementById('menuCanvasArea');
    const wInput = document.getElementById('menuCanvasW');
    const hInput = document.getElementById('menuCanvasH');
    const closeBtn = document.getElementById('closeMenuEditorBtn');
    
    if (!sc.config.menuWidth) sc.config.menuWidth = 200;
    if (!sc.config.menuHeight) sc.config.menuHeight = 250;
    
    wInput.value = sc.config.menuWidth;
    hInput.value = sc.config.menuHeight;
    
    area.style.width = sc.config.menuWidth + 'px';
    area.style.height = sc.config.menuHeight + 'px';
    
    wInput.onchange = () => {
        sc.config.menuWidth = parseInt(wInput.value) || 200;
        area.style.width = sc.config.menuWidth + 'px';
        if (onStateChange) onStateChange();
    };
    hInput.onchange = () => {
        sc.config.menuHeight = parseInt(hInput.value) || 250;
        area.style.height = sc.config.menuHeight + 'px';
        if (onStateChange) onStateChange();
    };
    
    // Clear area
    area.innerHTML = '';
    
    const longPressActions = sc.config.actions.filter(a => a.trigger === 'long_press' || a.trigger === 'overlay');
    
    longPressActions.forEach((act, idx) => {
        if (act.pos_x === undefined) act.pos_x = 10;
        if (act.pos_y === undefined) act.pos_y = 10 + (idx * 45);
        if (act.width === undefined) act.width = 180;
        if (act.height === undefined) act.height = 35;
        
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = act.pos_x + 'px';
        el.style.top = act.pos_y + 'px';
        el.style.width = act.width + 'px';
        el.style.height = act.height + 'px';
        el.style.background = 'rgba(255,255,255,0.1)';
        el.style.border = '1px solid rgba(255,255,255,0.3)';
        el.style.borderRadius = '6px';
        el.style.color = '#fff';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '12px';
        el.style.userSelect = 'none';
        el.style.boxSizing = 'border-box';
        el.style.cursor = 'grab';
        
        if (act.rotation === undefined) act.rotation = 0;
        el.style.transform = `rotate(${act.rotation}deg)`;
        
        let label = act.name || act.type;
        let iconHtml = '';
        if (act.icon) {
            if (act.icon.startsWith('mdi:') || act.icon.includes(':')) {
                iconHtml = `<ha-icon icon="${act.icon}" style="--mdc-icon-size: 16px; margin-right:5px;"></ha-icon>`;
            } else {
                iconHtml = `<span style="margin-right:5px;">${act.icon}</span>`;
            }
        }
        
        if (act.type === 'SLIDER') {
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; align-items:center; width:100%; height:100%; padding: 0 5px; gap: 5px;">
                    ${iconHtml}<span style="white-space:nowrap; font-size:12px;">${label}</span>
                    <input type="range" value="50" style="flex:1; width:100%; margin:0;">
                </div>
            `;
            el.style.background = 'transparent';
            el.style.border = '1px dashed rgba(255,255,255,0.3)';
        } else if (act.type === 'TOGGLE') {
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; justify-content:space-between; align-items:center; width:100%; height:100%; padding:0 8px;">
                    <div style="display:flex; align-items:center; font-size:13px; gap:6px;">${iconHtml}<span>${label}</span></div>
                    <div style="width:36px; height:20px; background:#10b981; border-radius:10px; position:relative;">
                        <div style="width:16px; height:16px; background:#fff; border-radius:50%; position:absolute; top:2px; left:18px;"></div>
                    </div>
                </div>
            `;
        } else if (act.type === 'TOGGLE_ON' || act.type === 'TOGGLE_OFF' || act.type === 'CALL_SERVICE' || act.type === 'ROOM_SELECTOR') {
            let btnColor = act.type === 'TOGGLE_ON' ? '#10b981' : (act.type === 'TOGGLE_OFF' ? '#ef4444' : '#fff');
            let borderColor = act.type === 'TOGGLE_ON' ? 'rgba(16, 185, 129, 0.4)' : (act.type === 'TOGGLE_OFF' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.2)');
            if (act.type === 'ROOM_SELECTOR') { btnColor = '#0ea5e9'; borderColor = 'rgba(14, 165, 233, 0.4)'; }
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; justify-content:center; align-items:center; width:100%; height:100%; background:rgba(255,255,255,0.1); border:1px solid ${borderColor}; border-radius:6px; color:${btnColor}; gap:8px;">
                    ${iconHtml}<span>${label}</span>
                </div>
            `;
            el.style.background = 'transparent';
            el.style.border = 'none';
        } else if (act.type === 'VALUE_SLIDER') {
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; flex-direction:column; justify-content:center; width:100%; height:100%; padding:0 5px; gap:2px;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <span style="white-space:nowrap; font-size:12px; font-weight:bold;">${iconHtml}${label}</span>
                        <span style="font-size:13px; font-weight:700; color:#7dd3fc;">${act.unit ? '00 ' + act.unit : '00'}</span>
                    </div>
                    <input type="range" value="50" style="width:100%; margin:0;">
                </div>
            `;
            el.style.background = 'transparent';
            el.style.border = '1px dashed rgba(125,211,252,0.5)';
        } else if (act.type === 'INFO_DISPLAY') {
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; flex-direction:column; justify-content:center; width:100%; height:100%; padding:4px 8px; gap:2px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:8px; box-sizing:border-box;">
                    <span style="font-size:10px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:#94a3b8;">${label}</span>
                    <span style="font-size:16px; font-weight:700; color:#fff;">${iconHtml}00${act.unit ? ' ' + act.unit : ''}</span>
                </div>
            `;
            el.style.background = 'transparent';
            el.style.border = 'none';
        } else if (act.type === 'PROGRESS_BAR') {
            el.innerHTML = `
                <div style="pointer-events:none; display:flex; flex-direction:column; justify-content:center; width:100%; height:100%; gap:3px; box-sizing:border-box;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#cbd5e1;">
                        <span style="overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${iconHtml}${label}</span>
                        <span style="font-weight:700; color:#fff;">00${act.unit ? ' ' + act.unit : ''}</span>
                    </div>
                    <div style="width:100%; height:${act.bar_height || 8}px; border-radius:999px; background:rgba(255,255,255,0.12); overflow:hidden;">
                        <div style="width:60%; height:100%; border-radius:999px; background:#10b981;"></div>
                    </div>
                </div>
            `;
            el.style.background = 'transparent';
            el.style.border = '1px dashed rgba(16,185,129,0.4)';
        } else {
            el.innerHTML = `<span style="pointer-events:none; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${act.icon || ''} ${label}</span>`;
        }

        el.title = "Drag to move. Drag bottom-right corner to resize. Scroll wheel to rotate.";
        
        const resizer = document.createElement('div');
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.width = '0';
        resizer.style.height = '0';
        resizer.style.borderLeft = '8px solid transparent';
        resizer.style.borderBottom = '8px solid rgba(255,255,255,0.8)';
        resizer.style.background = 'transparent';
        resizer.style.cursor = 'se-resize';
        el.appendChild(resizer);
        
        let isDragging = false;
        let isResizing = false;
        let startX, startY, startPosX, startPosY, startW, startH;
        
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            
            if (e.target === resizer) {
                isResizing = true;
                startW = act.width;
                startH = act.height;
            } else {
                isDragging = true;
                startPosX = act.pos_x;
                startPosY = act.pos_y;
                el.style.cursor = 'grabbing';
            }
            el.setPointerCapture(e.pointerId);
        });
        
        el.addEventListener('pointermove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                act.pos_x = Math.round(startPosX + dx);
                act.pos_y = Math.round(startPosY + dy);
                el.style.left = act.pos_x + 'px';
                el.style.top = act.pos_y + 'px';
            } else if (isResizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                act.width = Math.max(20, Math.round(startW + dx));
                act.height = Math.max(20, Math.round(startH + dy));
                el.style.width = act.width + 'px';
                el.style.height = act.height + 'px';
            }
        });
        
        el.addEventListener('pointerup', (e) => {
            if (isDragging || isResizing) {
                if (isDragging) el.style.cursor = 'grab';
                isDragging = false;
                isResizing = false;
                el.releasePointerCapture(e.pointerId);
                if (onStateChange) onStateChange();
            }
        });
        
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            act.rotation = ((act.rotation || 0) + (e.deltaY > 0 ? 15 : -15)) % 360;
            if (act.rotation < 0) act.rotation += 360;
            el.style.transform = `rotate(${act.rotation}deg)`;
            if (onStateChange) onStateChange();
        });
        
        area.appendChild(el);
    });
    
    modal.style.display = 'flex';
    
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
}

/**
 * Recursively renders a logical group inside the sidebar UI.
 */
function renderLogicalGroup(group, path, onUpdate) {
    const container = document.createElement('div');
    container.className = 'query-group-card';
    container.style.border = '1px solid var(--input-border)';
    container.style.borderRadius = '6px';
    container.style.background = 'rgba(0, 0, 0, 0.2)';
    container.style.padding = '8px';
    container.style.margin = '4px 0';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '6px';
    container.style.position = 'relative';

    // 1. Group Header: Logical operator switch (AND / OR)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = '6px';
    
    const label = document.createElement('span');
    label.textContent = 'Logical Match:';
    label.style.fontSize = '11px';
    label.style.fontWeight = 'bold';
    label.style.color = '#aaa';
    header.appendChild(label);
    
    const operatorSwitcher = document.createElement('div');
    operatorSwitcher.style.display = 'flex';
    operatorSwitcher.style.gap = '2px';
    
    const operators = ['AND', 'OR'];
    operators.forEach(op => {
        const btn = document.createElement('button');
        btn.textContent = op;
        btn.style.padding = '2px 6px';
        btn.style.fontSize = '9px';
        btn.style.borderRadius = '3px';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.margin = '0';
        btn.style.width = 'auto';
        
        const isActive = (group.type || 'AND') === op;
        btn.style.background = isActive ? 'var(--accent)' : 'var(--btn-hover)';
        btn.style.color = isActive ? 'white' : 'var(--text)';
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            group.type = op;
            onUpdate(true); // Structure change, rebuild UI
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
        delBtn.style.fontSize = '11px';
        delBtn.style.padding = '2px';
        delBtn.style.width = 'auto';
        delBtn.style.margin = '0';
        delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onUpdate({ action: 'delete_group', path });
        });
        header.appendChild(delBtn);
    }
    container.appendChild(header);

    // 2. Rules List (Leaf rows and nested groups)
    const rulesContainer = document.createElement('div');
    rulesContainer.style.display = 'flex';
    rulesContainer.style.flexDirection = 'column';
    rulesContainer.style.gap = '4px';
    rulesContainer.style.paddingLeft = '6px';
    rulesContainer.style.borderLeft = '1.5px solid var(--input-border)';
    
    const rules = group.rules || [];
    if (rules.length === 0) {
        const emptyHint = document.createElement('div');
        emptyHint.style.fontSize = '10px';
        emptyHint.style.color = '#666';
        emptyHint.style.textAlign = 'center';
        emptyHint.style.padding = '4px';
        emptyHint.textContent = 'No rules in this group.';
        rulesContainer.appendChild(emptyHint);
    } else {
        rules.forEach((rule, idx) => {
            const rulePath = path === 'root' ? `rules.${idx}` : `${path}.rules.${idx}`;
            
            if (rule.rules) {
                // Recursive subgroup rendering
                const subGroupEl = renderLogicalGroup(rule, rulePath, onUpdate);
                rulesContainer.appendChild(subGroupEl);
            } else {
                // Leaf-level comparison row
                const row = document.createElement('div');
                row.className = 'cond-row';
                row.style.display = 'flex';
                row.style.gap = '4px';
                row.style.alignItems = 'center';
                
                // Entity Input
                const entityInput = document.createElement('input');
                entityInput.type = 'text';
                entityInput.placeholder = 'Entity ID';
                entityInput.value = rule.state_entity || rule.entity || '';
                entityInput.setAttribute('list', 'entityList');
                entityInput.style.flex = '2';
                entityInput.style.padding = '4px';
                entityInput.style.fontSize = '11px';
                entityInput.style.borderRadius = '4px';
                entityInput.style.border = '1px solid var(--input-border)';
                entityInput.style.background = 'var(--input-bg)';
                entityInput.style.color = 'var(--text)';
                entityInput.style.margin = '0';
                
                entityInput.addEventListener('input', (e) => {
                    rule.state_entity = e.target.value;
                    rule.entity = e.target.value; // sync for legacy compatibility
                    onUpdate(false); // Live preview update, do not rebuild UI
                });
                entityInput.addEventListener('change', () => {
                    onUpdate(true); // Complete typing, rebuild UI
                });
                row.appendChild(entityInput);
                
                // Operator Select
                const opSelect = document.createElement('select');
                opSelect.style.flex = '1';
                opSelect.style.padding = '4px';
                opSelect.style.fontSize = '11px';
                opSelect.style.borderRadius = '4px';
                opSelect.style.border = '1px solid var(--input-border)';
                opSelect.style.background = 'var(--input-bg)';
                opSelect.style.color = 'var(--text)';
                opSelect.style.margin = '0';
                
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
                    onUpdate(true); // Structure change, rebuild UI
                });
                row.appendChild(opSelect);
                
                // Value Input
                const valInput = document.createElement('input');
                valInput.type = 'text';
                valInput.placeholder = 'Value';
                valInput.value = rule.value || '';
                valInput.style.flex = '1.3';
                valInput.style.padding = '4px';
                valInput.style.fontSize = '11px';
                valInput.style.borderRadius = '4px';
                valInput.style.border = '1px solid var(--input-border)';
                valInput.style.background = 'var(--input-bg)';
                valInput.style.color = 'var(--text)';
                valInput.style.margin = '0';
                
                valInput.addEventListener('input', (e) => {
                    rule.value = e.target.value;
                    onUpdate(false); // Live preview update, do not rebuild UI
                });
                valInput.addEventListener('change', () => {
                    onUpdate(true); // Complete typing, rebuild UI
                });
                row.appendChild(valInput);
                
                // Delete Rule Button
                const delRuleBtn = document.createElement('button');
                delRuleBtn.textContent = '✕';
                delRuleBtn.style.background = '#ef4444';
                delRuleBtn.style.border = 'none';
                delRuleBtn.style.color = 'white';
                delRuleBtn.style.cursor = 'pointer';
                delRuleBtn.style.borderRadius = '4px';
                delRuleBtn.style.padding = '4px 6px';
                delRuleBtn.style.fontSize = '9px';
                delRuleBtn.style.width = 'auto';
                delRuleBtn.style.margin = '0';
                delRuleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rules.splice(idx, 1);
                    onUpdate(true); // Rebuild UI
                });
                row.appendChild(delRuleBtn);
                
                rulesContainer.appendChild(row);
            }
        });
    }
    container.appendChild(rulesContainer);

    // 3. Bottom controls: Add Rule or Add Nested Group
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';
    controls.style.marginTop = '2px';
    
    const addRuleBtn = document.createElement('button');
    addRuleBtn.textContent = '+ Add Rule';
    addRuleBtn.style.padding = '3px 6px';
    addRuleBtn.style.fontSize = '9px';
    addRuleBtn.style.borderRadius = '4px';
    addRuleBtn.style.border = '1px dashed var(--accent)';
    addRuleBtn.style.color = 'var(--accent)';
    addRuleBtn.style.background = 'none';
    addRuleBtn.style.cursor = 'pointer';
    addRuleBtn.style.width = 'auto';
    addRuleBtn.style.margin = '0';
    addRuleBtn.style.fontWeight = 'bold';
    addRuleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        rules.push({ state_entity: '', operator: '==', value: '' });
        onUpdate(true); // Rebuild UI
    });
    controls.appendChild(addRuleBtn);

    const addGroupBtn = document.createElement('button');
    addGroupBtn.textContent = '+ Add Group';
    addGroupBtn.style.padding = '3px 6px';
    addGroupBtn.style.fontSize = '9px';
    addGroupBtn.style.borderRadius = '4px';
    addGroupBtn.style.border = '1px dashed var(--accent)';
    addGroupBtn.style.color = 'var(--accent)';
    addGroupBtn.style.background = 'none';
    addGroupBtn.style.cursor = 'pointer';
    addGroupBtn.style.width = 'auto';
    addGroupBtn.style.margin = '0';
    addGroupBtn.style.fontWeight = 'bold';
    addGroupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        rules.push({ type: 'AND', rules: [{ state_entity: '', operator: '==', value: '' }] });
        onUpdate(true); // Rebuild UI
    });
    controls.appendChild(addGroupBtn);
    
    container.appendChild(controls);
    
    return container;
}
