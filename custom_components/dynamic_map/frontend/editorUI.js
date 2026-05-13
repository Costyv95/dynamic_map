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
        const isExpanded = act._expanded !== false; // expanded by default
        const title = act.name || act.action_entity || 'New Action';
        
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
                    </select>
                </div>
                <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                    <input type="text" class="act-target" list="entityList" value="${act.action_entity || ''}" placeholder="Action Entity" style="flex: 2; margin: 0; padding: 4px;">
                    <input type="text" class="act-icon" value="${act.icon || ''}" placeholder="Menu Icon" style="flex: 1; margin: 0; padding: 4px; text-align: center;">
                    <input type="text" class="act-width" value="${act.width || ''}" placeholder="Width (e.g. 150px)" style="flex: 1; margin: 0; padding: 4px; text-align: center;">
                </div>
                ${act.type === 'CALL_SERVICE' ? `<input type="text" class="act-service" list="serviceList" value="${act.service || ''}" placeholder="Service (e.g. light.turn_on)" style="width: 100%; margin-top: 5px; padding: 4px;">` : ''}
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
            el.addEventListener('change', () => {
                act.name = div.querySelector('.act-name').value;
                act.trigger = div.querySelector('.act-trigger').value;
                act.type = div.querySelector('.act-type').value;
                act.action_entity = div.querySelector('.act-target').value;
                act.icon = div.querySelector('.act-icon').value;
                act.width = div.querySelector('.act-width').value;
                if (act.type === 'CALL_SERVICE' && div.querySelector('.act-service')) {
                    act.service = div.querySelector('.act-service').value;
                }
                if (onStateChange) onStateChange();
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
        const isExpanded = st._expanded !== false; // expanded by default
        const title = st.name || st.state_entity || 'New State';
        
        const div = document.createElement('div');
        div.style.background = window.previewStateIdx === idx ? 'rgba(14, 165, 233, 0.1)' : 'var(--input-bg)';
        div.style.padding = '8px';
        div.style.borderRadius = '6px';
        div.style.border = window.previewStateIdx === idx ? '2px solid var(--accent)' : '1px solid var(--input-border)';
        div.style.userSelect = 'none';
        
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
                <input type="text" class="st-name" value="${st.name || ''}" placeholder="State Name" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
                <input type="text" class="st-entity" list="entityList" value="${st.state_entity || ''}" placeholder="State Entity ID" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
                <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                    <select class="st-op" style="margin: 0; padding: 4px; flex: 1;">
                        <option value="==" ${st.operator === '==' ? 'selected' : ''}>==</option>
                        <option value="!=" ${st.operator === '!=' ? 'selected' : ''}>!=</option>
                    </select>
                    <input type="text" class="st-val" value="${st.value || ''}" placeholder="Value" style="flex: 2; margin: 0; padding: 4px;">
                </div>
                <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px;">
                    <input type="color" class="st-color" value="${st.color || '#ffffff'}" style="width: 30px; height: 24px; padding: 0; margin: 0; border: none;">
                    <input type="text" class="st-icon" value="${st.icon || ''}" placeholder="Icon/Emoji" style="flex: 1; margin: 0; padding: 4px;">
                </div>
                <input type="text" class="st-image" value="${st.image || ''}" placeholder="Image URL (e.g. /local/img.png)" style="width: 100%; margin: 0 0 5px 0; padding: 4px;">
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

        div.querySelectorAll('.st-body input, .st-body select').forEach(el => {
            el.addEventListener('change', () => {
                st.name = div.querySelector('.st-name').value;
                st.state_entity = div.querySelector('.st-entity').value;
                st.operator = div.querySelector('.st-op').value;
                st.value = div.querySelector('.st-val').value;
                st.color = div.querySelector('.st-color').value;
                st.icon = div.querySelector('.st-icon').value;
                st.image = div.querySelector('.st-image').value;
            });
        });
        div.querySelector('.del-st').addEventListener('click', () => {
            sc.config.states.splice(idx, 1);
            if (onStateChange) onStateChange();
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
        let name = optNames[roboId] || `Room ID ${roboId}`;
        let div = document.createElement('div');
        div.style.marginBottom = '5px';
        
        let selectHtml = `<select class="room-map-input" data-roboroomid="${roboId}" style="width:100%; padding:5px; margin-top:2px; background:var(--bg-secondary); color:var(--text-main); border:1px solid var(--input-border); border-radius:4px;">`;
        selectHtml += `<option value="">-- Ignore --</option>`;
        rooms.forEach(room => {
            if(!room.name) return;
            const selected = (val === room.id) ? 'selected' : '';
            selectHtml += `<option value="${room.id}" ${selected}>${room.name}</option>`;
        });
        selectHtml += `</select>`;
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
        
        let label = act.name || act.type;
        el.innerHTML = `<span style="pointer-events:none; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${act.icon || ''} ${label}</span>`;
        
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
        
        area.appendChild(el);
    });
    
    modal.style.display = 'flex';
    
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
}
