export class OverlayManager {
    static showActionMenu(mapContext, shortcut, actions, event) {
        if (mapContext.activeOverlay) {
            mapContext.activeOverlay.remove();
        }
        
        // Ensure we capture clicks outside to close the overlay
        const outsideClickListener = (e) => {
            if (mapContext.activeOverlay && !mapContext.activeOverlay.contains(e.composedPath()[0])) {
                mapContext.activeOverlay.remove();
                mapContext.activeOverlay = null;
                document.removeEventListener('pointerdown', outsideClickListener);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', outsideClickListener), 50);

        mapContext.activeOverlay = document.createElement('div');
        mapContext.activeOverlay.style.position = 'absolute';
        
        // Calculate position relative to renderRoot
        const rect = mapContext.renderRoot.getBoundingClientRect();
        let posX = event.clientX - rect.left;
        let posY = event.clientY - rect.top;
        
        mapContext.activeOverlay.style.left = `${posX}px`;
        mapContext.activeOverlay.style.top = `${posY}px`;
        mapContext.activeOverlay.style.transform = 'translate(-50%, -100%) translateY(-20px)';
        mapContext.activeOverlay.style.background = 'rgba(30, 41, 59, 0.9)';
        mapContext.activeOverlay.style.backdropFilter = 'blur(10px)';
        mapContext.activeOverlay.style.borderRadius = '12px';
        mapContext.activeOverlay.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
        mapContext.activeOverlay.style.zIndex = '1000';
        mapContext.activeOverlay.style.color = '#fff';
        
        const isVisual = shortcut.sc && shortcut.sc.config && shortcut.sc.config.menuWidth;
        if (isVisual) {
            mapContext.activeOverlay.style.width = shortcut.sc.config.menuWidth + 'px';
            mapContext.activeOverlay.style.height = shortcut.sc.config.menuHeight + 'px';
            mapContext.activeOverlay.style.display = 'block';
            mapContext.activeOverlay.style.padding = '0';
            mapContext.activeOverlay.style.overflow = 'hidden';
        } else {
            mapContext.activeOverlay.style.padding = '10px';
            mapContext.activeOverlay.style.display = 'flex';
            mapContext.activeOverlay.style.flexDirection = 'column';
            mapContext.activeOverlay.style.gap = '10px';
        }

        actions.forEach(act => {
            const target = act.action_entity || shortcut.sc.entity_id;
            
            if (act.type === 'SLIDER') {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '5px';
                
                const label = document.createElement('span');
                const displayName = act.name !== undefined ? act.name : 'Brightness';
                if (displayName) {
                    label.textContent = displayName;
                    label.style.fontSize = '12px';
                    label.style.fontWeight = 'bold';
                    container.appendChild(label);
                }
                
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = '1';
                slider.max = '100';
                
                if (mapContext._hass && mapContext._hass.states[target]) {
                    if (target.startsWith('input_number.')) {
                        slider.value = parseFloat(mapContext._hass.states[target].state);
                    } else if (mapContext._hass.states[target].attributes.brightness) {
                        slider.value = Math.round((mapContext._hass.states[target].attributes.brightness / 255) * 100);
                    } else {
                        slider.value = '50';
                    }
                } else {
                    slider.value = '50';
                }
                if (act.width) slider.style.width = act.width;
                else slider.style.width = '150px';
                
                slider.addEventListener('change', (e) => {
                    if (!mapContext._hass) return;
                    const domain = target.split('.')[0];
                    if (domain === 'input_number') {
                        mapContext._hass.callService('input_number', 'set_value', {
                            entity_id: target,
                            value: parseFloat(e.target.value)
                        });
                    } else {
                        mapContext._hass.callService(domain, 'turn_on', {
                            entity_id: target,
                            brightness_pct: parseInt(e.target.value)
                        });
                    }
                });
                
                if (isVisual && act.pos_x !== undefined) {
                    container.style.position = 'absolute';
                    container.style.left = act.pos_x + 'px';
                    container.style.top = act.pos_y + 'px';
                    container.style.width = act.width + 'px';
                    container.style.height = act.height + 'px';
                    slider.style.width = '100%';
                    container.style.margin = '0';
                    container.style.justifyContent = 'center';
                    if (!displayName) container.style.alignItems = 'center';
                    if (act.rotation) container.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                if (displayName) {
                    container.appendChild(slider);
                    mapContext.activeOverlay.appendChild(container);
                } else {
                    if (isVisual && act.pos_x !== undefined) {
                        container.appendChild(slider);
                        mapContext.activeOverlay.appendChild(container);
                    } else {
                        mapContext.activeOverlay.appendChild(slider);
                    }
                }
            } else if (act.type === 'TOGGLE') {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';
                container.style.gap = '15px';
                container.style.padding = '6px 4px';
                if (act.width) container.style.width = act.width;
                
                let iconHtml = act.icon ? `<span style="margin-right:8px">${act.icon}</span>` : '';
                const displayName = act.name !== undefined ? act.name : 'Toggle';
                
                const label = document.createElement('span');
                label.innerHTML = `${iconHtml}${displayName}`;
                label.style.fontSize = '13px';
                
                let isOn = false;
                if (mapContext._hass && mapContext._hass.states[target]) {
                    isOn = mapContext._hass.states[target].state === 'on';
                }
                
                const switchWrap = document.createElement('div');
                switchWrap.style.width = '36px';
                switchWrap.style.height = '20px';
                switchWrap.style.background = isOn ? '#10b981' : 'rgba(255,255,255,0.2)';
                switchWrap.style.borderRadius = '10px';
                switchWrap.style.position = 'relative';
                switchWrap.style.cursor = 'pointer';
                switchWrap.style.transition = 'background 0.2s';
                
                const thumb = document.createElement('div');
                thumb.style.width = '16px';
                thumb.style.height = '16px';
                thumb.style.background = '#fff';
                thumb.style.borderRadius = '50%';
                thumb.style.position = 'absolute';
                thumb.style.top = '2px';
                thumb.style.left = isOn ? '18px' : '2px';
                thumb.style.transition = 'left 0.2s';
                
                switchWrap.appendChild(thumb);
                
                switchWrap.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!mapContext._hass) return;
                    const domain = target.split('.')[0];
                    let service = 'toggle';
                    if (domain === 'vacuum') service = 'start_pause';
                    mapContext._hass.callService(domain, service, { entity_id: target });
                    
                    // Optimistic update
                    isOn = !isOn;
                    switchWrap.style.background = isOn ? '#10b981' : 'rgba(255,255,255,0.2)';
                    thumb.style.left = isOn ? '18px' : '2px';
                });
                
                container.appendChild(label);
                container.appendChild(switchWrap);
                
                if (isVisual && act.pos_x !== undefined) {
                    container.style.position = 'absolute';
                    container.style.left = act.pos_x + 'px';
                    container.style.top = act.pos_y + 'px';
                    container.style.width = act.width + 'px';
                    container.style.height = act.height + 'px';
                    container.style.margin = '0';
                    if (act.rotation) container.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                mapContext.activeOverlay.appendChild(container);

            } else if (act.type && (act.type === 'TOGGLE_ON' || act.type === 'TOGGLE_OFF' || act.type === 'CALL_SERVICE' || act.type === 'ROOM_SELECTOR')) {
                const btn = document.createElement('button');
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.border = '1px solid rgba(255,255,255,0.2)';
                btn.style.borderRadius = '6px';
                btn.style.padding = '8px';
                btn.style.color = '#fff';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '13px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.gap = '8px';
                if (act.width) btn.style.width = act.width;
                
                if (act.type === 'TOGGLE_ON') {
                    btn.style.color = '#10b981';
                    btn.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                } else if (act.type === 'TOGGLE_OFF') {
                    btn.style.color = '#ef4444';
                    btn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                } else if (act.type === 'ROOM_SELECTOR') {
                    btn.style.color = '#0ea5e9';
                    btn.style.border = '1px solid rgba(14, 165, 233, 0.4)';
                }
                
                let iconHtml = '';
                if (act.icon) {
                    iconHtml = `<span>${act.icon}</span>`;
                }
                
                let defaultName = act.type;
                if (act.type === 'TOGGLE_ON') defaultName = 'Turn On';
                if (act.type === 'TOGGLE_OFF') defaultName = 'Turn Off';
                if (act.type === 'CALL_SERVICE') defaultName = 'Run Action';
                if (act.type === 'ROOM_SELECTOR') defaultName = 'Select Rooms';
                
                const displayName = act.name !== undefined ? act.name : defaultName;
                const textHtml = displayName ? `<span>${displayName}</span>` : '';
                
                btn.innerHTML = `${iconHtml}${textHtml}`;
                
                // Add hover effect
                btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
                btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.1)';
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!mapContext._hass || !target) return;
                    
                    if (act.type === 'ROOM_SELECTOR') {
                        if (mapContext.activeOverlay) {
                            mapContext.activeOverlay.remove();
                            mapContext.activeOverlay = null;
                        }
                        mapContext.isSelectingRooms = true;
                        mapContext.selectedRoomIds = [];
                        mapContext.selectionVacuumTarget = target;
                        mapContext.updateRoomStyles();
                        OverlayManager.showRoomSelectionUI(mapContext);
                        return;
                    }
                    
                    if (act.type === 'CALL_SERVICE' && act.service) {
                        const parts = act.service.split('.');
                        if (parts.length === 2) {
                            let payload = { entity_id: target };
                            if (act.payload) {
                                try {
                                    const parsed = JSON.parse(act.payload);
                                    
                                    // Build mapping dictionary: Room Name -> Roborock ID
                                    let nameToRoboId = {};
                                    let scConfig = null;
                                    Object.values(mapContext.shortcutElements).forEach(scEl => {
                                        if (scEl.sc && scEl.sc.entity_id === target) scConfig = scEl.sc.config;
                                    });
                                    if (scConfig && scConfig.room_mapping && mapContext.rooms) {
                                        for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
                                            const roomDef = mapContext.rooms.find(r => r.id === svgRoomId);
                                            if (roomDef && roomDef.name) {
                                                if (scConfig.segment_mapping && scConfig.segment_mapping[roboId] !== undefined) {
                                                    nameToRoboId[roomDef.name] = scConfig.segment_mapping[roboId];
                                                } else {
                                                    nameToRoboId[roomDef.name] = isNaN(roboId) ? roboId : parseInt(roboId);
                                                }
                                            }
                                        }
                                    }
                                    
                                    const replaceNamesWithIds = (obj) => {
                                        if (Array.isArray(obj)) {
                                            for (let i = 0; i < obj.length; i++) {
                                                if (typeof obj[i] === 'string' && nameToRoboId[obj[i]] !== undefined) obj[i] = nameToRoboId[obj[i]];
                                                else if (typeof obj[i] === 'object' && obj[i] !== null) replaceNamesWithIds(obj[i]);
                                            }
                                        } else if (typeof obj === 'object' && obj !== null) {
                                            for (const key in obj) {
                                                if (typeof obj[key] === 'string' && nameToRoboId[obj[key]] !== undefined) obj[key] = nameToRoboId[obj[key]];
                                                else if (typeof obj[key] === 'object' && obj[key] !== null) replaceNamesWithIds(obj[key]);
                                            }
                                        }
                                    };
                                    
                                    if (Object.keys(nameToRoboId).length > 0) {
                                        replaceNamesWithIds(parsed);
                                    }
                                    
                                    payload = { ...payload, ...parsed };
                                } catch (e) {
                                    console.error("[DynamicMap] Failed to parse action payload:", e);
                                }
                            }
                            mapContext._hass.callService(parts[0], parts[1], payload);
                        }
                    } else if (act.type.startsWith('TOGGLE')) {
                        const domain = target.split('.')[0];
                        let service = act.type === 'TOGGLE_ON' ? 'turn_on' : 'turn_off';
                        
                        if (domain === 'vacuum') {
                            if (service === 'turn_on') service = 'start';
                            else if (service === 'turn_off') service = 'return_to_base';
                        }
                        
                        mapContext._hass.callService(domain, service, { entity_id: target });
                    }
                });
                if (isVisual && act.pos_x !== undefined) {
                    btn.style.position = 'absolute';
                    btn.style.left = act.pos_x + 'px';
                    btn.style.top = act.pos_y + 'px';
                    btn.style.width = act.width + 'px';
                    btn.style.height = act.height + 'px';
                    btn.style.margin = '0';
                    if (act.rotation) btn.style.transform = `rotate(${act.rotation}deg)`;
                }
                
                mapContext.activeOverlay.appendChild(btn);
            }
        });
        
        mapContext.renderRoot.appendChild(mapContext.activeOverlay);
    }

    static showRoomSelectionUI(mapContext) {
        if (mapContext.roomSelectionUI) mapContext.roomSelectionUI.remove();
        
        mapContext.roomSelectionUI = document.createElement('div');
        mapContext.roomSelectionUI.style.position = 'absolute';
        mapContext.roomSelectionUI.style.bottom = '20px';
        mapContext.roomSelectionUI.style.left = '50%';
        mapContext.roomSelectionUI.style.transform = 'translateX(-50%)';
        mapContext.roomSelectionUI.style.background = 'rgba(15, 23, 42, 0.95)';
        mapContext.roomSelectionUI.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        mapContext.roomSelectionUI.style.borderRadius = '12px';
        mapContext.roomSelectionUI.style.padding = '15px';
        mapContext.roomSelectionUI.style.color = '#fff';
        mapContext.roomSelectionUI.style.display = 'flex';
        mapContext.roomSelectionUI.style.flexDirection = 'column';
        mapContext.roomSelectionUI.style.gap = '15px';
        mapContext.roomSelectionUI.style.backdropFilter = 'blur(10px)';
        mapContext.roomSelectionUI.style.boxShadow = '0px 10px 30px rgba(0,0,0,0.5)';
        mapContext.roomSelectionUI.style.zIndex = '1001';
        
        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.fontWeight = 'bold';
        header.style.fontSize = '14px';
        header.innerText = 'Select Rooms on Map to Clean';
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        controls.style.justifyContent = 'center';
        
        const repeats = document.createElement('select');
        repeats.innerHTML = '<option value="1">1x (Default)</option><option value="2">2x (Deep)</option><option value="3">3x (Max)</option>';
        repeats.style.background = 'rgba(0,0,0,0.5)';
        repeats.style.color = '#fff';
        repeats.style.border = '1px solid rgba(255,255,255,0.2)';
        repeats.style.borderRadius = '6px';
        repeats.style.padding = '8px';
        
        const mode = document.createElement('select');
        mode.innerHTML = '<option value="vac_mop">Vac & Mop</option><option value="vacuum">Vacuum Only</option><option value="mop">Mop Only</option>';
        mode.style.background = 'rgba(0,0,0,0.5)';
        mode.style.color = '#fff';
        mode.style.border = '1px solid rgba(255,255,255,0.2)';
        mode.style.borderRadius = '6px';
        mode.style.padding = '8px';
        
        controls.appendChild(repeats);
        controls.appendChild(mode);
        
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '10px';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.style.flex = '1';
        cancelBtn.style.padding = '10px';
        cancelBtn.style.background = 'rgba(255,255,255,0.1)';
        cancelBtn.style.color = '#fff';
        cancelBtn.style.border = '1px solid rgba(255,255,255,0.2)';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = () => {
            mapContext.isSelectingRooms = false;
            mapContext.roomSelectionUI.remove();
            mapContext.updateRoomStyles();
            if (mapContext.selectionInterval) clearInterval(mapContext.selectionInterval);
        };
        
        const startBtn = document.createElement('button');
        startBtn.innerText = 'Start Cleaning (0)';
        startBtn.style.flex = '2';
        startBtn.style.padding = '10px';
        startBtn.style.background = '#475569';
        startBtn.style.color = '#fff';
        startBtn.style.border = 'none';
        startBtn.style.borderRadius = '6px';
        startBtn.style.cursor = 'pointer';
        startBtn.style.fontWeight = 'bold';
        startBtn.onclick = () => {
            if (!mapContext.selectedRoomIds || mapContext.selectedRoomIds.length === 0) return;
            
            let scConfig = null;
            Object.values(mapContext.shortcutElements).forEach(scEl => {
                if (scEl.sc && scEl.sc.entity_id === mapContext.selectionVacuumTarget) {
                    scConfig = scEl.sc.config;
                }
            });
            
            let segments = [];
            if (scConfig && scConfig.room_mapping) {
                mapContext.selectedRoomIds.forEach(id => {
                    let mappedId = null;
                    for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
                        if (svgRoomId === id) {
                            if (scConfig.segment_mapping && scConfig.segment_mapping[roboId] !== undefined) {
                                mappedId = scConfig.segment_mapping[roboId];
                            } else {
                                mappedId = roboId;
                            }
                            break;
                        }
                    }
                    if (mappedId !== null) segments.push(isNaN(mappedId) ? mappedId : parseInt(mappedId));
                });
            }
            
            if (segments.length === 0) {
                console.warn('[DynamicMap] No mapped room segments found for selection!');
                return;
            }
            
            const domain = mapContext.selectionVacuumTarget.split('.')[0];
            if (domain === 'roborock') {
                if (mode.value === 'vacuum') {
                    mapContext._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: mapContext.selectionVacuumTarget, mop_mode: 'off' }).catch(e => {});
                } else if (mode.value === 'mop') {
                    mapContext._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: mapContext.selectionVacuumTarget, mop_mode: 'standard' }).catch(e => {});
                    mapContext._hass.callService('vacuum', 'set_fan_speed', { entity_id: mapContext.selectionVacuumTarget, fan_speed: 'off' }).catch(e => {});
                } else {
                    mapContext._hass.callService('roborock', 'vacuum_set_mop_mode', { entity_id: mapContext.selectionVacuumTarget, mop_mode: 'standard' }).catch(e => {});
                    mapContext._hass.callService('vacuum', 'set_fan_speed', { entity_id: mapContext.selectionVacuumTarget, fan_speed: 'balanced' }).catch(e => {});
                }
            }
            
            mapContext._hass.callService('vacuum', 'send_command', {
                entity_id: mapContext.selectionVacuumTarget,
                command: 'app_segment_clean',
                params: [{ segments: segments, repeat: parseInt(repeats.value) }]
            });
            
            mapContext.isSelectingRooms = false;
            mapContext.roomSelectionUI.remove();
            mapContext.updateRoomStyles();
            if (mapContext.selectionInterval) clearInterval(mapContext.selectionInterval);
        };
        
        mapContext.selectionInterval = setInterval(() => {
            if (!mapContext.isSelectingRooms) {
                clearInterval(mapContext.selectionInterval);
                return;
            }
            startBtn.innerText = `Start Cleaning (${mapContext.selectedRoomIds.length})`;
            startBtn.style.background = mapContext.selectedRoomIds.length > 0 ? '#10b981' : '#475569';
        }, 200);
        
        buttons.appendChild(cancelBtn);
        buttons.appendChild(startBtn);
        
        mapContext.roomSelectionUI.appendChild(header);
        mapContext.roomSelectionUI.appendChild(controls);
        mapContext.roomSelectionUI.appendChild(buttons);
        
        mapContext.renderRoot.appendChild(mapContext.roomSelectionUI);
    }
}
