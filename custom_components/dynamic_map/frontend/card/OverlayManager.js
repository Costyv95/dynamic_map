import { executeAction, buildRoomNameToSegmentMap } from '../shared/ActionRunner.js?v=3.2.0';

/**
 * Clamp the active overlay near the pointer while keeping it inside the
 * renderRoot bounds, then apply left/top/transform. `defaultW`/`defaultH`
 * are fallbacks used when the overlay has no measurable size yet.
 */
function clampAndPositionOverlay(overlayEl, rect, posX, posY, defaultW = 0, defaultH = 0) {
    const w = overlayEl.offsetWidth || defaultW;
    const h = overlayEl.offsetHeight || defaultH;

    let finalX = posX;
    let finalY = posY - 20; // 20px above cursor
    let transX = -50;
    let transY = -100;

    // Clamp X
    if (posX - w/2 < 10) {
        transX = 0;
        finalX = 10;
    } else if (posX + w/2 > rect.width - 10) {
        transX = -100;
        finalX = rect.width - 10;
    }

    // Clamp Y (if it goes above the top edge)
    if (posY - h - 20 < 10) {
        transY = 0;
        finalY = posY + 20; // Place below cursor

        // If it now goes off the bottom, clamp it to the bottom
        if (finalY + h > rect.height - 10) {
            finalY = rect.height - h - 10;
        }
    } else if (posY - 20 > rect.height - 10) {
        finalY = rect.height - 10;
    }

    overlayEl.style.left = `${finalX}px`;
    overlayEl.style.top = `${finalY}px`;
    overlayEl.style.transform = `translate(${transX}%, ${transY}%)`;
}

export class OverlayManager {
    /**
     * Honeycomb color picker for COLOR_PICKER overlay actions: a dense
     * hexagonal hue wheel (61 swatches in 4 rings). Hue follows the angle,
     * saturation grows smoothly from the warm-white center to vivid edges,
     * so adjacent cells differ only slightly. Tapping a swatch calls
     * light.turn_on with its rgb_color; the overlay stays open so colors
     * can be tried in sequence.
     */
    static buildColorHoneycomb(mapContext, target, act) {
        const RINGS = 4;                     // 1 + 6 + 12 + 18 + 24 = 61 cells
        const HEX_R = 11;                    // hexagon radius (px)
        const cellW = HEX_R * 2;             // flat-top hexagon width
        const cellH = Math.sqrt(3) * HEX_R;  // flat-top hexagon height

        const hslToRgb = (h, s, l) => {
            s /= 100; l /= 100;
            const k = (n) => (n + h / 30) % 12;
            const a = s * Math.min(l, 1 - l);
            const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
        };

        // Axial coordinates for hex rings 0..RINGS.
        const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
        const cells = [{ q: 0, r: 0 }];
        for (let ring = 1; ring <= RINGS; ring++) {
            let q = DIRS[4][0] * ring;
            let r = DIRS[4][1] * ring;
            for (let side = 0; side < 6; side++) {
                for (let step = 0; step < ring; step++) {
                    cells.push({ q, r });
                    q += DIRS[side][0];
                    r += DIRS[side][1];
                }
            }
        }

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '6px';

        if (act.name) {
            const label = document.createElement('span');
            label.textContent = act.name;
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.alignSelf = 'flex-start';
            wrap.appendChild(label);
        }

        const gridW = 1.5 * HEX_R * RINGS * 2 + cellW + 8;
        const gridH = cellH * (RINGS * 2 + 1) + 8;
        const grid = document.createElement('div');
        grid.style.position = 'relative';
        grid.style.width = `${gridW}px`;
        grid.style.height = `${gridH}px`;
        wrap.appendChild(grid);

        const centerX = gridW / 2;
        const centerY = gridH / 2;

        cells.forEach(({ q, r }) => {
            const x = 1.5 * HEX_R * q;
            const y = cellH * (r + q / 2);
            const ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

            let rgb;
            if (ring === 0) {
                rgb = [255, 241, 224]; // warm white
            } else {
                // Smooth wheel: hue by angle, saturation ramps with radius.
                const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
                const sat = Math.round(25 + (ring / RINGS) * 72);
                const light = Math.round(72 - (ring / RINGS) * 18);
                rgb = hslToRgb(hue, sat, light);
            }

            const cell = document.createElement('div');
            cell.style.position = 'absolute';
            cell.style.left = `${centerX + x - cellW / 2}px`;
            cell.style.top = `${centerY + y - cellH / 2}px`;
            cell.style.width = `${cellW - 2}px`;
            cell.style.height = `${cellH - 2}px`;
            cell.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            cell.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
            cell.style.cursor = 'pointer';
            cell.style.transition = 'transform 0.15s ease, filter 0.15s ease';

            cell.addEventListener('pointerenter', () => { cell.style.filter = 'brightness(1.2)'; });
            cell.addEventListener('pointerleave', () => { cell.style.filter = ''; });
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!mapContext._hass) return;
                mapContext._hass.callService('light', 'turn_on', {
                    entity_id: target,
                    rgb_color: rgb
                });
                grid.querySelectorAll('div').forEach(c => { c.style.transform = ''; });
                cell.style.transform = 'scale(1.18)';
            });

            grid.appendChild(cell);
        });

        return wrap;
    }

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
        
        if ((shortcut.sc && shortcut.sc.type === 'sensor') || (actions && actions.some(a => a.type === 'SENSOR_OVERLAY'))) {
            // Render Sensor Radial Gauges Popup
            const sc = shortcut.sc;
            const tempEntity = sc.config.temperature_entity || 'sensor.room_temperature';
            const humEntity = sc.config.humidity_entity || 'sensor.room_humidity';
            
            const tempStateObj = mapContext._hass ? mapContext._hass.states[tempEntity] : null;
            const humStateObj = mapContext._hass ? mapContext._hass.states[humEntity] : null;
            
            const tempVal = tempStateObj ? parseFloat(tempStateObj.state) : NaN;
            const humVal = humStateObj ? parseFloat(humStateObj.state) : NaN;
            
            const tempValStr = !isNaN(tempVal) ? `${tempVal.toFixed(1)}°C` : '--';
            const humValStr = !isNaN(humVal) ? `${humVal.toFixed(0)}%` : '--';
            
            // Comfort Colors
            let tempColor = '#ef4444';
            if (!isNaN(tempVal)) {
                if (tempVal < 19) tempColor = '#3b82f6';
                else if (tempVal >= 19 && tempVal <= 22) tempColor = '#10b981';
                else tempColor = '#f97316';
            }
            
            let humColor = '#3b82f6';
            if (!isNaN(humVal)) {
                if (humVal < 40) humColor = '#eab308';
                else if (humVal >= 40 && humVal <= 60) humColor = '#10b981';
                else humColor = '#3b82f6';
            }
            
            // Map comfortable fill ratios (Temp 0-40, Hum 0-100)
            const tempPct = !isNaN(tempVal) ? Math.max(0, Math.min(1, tempVal / 40)) : 0;
            const humPct = !isNaN(humVal) ? Math.max(0, Math.min(1, humVal / 100)) : 0;
            
            const tempOffset = 188.5 - (188.5 * tempPct);
            const humOffset = 188.5 - (188.5 * humPct);
            
            mapContext.activeOverlay.style.background = 'rgba(15, 23, 42, 0.95)';
            mapContext.activeOverlay.style.backdropFilter = 'blur(10px)';
            mapContext.activeOverlay.style.borderRadius = '16px';
            mapContext.activeOverlay.style.border = '1px solid rgba(255, 255, 255, 0.15)';
            mapContext.activeOverlay.style.boxShadow = '0 20px 40px rgba(0,0,0,0.6)';
            mapContext.activeOverlay.style.padding = '16px 20px';
            mapContext.activeOverlay.style.display = 'flex';
            mapContext.activeOverlay.style.gap = '20px';
            mapContext.activeOverlay.style.alignItems = 'center';
            mapContext.activeOverlay.style.justifyContent = 'center';
            mapContext.activeOverlay.style.zIndex = '1000';
            mapContext.activeOverlay.style.color = '#fff';
            
            mapContext.activeOverlay.innerHTML = `
                <!-- Temperature Column -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">Temperature</span>
                    <div style="position: relative; width: 70px; height: 70px;">
                        <svg width="70" height="70" viewBox="0 0 70 70">
                            <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="4"></circle>
                            <circle id="tempCircle" cx="35" cy="35" r="30" fill="none" stroke="${tempColor}" stroke-width="4" 
                                    stroke-dasharray="188.5" stroke-dashoffset="188.5" stroke-linecap="round"
                                    style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); transform: rotate(-90deg); transform-origin: 35px 35px;"></circle>
                        </svg>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                            <ha-icon icon="mdi:thermometer" style="--mdc-icon-size: 24px; color: ${tempColor};"></ha-icon>
                        </div>
                    </div>
                    <span style="font-size: 18px; font-weight: bold; color: #fff; font-family: sans-serif;">${tempValStr}</span>
                </div>
                <!-- Divider -->
                <div style="width: 1px; height: 80px; background: rgba(255, 255, 255, 0.1);"></div>
                <!-- Humidity Column -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">Humidity</span>
                    <div style="position: relative; width: 70px; height: 70px;">
                        <svg width="70" height="70" viewBox="0 0 70 70">
                            <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="4"></circle>
                            <circle id="humCircle" cx="35" cy="35" r="30" fill="none" stroke="${humColor}" stroke-width="4" 
                                    stroke-dasharray="188.5" stroke-dashoffset="188.5" stroke-linecap="round"
                                    style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); transform: rotate(-90deg); transform-origin: 35px 35px;"></circle>
                        </svg>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                            <ha-icon icon="mdi:water-percent" style="--mdc-icon-size: 24px; color: ${humColor};"></ha-icon>
                        </div>
                    </div>
                    <span style="font-size: 18px; font-weight: bold; color: #fff; font-family: sans-serif;">${humValStr}</span>
                </div>
            `;
            
            mapContext.renderRoot.appendChild(mapContext.activeOverlay);
            
            // Smoothly animate the fill values upon mounting
            setTimeout(() => {
                const tempEl = mapContext.activeOverlay.querySelector('#tempCircle');
                const humEl = mapContext.activeOverlay.querySelector('#humCircle');
                if (tempEl) tempEl.style.strokeDashoffset = tempOffset.toString();
                if (humEl) humEl.style.strokeDashoffset = humOffset.toString();
            }, 50);
            
            // Clamp and position overlay
            const rect = mapContext.renderRoot.getBoundingClientRect();
            let posX = event.clientX - rect.left;
            let posY = event.clientY - rect.top;

            clampAndPositionOverlay(mapContext.activeOverlay, rect, posX, posY, 230, 140);
            return;
        }
        
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
                let sMin = '1';
                let sMax = '100';
                let sStep = '1';
                const isSymmetric = act.symmetric_scale === true;

                if (mapContext._hass && mapContext._hass.states[target]) {
                    if (target.startsWith('input_number.') || target.startsWith('number.')) {
                        const attrs = mapContext._hass.states[target].attributes;
                        if (!isSymmetric) {
                            if (attrs.min !== undefined) sMin = attrs.min;
                            if (attrs.max !== undefined) sMax = attrs.max;
                            if (attrs.step !== undefined) sStep = attrs.step;
                            slider.value = parseFloat(mapContext._hass.states[target].state);
                        } else {
                            let x = parseFloat(mapContext._hass.states[target].state);
                            if (x >= 1) slider.value = x - 1;
                            else slider.value = 1 - (1 / x);
                        }
                    } else if (mapContext._hass.states[target].attributes.brightness) {
                        slider.value = Math.round((mapContext._hass.states[target].attributes.brightness / 255) * 100);
                    } else {
                        slider.value = isSymmetric ? '0' : '50';
                    }
                } else {
                    slider.value = isSymmetric ? '0' : '50';
                }
                
                if (isSymmetric) {
                    slider.min = '-4';
                    slider.max = '4';
                    slider.step = '1';
                } else {
                    slider.min = sMin;
                    slider.max = sMax;
                    slider.step = sStep;
                }
                
                if (act.width) slider.style.width = act.width;
                else slider.style.width = '150px';
                
                slider.addEventListener('change', (e) => {
                    if (!mapContext._hass) return;
                    const domain = target.split('.')[0];
                    if (domain === 'input_number' || domain === 'number') {
                        let finalVal = parseFloat(e.target.value);
                        if (isSymmetric) {
                            let v = finalVal;
                            if (v >= 0) finalVal = v + 1;
                            else finalVal = 1 / (-v + 1);
                        }
                        mapContext._hass.callService(domain, 'set_value', {
                            entity_id: target,
                            value: finalVal
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
            } else if (act.type === 'COLOR_PICKER') {
                mapContext.activeOverlay.appendChild(
                    OverlayManager.buildColorHoneycomb(mapContext, target, act)
                );
            } else if (act.type === 'TOGGLE') {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';
                container.style.gap = '15px';
                container.style.padding = '6px 4px';
                if (act.width) container.style.width = act.width;
                
                let iconHtml = '';
                if (act.icon) {
                    if (act.icon.startsWith('mdi:') || act.icon.includes(':')) {
                        iconHtml = `<ha-icon icon="${act.icon}" style="--mdc-icon-size: 18px; margin-right:8px;"></ha-icon>`;
                    } else {
                        iconHtml = `<span style="margin-right:8px">${act.icon}</span>`;
                    }
                }
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
                    // TOGGLE -> <domain>.toggle (vacuum.toggle is valid in modern HA; no remap needed)
                    executeAction(mapContext._hass, act, target);

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
                    if (act.icon.startsWith('mdi:') || act.icon.includes(':')) {
                        iconHtml = `<ha-icon icon="${act.icon}" style="--mdc-icon-size: 18px;"></ha-icon>`;
                    } else {
                        iconHtml = `<span>${act.icon}</span>`;
                    }
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
                    if (!mapContext._hass) return;
                    if (!target && act.type !== 'CALL_SERVICE') return;
                    
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
                    
                    // Menu buttons apply room-name -> segment-ID replacement and
                    // surface CALL_SERVICE errors (see ActionRunner divergence notes).
                    executeAction(mapContext._hass, act, target, {
                        nameToSegmentId: buildRoomNameToSegmentMap(target, mapContext.shortcutElements, mapContext.rooms),
                        onServiceError: (e) => {
                            console.error("[DynamicMap] callService Error:", e);
                            alert("HA Error: " + (e.message || JSON.stringify(e)));
                        }
                    });
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

        // Clamp to screen bounds to prevent needing to pan
        clampAndPositionOverlay(mapContext.activeOverlay, rect, posX, posY);
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
