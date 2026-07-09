import { ComponentRegistry } from './ComponentRegistry.js?v=3.2.0';
import { evaluateCondition } from './ConditionEvaluator.js?v=3.2.0';
import { evaluateTemplate } from './TemplateEvaluator.js?v=3.2.0';
import { isOrientationObject, resolveOriented, resolveOrientedLoose, resolveOrientedStrict } from '../shared/OrientationProps.js?v=3.2.0';
import { executeAction } from '../shared/ActionRunner.js?v=3.2.0';
import { computeSensorPill } from '../shared/SensorPill.js?v=3.2.0';

export class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext || { activeMode: 'horizontal' };
        
        this.group = document.createElementNS(svgNS, 'g');
        this.group.classList.add('shortcut-group');
        this.group.setAttribute('id', scData.id);
        
        this.config = scData.config || {};
        
        // Backwards compatibility elements
        this.bgGroup = document.createElementNS(svgNS, 'g');
        this.group.appendChild(this.bgGroup);
        
        this.contentGroup = document.createElementNS(svgNS, 'g');
        this.group.appendChild(this.contentGroup);
        
        this.unavailableLine = document.createElementNS(svgNS, 'line');
        this.unavailableLine.setAttribute('stroke', '#ef4444');
        this.unavailableLine.setAttribute('stroke-width', '2');
        this.unavailableLine.style.display = 'none';
        this.group.appendChild(this.unavailableLine);
        
        this.iconText = document.createElementNS(svgNS, 'text');
        this.iconText.setAttribute('text-anchor', 'middle');
        this.iconText.setAttribute('dominant-baseline', 'central');
        this.iconText.setAttribute('fill', '#ffffff');
        this.iconText.style.pointerEvents = 'none';
        
        this.emojiText = document.createElementNS(svgNS, 'text');
        this.haIcon = null;
        this.iconImage = null;
        this.shape = null;
        
        this._imageLoadStates = {};
        this.extraTransformStr = '';
        
        // Base positioning coordinates translation
        this.updateCoordinates();
        
        // Invisible hitbox to expand click area for small elements
        this.hitbox = document.createElementNS(svgNS, 'circle');
        this.hitbox.setAttribute('r', 30);
        this.hitbox.setAttribute('fill', 'rgba(0,0,0,0)');
        this.hitbox.style.pointerEvents = 'all';
        this.group.appendChild(this.hitbox);
        
        // Interaction listeners
        this.setupInteractions();
    }
    
    updateCoordinates() {
        const activeMode = this.mapContext.activeMode || 'horizontal';
        let pos = this.sc.position;
        if (isOrientationObject(pos)) {
            pos = resolveOrientedLoose(pos, activeMode, [50, 50]);
        }

        this.px = (pos[0] / 100) * this.imgW;
        this.py = (pos[1] / 100) * this.imgH;

        this.group.setAttribute('transform', this._badgeTransformStr());
        this._applyGlowTransform();
    }

    /**
     * The badge's full placement in map coordinates: position, the shortcut's
     * own rotation, then the card's counter-transforms (flip scale, and the
     * rotate(-90) that keeps a non-autoRotate shortcut upright while the map
     * is rotated). The glow lives in mapRoot — a sibling space — so it must
     * use this exact same transform or it will point the wrong way in one of
     * the two orientations.
     */
    _badgeTransformStr() {
        const activeMode = this.mapContext.activeMode || 'horizontal';
        const customRot = resolveOriented(this.sc.rotation, activeMode, 0);
        const rotStr = customRot ? `rotate(${customRot})` : '';
        const extra = this.extraTransformStr || '';
        return `translate(${this.px}, ${this.py}) ${rotStr} ${extra}`.trim();
    }

    /** Keep the light pool locked to the badge's orientation. */
    _applyGlowTransform() {
        if (!this.glowInner || !this.mapContext || !this.mapContext.mapRoot) return;
        this.glowInner.setAttribute('transform', this._badgeTransformStr());
    }
    
    getIsAutoRotateActive() {
        let activeState = null;
        if (this.config.states && this.config.states.length > 0 && this.mapContext._hass) {
            for (const st of this.config.states) {
                const cond = st.conditions || (st.state_entity || st.entity ? st : null);
                if (evaluateCondition(cond, this.mapContext._hass)) {
                    activeState = st;
                    break;
                }
            }
        }
        if (activeState && activeState.autoRotate !== undefined) {
            return activeState.autoRotate;
        }
        return !!this.config.autoRotate;
    }
    
    updateState(hass) {
        if (hass && (hass.states || hass.callService)) {
            this.mapContext._hass = hass;
        }
        this.updateCoordinates();
        
        // 1. Evaluate matchedState (checking conditional states first, then default fallback state)
        let matchedState = null;
        if (this.config.states && this.config.states.length > 0) {
            for (const st of this.config.states) {
                if (st.is_default) continue; // Skip default fallback during conditional check
                const cond = st.conditions || (st.state_entity || st.entity ? st : null);
                if (evaluateCondition(cond, hass)) {
                    matchedState = st;
                    break;
                }
            }
            if (!matchedState) {
                matchedState = this.config.states.find(st => st.is_default) || null;
            }
        }
        this.activeState = matchedState;

        const isSensor = this.sc.type === 'sensor' || (this.config.states && this.config.states.some(s => s.display_entity));
        const customLayout = this.config.default_layout || [];
        let activeLayout = customLayout;

        if (activeLayout.length === 0) {
            const activeMode = this.mapContext.activeMode || 'horizontal';
            
            // Unified property resolver: checks matchedState override, then falls back to root this.sc or instance properties
            const resolveProperty = (prop, defaultVal) => {
                const val = matchedState?.[prop] !== undefined ? matchedState[prop] : (this.sc[prop] !== undefined ? this.sc[prop] : this[prop]);
                return resolveOriented(val, activeMode, defaultVal);
            };
            
            let scaleVal = resolveProperty('scale', 1.0);
            let scaleXVal = resolveProperty('scaleX', scaleVal);
            let scaleYVal = resolveProperty('scaleY', scaleVal);
            
            // Shape, transparent, and autoRotate overrides
            const shape = matchedState?.shape || this.config?.shape || this.sc?.shape || (isSensor ? 'rect' : 'circle');
            const propDefault = (shape === 'circle');
            const isProportional = this.config.proportional !== undefined ? this.config.proportional : propDefault;
            
            const scaleX = scaleXVal;
            let scaleY = scaleYVal;
            if (isProportional) {
                scaleY = scaleX;
            }
            this.scaleX = scaleX;
            this.scaleY = scaleY;
            const scale = Math.min(scaleX, scaleY);
            
            const w = 24 * scaleX;
            const h = 24 * scaleY;
            
            const targetConfig = matchedState || this.config;
            const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);

            // Auto-built layouts resolve state overrides (color, transparent,
            // icon/image) up front — no second build-then-patch pass needed.
            const stColor = this._resolveColor(matchedState?.color || this.config.color, hass);
            const stTrans = matchedState?.transparent !== undefined ? matchedState.transparent : this.config.transparent;

            if (isSensor) {
                activeLayout = this._buildSensorLayout(matchedState, hass, scaleX, scaleY);
            } else {
                const isRect = shape === 'rect';
                activeLayout = [
                    {
                        id: 'fallback_bg',
                        type: isRect ? 'rect' : 'circle',
                        radius: 12 * scaleX,
                        radiusX: 12 * scaleX,
                        radiusY: 12 * scaleY,
                        width: w,
                        height: h,
                        color: stTrans ? 'rgba(0,0,0,0)' : (stColor || '#0ea5e9'),
                        stroke_color: stTrans ? 'rgba(0,0,0,0)' : 'white',
                        stroke_width: stTrans ? 0 : 1
                    }
                ];

                // A state image beats the base icon; otherwise icon beats image.
                const iconVal = matchedState?.icon || this.config.icon;
                const imgVal = matchedState?.image || this.config.image;

                if (imgVal && (matchedState?.image || !iconVal)) {
                    const tiling = matchedState?.image_tiling !== undefined
                        ? matchedState.image_tiling : this.config.image_tiling;
                    const tileSize = matchedState?.image_tile_size !== undefined
                        ? matchedState.image_tile_size : this.config.image_tile_size;
                    activeLayout.push({
                        id: 'fallback_image',
                        type: 'image',
                        value: imgVal,
                        width: contentMatchSize ? w : 24,
                        height: contentMatchSize ? h : 24,
                        // Seamless textures repeat as square tiles instead of
                        // stretching: 'axis' runs along the shape's long side
                        // (LED strips), 'both' fills the rect in 2D (panels).
                        tiling: isRect && tiling ? (tiling === 'both' ? 'both' : 'axis') : false,
                        tile_size: tileSize
                    });
                } else if (iconVal) {
                    activeLayout.push({
                        id: 'fallback_icon',
                        type: 'icon',
                        value: iconVal,
                        size: 18 * scale,
                        color: stTrans ? (stColor || '#facaca') : this._contrastText(stColor || '#0ea5e9')
                    });
                }
            }
        }
        
        if (matchedState) {
            if (matchedState.layout_override && matchedState.layout_override.length > 0) {
                activeLayout = matchedState.layout_override;
            } else if (customLayout.length > 0) {
                // User-provided layouts still get the classic patch pass;
                // auto-built layouts above already baked the state in.
                const baseCopy = JSON.parse(JSON.stringify(activeLayout));
                if (baseCopy.length > 0) {
                    const stColor = this._resolveColor(matchedState.color || this.config.color, hass);
                    const stTrans = matchedState.transparent !== undefined ? matchedState.transparent : this.config.transparent;
                    
                    if (stColor) {
                        if (stTrans) {
                            baseCopy[0].stroke_color = 'rgba(0,0,0,0)';
                            baseCopy[0].color = 'rgba(0,0,0,0)';
                        } else {
                            baseCopy[0].color = stColor;
                        }
                    }
                    
                    if (isSensor) {
                        const emojiEl = baseCopy.find(el => el.id === 'sensor_emoji');
                        if (emojiEl) {
                            if (matchedState.icon) {
                                emojiEl.value = matchedState.icon;
                            }
                            if (stTrans) {
                                emojiEl.color = stColor || '#10b981';
                            } else {
                                emojiEl.color = '#ffffff';
                            }
                        }
                        
                        const valueEl = baseCopy.find(el => el.id === 'sensor_value');
                        if (valueEl) {
                            const dispEntity = matchedState.display_entity || matchedState.state_entity || this.config.temperature_entity || this.config.state_entity || this.sc.entity_id;
                            const unit = matchedState.unit || this.config.unit || '°';
                            const defaultTemplate = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
                            const valueTemplate = matchedState.value_template || this.config.value_template || defaultTemplate;
                            valueEl.value = valueTemplate;
                            if (stTrans) {
                                valueEl.color = stColor || '#10b981';
                            } else {
                                valueEl.color = '#ffffff';
                            }
                        }
                    } else {
                        let contentEl = baseCopy.find(el => el.type === 'icon' || el.type === 'image');
                        if (!contentEl && (matchedState.icon || matchedState.image)) {
                            contentEl = { id: 'fallback_content', type: 'icon', value: '' };
                            baseCopy.push(contentEl);
                        }
                        if (contentEl) {
                            const targetConfig = matchedState || this.config;
                            const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);
                            
                            if (matchedState.image) {
                                contentEl.type = 'image';
                                contentEl.value = matchedState.image;
                                contentEl.width = contentMatchSize ? (baseCopy[0].width || 24) : 24;
                                contentEl.height = contentMatchSize ? (baseCopy[0].height || 24) : 24;
                            } else if (matchedState.icon) {
                                contentEl.type = 'icon';
                                contentEl.value = matchedState.icon;
                                if (stTrans) {
                                    contentEl.color = stColor || '#facaca';
                                } else {
                                    contentEl.color = 'white';
                                }
                            }
                        }
                    }
                }
                activeLayout = baseCopy;
            }
        } else if (isSensor && customLayout.length > 0 && this.config.states && this.config.states.length > 0) {
            // No state matched for a sensor with a user-provided layout:
            // fall back to root config templates and colors.
            const baseCopy = JSON.parse(JSON.stringify(activeLayout));
            const valueEl = baseCopy.find(el => el.id === 'sensor_value');
            if (valueEl) {
                const dispEntity = this.config.temperature_entity || this.config.state_entity || this.sc.entity_id;
                const unit = this.config.unit || '°';
                const defaultTemplate = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
                const valueTemplate = this.config.value_template || defaultTemplate;
                valueEl.value = valueTemplate;
                if (this.config.transparent) {
                    valueEl.color = this._resolveColor(this.config.color, hass) || '#10b981';
                } else {
                    valueEl.color = '#ffffff';
                }
            }
            const emojiEl = baseCopy.find(el => el.id === 'sensor_emoji');
            if (emojiEl) {
                if (this.config.transparent) {
                    emojiEl.color = this._resolveColor(this.config.color, hass) || '#10b981';
                } else {
                    emojiEl.color = '#ffffff';
                }
            }
            activeLayout = baseCopy;
        }
        
        this.renderComponents(activeLayout, hass);
        
        // Availability formatting
        const availEntity = this.config.availability_entity || this.sc.entity_id;
        const isUnavailable = hass && hass.states && hass.states[availEntity] && 
            (hass.states[availEntity].state === 'unavailable' || hass.states[availEntity].state === 'unknown');
            
        if (isUnavailable) {
            const expectedFilter = 'grayscale(100%) opacity(45%)';
            this.bgGroup.style.filter = expectedFilter;
            if (this.iconText) this.iconText.style.filter = expectedFilter;
            this.unavailableLine.style.display = 'block';
            
            // Resolve orientation-object scales ({horizontal, vertical}) to a finite
            // scalar for the active mode; guards against NaN reaching setAttribute.
            const uaMode = this.mapContext.activeMode || 'horizontal';
            const num = (v) => {
                const resolved = resolveOrientedStrict(v, uaMode);
                return Number.isFinite(resolved) ? resolved : undefined;
            };
            const scale = num(this.sc.scale) ?? 1.0;
            const sX = num(this.scaleX) ?? num(this.sc.scaleX) ?? scale;
            const sY = num(this.scaleY) ?? num(this.sc.scaleY) ?? scale;
            const lineRx = isSensor ? (this._pillHalfW ?? 26 * sX) : 12 * sX;
            this.unavailableLine.setAttribute('x1', -lineRx * 0.7);
            this.unavailableLine.setAttribute('y1', -12 * sY * 0.7);
            this.unavailableLine.setAttribute('x2', lineRx * 0.7);
            this.unavailableLine.setAttribute('y2', 12 * sY * 0.7);
        } else {
            this.bgGroup.style.filter = '';
            if (this.iconText) this.iconText.style.filter = '';
            this.unavailableLine.style.display = 'none';
        }

        this._updateGlow(isUnavailable ? null : hass);
        this._updateActivityFx(isUnavailable ? null : hass);

        // One-artwork state styling: image shortcuts without explicit state
        // overrides derive their off-look automatically (dim + desaturate),
        // so a single texture per object covers all states.
        if (this.iconImage && !(this.config.states && this.config.states.length) && !isUnavailable) {
            const tgt = this.sc.entity_id || this.config.state_entity;
            const stObj = tgt && hass && hass.states ? hass.states[tgt] : null;
            const isOff = stObj && stObj.state === 'off';
            this.contentGroup.style.filter = isOff ? 'grayscale(55%) brightness(0.75)' : '';
        }
    }

    /** Stable, id-safe suffix for this shortcut's SVG defs. */
    _defsUid() {
        if (!this._uid) {
            this._uid = String(this.sc.id || 'sc').replace(/[^a-zA-Z0-9_-]/g, '') || 'sc';
        }
        return this._uid;
    }

    _ensureDefs() {
        if (!this.defsEl) {
            this.defsEl = document.createElementNS(this.svgNS, 'defs');
            this.group.insertBefore(this.defsEl, this.group.firstChild);
        }
        return this.defsEl;
    }

    /**
     * A rounded rect filled with the image repeated as square tiles (side =
     * shape height) instead of one stretched copy - for seamless textures
     * like LED strips or fairy-light garlands drawn to continue horizontally.
     */
    _buildTiledImage(comp) {
        const defs = this._ensureDefs();
        const pid = `dm_tile_${this._defsUid()}`;
        let pattern = defs.querySelector(`pattern[id="${pid}"]`);
        if (!pattern) {
            pattern = document.createElementNS(this.svgNS, 'pattern');
            pattern.setAttribute('id', pid);
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            const holder = document.createElementNS(this.svgNS, 'g');
            holder.appendChild(document.createElementNS(this.svgNS, 'image'));
            pattern.appendChild(holder);
            defs.appendChild(pattern);
        }
        const w = comp.width || 24;
        const h = comp.height || 24;
        // 'axis' tiles repeat along the rect's LONG side: the tile is a
        // square on the short side, and when the strip stands vertically the
        // artwork rotates 90deg so it still runs along the strip. 'both'
        // fills the rect in 2D (e.g. an LED pixel panel); tile_size sets the
        // density (defaults to the short side).
        const vertical = comp.tiling !== 'both' && h > w;
        const tile = Number(comp.tile_size) > 0 ? Number(comp.tile_size) : Math.min(w, h);
        pattern.setAttribute('x', ((comp.x || 0) - w / 2).toString());
        pattern.setAttribute('y', ((comp.y || 0) - h / 2).toString());
        pattern.setAttribute('width', tile.toString());
        pattern.setAttribute('height', tile.toString());
        // Rotate the artwork about the tile center (not the lattice about the
        // user-space origin) so the tiles stay phase-anchored to the rect.
        const holder = pattern.querySelector('g');
        if (vertical) {
            holder.setAttribute('transform', `rotate(90 ${tile / 2} ${tile / 2})`);
        } else {
            holder.removeAttribute('transform');
        }
        const img = pattern.querySelector('image');
        img.setAttribute('width', tile.toString());
        img.setAttribute('height', tile.toString());
        img.setAttribute('href', comp.value || '');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', comp.value || '');
        const rect = document.createElementNS(this.svgNS, 'rect');
        rect.setAttribute('x', ((comp.x || 0) - w / 2).toString());
        rect.setAttribute('y', ((comp.y || 0) - h / 2).toString());
        rect.setAttribute('width', w.toString());
        rect.setAttribute('height', h.toString());
        rect.setAttribute('rx', Math.min(tile * 0.25, 12).toString());
        rect.setAttribute('fill', `url(#${pid})`);
        return rect;
    }

    /**
     * Unified badge styling: every solid shape gets the same programmatic
     * "texture" — a top-left gloss + bottom edge shading overlay and a soft
     * drop shadow. One consistent style for all shortcuts and states, no
     * image assets needed.
     */
    _applyBadgeDepth(el, comp) {
        const fill = comp.color || '';
        if (!fill || fill === 'none' || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(fill)) return;

        const uid = this._defsUid();
        const defs = this._ensureDefs();

        if (!defs.querySelector(`#dm_gloss_${uid}`)) {
            const grad = document.createElementNS(this.svgNS, 'radialGradient');
            grad.setAttribute('id', `dm_gloss_${uid}`);
            grad.setAttribute('cx', '33%');
            grad.setAttribute('cy', '28%');
            grad.setAttribute('r', '80%');
            [['0%', '#ffffff', '0.45'], ['45%', '#ffffff', '0.13'], ['70%', '#ffffff', '0'], ['100%', '#000000', '0.18']]
                .forEach(([offset, color, opacity]) => {
                    const stop = document.createElementNS(this.svgNS, 'stop');
                    stop.setAttribute('offset', offset);
                    stop.setAttribute('stop-color', color);
                    stop.setAttribute('stop-opacity', opacity);
                    grad.appendChild(stop);
                });
            defs.appendChild(grad);

            const filter = document.createElementNS(this.svgNS, 'filter');
            filter.setAttribute('id', `dm_shadow_${uid}`);
            filter.setAttribute('x', '-40%');
            filter.setAttribute('y', '-40%');
            filter.setAttribute('width', '180%');
            filter.setAttribute('height', '180%');
            const shadow = document.createElementNS(this.svgNS, 'feDropShadow');
            shadow.setAttribute('dx', '0');
            shadow.setAttribute('dy', '1.4');
            shadow.setAttribute('stdDeviation', '1.6');
            shadow.setAttribute('flood-opacity', '0.35');
            filter.appendChild(shadow);
            defs.appendChild(filter);
        }

        el.setAttribute('filter', `url(#dm_shadow_${uid})`);

        const gloss = el.cloneNode(false);
        gloss.removeAttribute('id');
        gloss.removeAttribute('filter');
        gloss.setAttribute('fill', `url(#dm_gloss_${uid})`);
        gloss.setAttribute('stroke', 'none');
        gloss.setAttribute('pointer-events', 'none');
        gloss.classList.add('dm-badge-gloss');
        this.bgGroup.appendChild(gloss);
    }

    /** Rotate an rgb()/#hex color's hue by deg, returning an rgb() string. */
    _shiftHue(color, deg) {
        let r, g, b;
        const mRgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color || '');
        if (mRgb) {
            r = +mRgb[1] / 255; g = +mRgb[2] / 255; b = +mRgb[3] / 255;
        } else if (/^#[0-9a-f]{6}$/i.test(color || '')) {
            r = parseInt(color.slice(1, 3), 16) / 255;
            g = parseInt(color.slice(3, 5), 16) / 255;
            b = parseInt(color.slice(5, 7), 16) / 255;
        } else {
            return color;
        }
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0, s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        h = (h + deg / 360 + 1) % 1;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (t) => {
            t = (t + 1) % 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const to255 = (v) => Math.round(v * 255);
        return `rgb(${to255(hue2rgb(h + 1 / 3))}, ${to255(hue2rgb(h))}, ${to255(hue2rgb(h - 1 / 3))})`;
    }

    _makeGlowGradient(defs, id) {
        const grad = document.createElementNS(this.svgNS, 'radialGradient');
        grad.setAttribute('id', id);
        [['0%', '0.7'], ['50%', '0.3'], ['100%', '0']].forEach(([offset, opacity]) => {
            const stop = document.createElementNS(this.svgNS, 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-opacity', opacity);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);
        return grad;
    }

    /** Gradient for a strip's line source: transparent → bright → transparent
     *  ACROSS the strip (orientation set at layout time), giving a smooth
     *  perpendicular falloff with a full-length bright core. */
    _makeGlowLineGradient(defs, id) {
        const grad = document.createElementNS(this.svgNS, 'linearGradient');
        grad.setAttribute('id', id);
        [['0%', '0'], ['50%', '0.85'], ['100%', '0']].forEach(([offset, opacity]) => {
            const stop = document.createElementNS(this.svgNS, 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-opacity', opacity);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);
        return grad;
    }

    /**
     * Mask that fades a strip's pool at its two ends. The fill gradient only
     * fades ACROSS the strip, which would leave the ends hard-cut; this fades
     * ALONG it. The plateau between the two fades is the bright core, and the
     * caller sizes it to the strip's own length so it never shrinks.
     */
    _makeGlowLineMask(defs, uid) {
        const grad = document.createElementNS(this.svgNS, 'linearGradient');
        grad.setAttribute('id', `dm_glowend_${uid}`);
        ['0', '1', '1', '0'].forEach((opacity) => {
            const stop = document.createElementNS(this.svgNS, 'stop');
            stop.setAttribute('stop-color', '#fff');
            stop.setAttribute('stop-opacity', opacity);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);

        const mask = document.createElementNS(this.svgNS, 'mask');
        mask.setAttribute('id', `dm_glowmask_${uid}`);
        mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
        const rect = document.createElementNS(this.svgNS, 'rect');
        rect.setAttribute('fill', `url(#dm_glowend_${uid})`);
        mask.appendChild(rect);
        defs.appendChild(mask);

        this._glowEndGrad = grad;
        this._glowMaskRect = rect;
        return mask;
    }

    /**
     * Light-pool glow: lights that are on cast two soft pools in their live
     * color (the second slightly hue-shifted) that drift and intertwine
     * (see animate()). The pool follows the badge's footprint — a strip's
     * rectangle yields an elongated pool — its reach scales with the
     * light's brightness up to config.glow_strength (default 1), and it is
     * clipped to the room containing the light so it never crosses walls.
     * Blobs live in map coordinates (outside the badge's filtered subtree,
     * which caused compositing flicker) and use screen blending, so
     * neighboring lights' pools combine additively where they overlap.
     * Default for type 'light'; opt any shortcut in/out via config.glow.
     */
    _updateGlow(hass) {
        const wantsGlow = this.config.glow === true || (this.sc.type === 'light' && this.config.glow !== false);
        const target = this.sc.entity_id || this.config.state_entity;
        const st = target && hass && hass.states ? hass.states[target] : null;
        const isOn = wantsGlow && st && st.state === 'on';

        if (!isOn) {
            this._glowVisible = false;
            if (this.glowGroup) this.glowGroup.style.display = 'none';
            return;
        }

        const uid = this._defsUid();
        const host = (this.mapContext && this.mapContext.mapRoot) ? this.mapContext.mapRoot : this.group;

        if (!this.glowGroup) {
            this.glowGroup = document.createElementNS(this.svgNS, 'g');
            this.glowGroup.setAttribute('pointer-events', 'none');
            this.glowGroup.classList.add('dm-light-glow');

            this.glowDefs = document.createElementNS(this.svgNS, 'defs');
            this.glowGroup.appendChild(this.glowDefs);
            this._glowGrad = this._makeGlowGradient(this.glowDefs, `dm_glow_${uid}`);
            this._glowGrad2 = this._makeGlowGradient(this.glowDefs, `dm_glow2_${uid}`);
            this._glowLineGrad = this._makeGlowLineGradient(this.glowDefs, `dm_glowline_${uid}`);
            this._makeGlowLineMask(this.glowDefs, uid);

            this.glowInner = document.createElementNS(this.svgNS, 'g');
            this.glowGroup.appendChild(this.glowInner);
            this.glowBlobs = [];

            if (host === this.group) {
                // No map context (tests/previews): keep the glow local.
                this.group.insertBefore(this.glowGroup, this.group.firstChild);
            } else {
                // Under the shortcut layer, above rooms and the floorplan.
                const firstShortcut = host.querySelector('.shortcut-group');
                host.insertBefore(this.glowGroup, firstShortcut || null);
            }
        }

        let color = this.activeState && this.activeState.color ? this.activeState.color : 'entity';
        color = this._resolveColor(color, hass) || '#f59e0b';
        const color2 = this._shiftHue(color, 28);
        this._glowGrad.querySelectorAll('stop').forEach(stop => stop.setAttribute('stop-color', color));
        this._glowGrad2.querySelectorAll('stop').forEach(stop => stop.setAttribute('stop-color', color2));

        // Shape-aware pool that reaches further the brighter the light is.
        let baseW = 24, baseH = 24;
        if (this.shape && this.shape.tagName === 'rect') {
            baseW = parseFloat(this.shape.getAttribute('width')) || 24;
            baseH = parseFloat(this.shape.getAttribute('height')) || 24;
        } else if (this.shape) {
            const r = parseFloat(this.shape.getAttribute('r')) || 12;
            baseW = baseH = r * 2;
        }
        const strength = Number(this.config.glow_strength) > 0 ? Number(this.config.glow_strength) : 1;
        const bri = (st.attributes && Number.isFinite(st.attributes.brightness))
            ? Math.max(st.attributes.brightness / 255, 0.15) : 1;
        const range = this.imgW * 0.16 * strength * bri;

        const longAxis = Math.max(baseW, baseH);
        const shortAxis = Math.min(baseW, baseH);
        // An elongated rect (a strip) emits from a LINE, like a fluorescent
        // tube: one full-length rounded rect whose fill is a gradient running
        // ACROSS the strip (bright core line, fading to transparent at both
        // perpendicular edges). The bright core is the FULL strip length at
        // every brightness; only the PERPENDICULAR reach grows/shrinks with
        // brightness, and the ends stay flat (they barely extend). Everything
        // else emits from a POINT (two intertwining radial pools).
        const isLine = this.shape && this.shape.tagName === 'rect'
            && (longAxis - shortAxis) > shortAxis * 0.6;
        this._glowLine = isLine;

        if (isLine) {
            const horizontal = baseW >= baseH;
            const halfLen = longAxis / 2;
            const halfThick = shortAxis / 2;
            // Along the strip the ends grow only slightly, so the pool keeps
            // flat ends instead of ballooning into semicircles. Across it the
            // reach follows brightness, but never far enough to make the pool
            // taller than it is long - a line source must always read as a
            // line, never as a square blob.
            // Across the strip the reach follows brightness, but never grows
            // past the strip's own length: a line source must always read as a
            // line, never as a square blob. Along the strip the pool spills
            // only a little, and the mask below fades those ends out.
            const spill = range * 0.35;
            const hx = halfLen + spill;                             // along
            const hy = Math.min(halfThick + range, halfLen * 0.85); // across
            const aHalf = horizontal ? hx : hy;
            const bHalf = horizontal ? hy : hx;
            this._ensureGlowShapes(1, 'rect', uid);
            // Fill gradient fades ACROSS the strip; mask gradient fades ALONG
            // it. Together: a soft stadium whose bright core is the full strip.
            const [x1, y1, x2, y2] = horizontal ? ['0', '0', '0', '1'] : ['0', '0', '1', '0'];
            this._glowLineGrad.setAttribute('x1', x1);
            this._glowLineGrad.setAttribute('y1', y1);
            this._glowLineGrad.setAttribute('x2', x2);
            this._glowLineGrad.setAttribute('y2', y2);
            this._glowLineGrad.querySelectorAll('stop').forEach(s => s.setAttribute('stop-color', color));

            // The plateau spans exactly the strip's length, at any brightness.
            const fade = Math.min(Math.max(spill / (2 * hx), 0.01), 0.45);
            this._glowEndGrad.setAttribute('x1', horizontal ? '0' : '0');
            this._glowEndGrad.setAttribute('y1', horizontal ? '0' : '0');
            this._glowEndGrad.setAttribute('x2', horizontal ? '1' : '0');
            this._glowEndGrad.setAttribute('y2', horizontal ? '0' : '1');
            const offsets = [0, fade, 1 - fade, 1];
            this._glowEndGrad.querySelectorAll('stop').forEach((s, i) => {
                s.setAttribute('offset', offsets[i].toFixed(3));
            });
            this._glowMaskRect.setAttribute('x', (-aHalf).toFixed(1));
            this._glowMaskRect.setAttribute('y', (-bHalf).toFixed(1));
            this._glowMaskRect.setAttribute('width', (aHalf * 2).toFixed(1));
            this._glowMaskRect.setAttribute('height', (bHalf * 2).toFixed(1));

            const rect = this.glowBlobs[0];
            rect.setAttribute('x', (-aHalf).toFixed(1));
            rect.setAttribute('y', (-bHalf).toFixed(1));
            rect.setAttribute('width', (aHalf * 2).toFixed(1));
            rect.setAttribute('height', (bHalf * 2).toFixed(1));
            rect.removeAttribute('rx');
            rect.removeAttribute('ry');
            rect.setAttribute('fill', `url(#dm_glowline_${uid})`);
            rect.setAttribute('mask', `url(#dm_glowmask_${uid})`);
            rect.removeAttribute('opacity');
        } else {
            // Point source: two intertwining radial pools (second smaller).
            this._ensureGlowShapes(2, 'ellipse', uid);
            const rx = baseW / 2 + range;
            const ry = baseH / 2 + range;
            const b0 = this.glowBlobs[0], b1 = this.glowBlobs[1];
            b0.setAttribute('fill', `url(#dm_glow_${uid})`);
            b1.setAttribute('fill', `url(#dm_glow2_${uid})`);
            b0.removeAttribute('opacity'); b1.removeAttribute('opacity');
            b0.setAttribute('rx', rx.toFixed(1)); b0.setAttribute('ry', ry.toFixed(1));
            b0.setAttribute('cx', 0); b0.setAttribute('cy', 0);
            b1.setAttribute('rx', (rx * 0.65).toFixed(1)); b1.setAttribute('ry', (ry * 0.65).toFixed(1));
            b1.setAttribute('cx', 0); b1.setAttribute('cy', 0);
        }
        // Back-compat handles for tests / callers.
        this.glowEl = this.glowBlobs[0];
        this.glowBlob2 = this.glowBlobs[1];

        if (host !== this.group) {
            this._applyGlowTransform();
            this._updateGlowClip(uid);
        }

        this.glowGroup.style.display = 'block';
        this._glowVisible = true;
    }

    /** Clip the light pool to the room containing the light — no light through walls. */
    /** Grow/shrink the pool of glow shapes to exactly n of the given tag
     *  ('ellipse' for point pools, 'rect' for strip capsules). Fill/geometry
     *  are set by the caller. Rebuilds if the tag changed. */
    _ensureGlowShapes(n, tag, uid) {
        if (!this.glowBlobs) this.glowBlobs = [];
        if (this.glowBlobs.length && this.glowBlobs[0].tagName.toLowerCase() !== tag) {
            this.glowBlobs.forEach(e => e.parentNode && e.parentNode.removeChild(e));
            this.glowBlobs = [];
        }
        while (this.glowBlobs.length < n) {
            const e = document.createElementNS(this.svgNS, tag);
            e.style.mixBlendMode = 'screen';
            this.glowInner.appendChild(e);
            this.glowBlobs.push(e);
        }
        while (this.glowBlobs.length > n) {
            const e = this.glowBlobs.pop();
            if (e.parentNode) e.parentNode.removeChild(e);
        }
    }

    _updateGlowClip(uid) {
        const mc = this.mapContext;
        if (!mc || !Array.isArray(mc.rooms) || typeof mc.isPointInPolygon !== 'function') return;
        const pxPct = (this.px / this.imgW) * 100;
        const pyPct = (this.py / this.imgH) * 100;
        const room = mc.rooms.find(r => r.polygon && mc.isPointInPolygon([pxPct, pyPct], r.polygon));
        const roomId = room ? room.id : null;
        if (roomId === this._glowClipRoom) return;
        this._glowClipRoom = roomId;

        let clip = this.glowDefs.querySelector(`#dm_clip_${uid}`);
        if (!room) {
            if (clip) clip.remove();
            this.glowGroup.removeAttribute('clip-path');
            return;
        }
        if (!clip) {
            clip = document.createElementNS(this.svgNS, 'clipPath');
            clip.setAttribute('id', `dm_clip_${uid}`);
            this.glowDefs.appendChild(clip);
        }
        while (clip.firstChild) clip.removeChild(clip.firstChild);
        const poly = document.createElementNS(this.svgNS, 'polygon');
        poly.setAttribute('points', room.polygon.map(p =>
            `${(p[0] / 100) * this.imgW},${(p[1] / 100) * this.imgH}`
        ).join(' '));
        clip.appendChild(poly);
        this.glowGroup.setAttribute('clip-path', `url(#dm_clip_${uid})`);
    }

    /** Current badge width/height in map units (mirrors the glow geometry). */
    _badgeSize() {
        let baseW = 24, baseH = 24;
        if (this.shape && this.shape.tagName === 'rect') {
            baseW = parseFloat(this.shape.getAttribute('width')) || 24;
            baseH = parseFloat(this.shape.getAttribute('height')) || 24;
        } else if (this.shape) {
            const r = parseFloat(this.shape.getAttribute('r')) || 12;
            baseW = baseH = r * 2;
        }
        return [baseW, baseH];
    }

    /**
     * Live-activity effects: a tiny animated equalizer while a media player
     * is playing, and trailing dust puffs while a vacuum is cleaning.
     */
    _updateActivityFx(hass) {
        const tgt = this.sc.entity_id || this.config.state_entity;
        const stObj = tgt && hass && hass.states ? hass.states[tgt] : null;
        const state = stObj ? stObj.state : null;
        const domain = (tgt || '').split('.')[0];
        this._setEqualizer((this.sc.type === 'media' || domain === 'media_player') && state === 'playing');
        this._setDust(this.sc.type === 'vacuum' && state === 'cleaning');
    }

    _setEqualizer(on) {
        this._eqVisible = !!on;
        if (!on) {
            if (this.eqGroup) this.eqGroup.style.display = 'none';
            return;
        }
        if (!this.eqGroup) {
            this.eqGroup = document.createElementNS(this.svgNS, 'g');
            this.eqGroup.classList.add('dm-eq');
            this.eqGroup.style.pointerEvents = 'none';
            this.eqPill = document.createElementNS(this.svgNS, 'rect');
            this.eqPill.setAttribute('fill', 'rgba(15, 23, 42, 0.55)');
            this.eqGroup.appendChild(this.eqPill);
            this.eqBars = [0, 1, 2].map(() => {
                const bar = document.createElementNS(this.svgNS, 'rect');
                bar.setAttribute('fill', '#ffffff');
                this.eqGroup.appendChild(bar);
                return bar;
            });
            this.group.appendChild(this.eqGroup);
        }
        const [bw, bh] = this._badgeSize();
        const s = Math.max(bw, 18) / 24;
        this._eqScale = s;
        this.eqGroup.setAttribute('transform', `translate(${(bw / 2).toFixed(1)}, ${(-bh / 2).toFixed(1)})`);
        this.eqPill.setAttribute('x', -8 * s);
        this.eqPill.setAttribute('y', -8 * s);
        this.eqPill.setAttribute('width', 16 * s);
        this.eqPill.setAttribute('height', 13 * s);
        this.eqPill.setAttribute('rx', 4 * s);
        this.eqBars.forEach((bar, i) => {
            bar.setAttribute('x', (-5.4 + i * 4) * s);
            bar.setAttribute('width', 2.6 * s);
            bar.setAttribute('rx', 1.2 * s);
            bar.setAttribute('y', -3 * s);
            bar.setAttribute('height', 6 * s);
        });
        this.eqGroup.style.display = 'block';
    }

    _setDust(on) {
        this._dustActive = !!on;
        if (!on) {
            if (this.dustGroup) this.dustGroup.style.display = 'none';
            return;
        }
        if (!this.dustGroup) {
            this.dustGroup = document.createElementNS(this.svgNS, 'g');
            this.dustGroup.classList.add('dm-dust');
            this.dustGroup.style.pointerEvents = 'none';
            this.dustPuffs = [0, 1, 2].map(() => {
                const c = document.createElementNS(this.svgNS, 'circle');
                c.setAttribute('fill', '#94a3b8');
                this.dustGroup.appendChild(c);
                return c;
            });
            this.group.insertBefore(this.dustGroup, this.group.firstChild);
        }
        this._dustScale = Math.max(this._badgeSize()[0], 18) / 24;
        this.dustGroup.style.display = 'block';
    }

    /**
     * Per-frame hook driven by the card's animation loop: glow pools breathe
     * and drift, equalizer bars bounce, dust puffs trail behind the vacuum.
     */
    animate(dt) {
        this._fxT = (this._fxT || 0) + dt;
        const t = this._fxT;
        if (this._glowVisible && this.glowBlobs && this.glowBlobs.length) {
            const k = 0.88 + 0.12 * Math.sin(t * 0.9);
            this.glowInner.setAttribute('opacity', k.toFixed(3));
            if (this._glowLine) {
                // Strip capsules stay aligned (drifting would break the line);
                // the breathing opacity above is the only motion.
                this.glowBlobs.forEach(b => b.removeAttribute('transform'));
            } else {
                const d = this.imgW * 0.008;
                // Point pools drift on their own phase so they intertwine.
                this.glowBlobs.forEach((b, i) => {
                    const px = Math.sin(t * (0.50 + i * 0.13) + i) * d * (1 + (i % 2) * 0.5);
                    const py = Math.cos(t * (0.37 + i * 0.11) + i * 1.7) * d * (1 + (i % 2) * 0.3);
                    b.setAttribute('transform', `translate(${px.toFixed(1)}, ${py.toFixed(1)})`);
                });
            }
        }
        if (this._eqVisible && this.eqBars) {
            const s = this._eqScale || 1;
            this.eqBars.forEach((bar, i) => {
                const h = (3 + 6 * Math.abs(Math.sin(t * (2.1 + i * 0.7) + i * 1.3))) * s;
                bar.setAttribute('height', h.toFixed(2));
                bar.setAttribute('y', (3 * s - h).toFixed(2));
            });
        }
        if (this._dustActive && this.dustPuffs) {
            const s = this._dustScale || 1;
            this.dustPuffs.forEach((c, i) => {
                const p = ((t * 0.45) + i / 3) % 1;
                c.setAttribute('cx', (-(8 + p * 18) * s).toFixed(1));
                c.setAttribute('cy', (Math.sin((t + i * 2.1) * 1.7) * 4 * s).toFixed(1));
                c.setAttribute('r', ((2 + p * 3.5) * s).toFixed(1));
                c.setAttribute('opacity', ((1 - p) * 0.45).toFixed(2));
            });
        }
    }

    /**
     * Pick a readable icon color for a given background: dark slate on
     * light backgrounds, white otherwise. Understands rgb() and #rrggbb;
     * anything else keeps the classic white.
     */
    _contrastText(color) {
        let r, g, b;
        const mRgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color || '');
        if (mRgb) {
            r = +mRgb[1]; g = +mRgb[2]; b = +mRgb[3];
        } else if (/^#[0-9a-f]{6}$/i.test(color || '')) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        } else {
            return '#ffffff';
        }
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 186 ? '#1e293b' : '#ffffff';
    }

    /**
     * Resolve a configured color, supporting the 'entity' sentinel: the
     * bound entity's live rgb_color (e.g. the current color of a color
     * light), re-resolved on every state update so the shortcut follows
     * the light. Falls back to amber when the entity reports no color.
     */
    _resolveColor(color, hass) {
        if (color !== 'entity') return color;
        const target = this.sc.entity_id || this.config.state_entity;
        const st = target && hass && hass.states ? hass.states[target] : null;
        const rgb = st && st.attributes ? st.attributes.rgb_color : null;
        if (Array.isArray(rgb) && rgb.length >= 3) {
            return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }
        return '#f59e0b';
    }

    /**
     * Auto-sized sensor pill layout. Geometry and content resolution live in
     * the shared SensorPill module (also used by the editor canvas preview);
     * this just maps them onto the generic component layout schema.
     */
    _buildSensorLayout(matchedState, hass, scaleX, scaleY) {
        const p = computeSensorPill({
            sc: this.sc, state: matchedState, hass, scaleX, scaleY,
            displayOverride: this.displayOverride || null
        });
        if (p.color === 'entity') {
            p.color = this._resolveColor('entity', hass);
            if (p.transparent) p.fg = p.color;
        }
        this._pillHalfW = p.width / 2; // real half-width for the unavailable strike-line
        return [
            {
                id: 'sensor_bg',
                type: 'rect',
                width: p.width,
                height: p.height,
                rx: p.rx,
                ry: p.rx,
                color: p.transparent ? 'rgba(0,0,0,0)' : p.color,
                stroke_color: p.transparent ? 'rgba(0,0,0,0)' : 'white',
                stroke_width: p.transparent ? 0 : 1
            },
            {
                id: 'sensor_emoji',
                type: 'text',
                x: p.iconX,
                y: 0,
                value: p.icon,
                font_size: p.fontIcon,
                align: 'middle',
                color: p.fg
            },
            {
                id: 'sensor_value',
                type: 'text',
                x: p.textX,
                y: 0,
                value: p.value,
                font_size: p.fontValue,
                align: 'start',
                font_weight: 'bold',
                color: p.fg
            }
        ];
    }

    renderComponents(layout, hass) {
        // Clear old children from groups
        while (this.bgGroup.firstChild) {
            this.bgGroup.removeChild(this.bgGroup.firstChild);
        }
        while (this.contentGroup.firstChild) {
            this.contentGroup.removeChild(this.contentGroup.firstChild);
        }
        
        let hasFailedImage = false;
        let fallbackIcon = '💡';
        
        layout.forEach(comp => {
            if (comp.type === 'image' && comp.tiling) {
                const el = this._buildTiledImage(comp, hass);
                if (comp.id) el.setAttribute('id', comp.id);
                this.contentGroup.appendChild(el);
                this.iconImage = el;
                return;
            }
            const renderer = ComponentRegistry[comp.type];
            if (renderer) {
                // Pre-evaluate dynamic JS templates inside text, icons, and image paths on a shallow copy
                const evaluatedComp = { ...comp };
                if (typeof evaluatedComp.value === 'string') {
                    evaluatedComp.value = evaluateTemplate(evaluatedComp.value, hass);
                }
                if (typeof evaluatedComp.icon === 'string') {
                    evaluatedComp.icon = evaluateTemplate(evaluatedComp.icon, hass);
                }
                if (typeof evaluatedComp.image === 'string') {
                    evaluatedComp.image = evaluateTemplate(evaluatedComp.image, hass);
                }
                
                const el = renderer(this.svgNS, evaluatedComp, hass);
                if (comp.id) {
                    el.setAttribute('id', comp.id);
                }
                
                // Track standard elements for backwards compatibility tests
                if (comp.type === 'rect' || comp.type === 'circle') {
                    this.shape = el;
                    this.bgGroup.appendChild(el);
                    this._applyBadgeDepth(el, comp);
                } else {
                    this.contentGroup.appendChild(el);
                }
                
                if (comp.id === 'sensor_value') {
                    this.iconText = el;
                } else if (comp.id === 'sensor_emoji') {
                    this.emojiText = el;
                }
                
                if (comp.type === 'icon') {
                    this.haIcon = el.querySelector('ha-icon');
                    // Setup JSDOM compatible attributes
                    let fillColor = comp.color || 'white';
                    if (fillColor === '#ffffff') fillColor = 'white';
                    this.iconText.setAttribute('fill', fillColor);
                    
                    // Style setter mock override for JSDOM
                    if (this.haIcon) {
                        Object.defineProperty(this.haIcon.style, 'color', {
                            get() { return this._haIconColorVal || fillColor; },
                            set(val) { this._haIconColorVal = val; },
                            configurable: true
                        });
                        this.haIcon.style.color = fillColor;
                    }
                    
                    const isMdi = comp.value && comp.value.includes(':');
                    if (isMdi) {
                        this.iconText.textContent = '';
                        if (this.haIcon) {
                            this.haIcon.style.display = 'block';
                        }
                    } else {
                        // Render plain text emoji directly inside SVG text element
                        this.iconText.textContent = comp.value || '';
                        if (this.haIcon) {
                            this.haIcon.style.display = 'none';
                        }
                    }
                    this.contentGroup.appendChild(this.iconText);
                } else if (comp.type === 'image') {
                    this.iconImage = el;
                    
                    const href = comp.value || '';
                    if (!this._imageLoadStates[href]) {
                        this._imageLoadStates[href] = { status: 'loading', failedTime: 0 };
                    }
                    const state = this._imageLoadStates[href];
                    
                    // Check if 15s retry cooldown has passed
                    if (state.status === 'failed' && Date.now() - state.failedTime > 15000) {
                        state.status = 'loading';
                    }
                    
                    if (state.status === 'loading') {
                        el.style.opacity = '0';
                        
                        // Temporarily remove href before binding listeners to prevent missing the cached load event
                        el.removeAttribute('href');
                        el.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                        
                        el.addEventListener('load', () => {
                            state.status = 'loaded';
                            el.style.opacity = '1';
                        });
                        el.addEventListener('error', () => {
                            state.status = 'failed';
                            state.failedTime = Date.now();
                            el.style.opacity = '0';
                            this.updateState(hass);
                        });
                        
                        // Restore href to trigger the load event sequentially after binding is complete
                        if (href) {
                            el.setAttribute('href', href);
                            el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
                        }
                    } else if (state.status === 'loaded') {
                        el.style.opacity = '1';
                    } else if (state.status === 'failed') {
                        el.style.opacity = '0';
                        hasFailedImage = true;
                    }
                }
                
                // Absolute Sizing Mode Offset
                if (this.sc.scale_mode === 'absolute') {
                    const inverseScale = 1 / (this.mapContext.currentZoomScale || 1);
                    const existingTransform = el.getAttribute('transform') || '';
                    el.setAttribute('transform', `scale(${inverseScale}) ${existingTransform}`.trim());
                }
            }
        });
        
        // Draw image failure fallback icon text
        if (hasFailedImage) {
            if (this.activeState && this.activeState.icon) {
                fallbackIcon = this.activeState.icon;
            } else if (this.config.icon) {
                fallbackIcon = this.config.icon;
            }
            this.iconText.textContent = fallbackIcon;
            this.contentGroup.appendChild(this.iconText);
        } else {
            if (this.iconText && this.iconText.id !== 'sensor_value') {
                this.iconText.textContent = '';
            }
        }
    }
    
    setTransformStr(str) {
        this.extraTransformStr = str;

        const activeMode = this.mapContext.activeMode || 'horizontal';
        const customRot = resolveOriented(this.sc.rotation, activeMode, 0);
        this.group.setAttribute('transform', this._badgeTransformStr());
        this._applyGlowTransform();

        // Resolve target config for content matching options
        const targetConfig = this.activeState || this.config || {};
        const contentMatchSize = targetConfig.content_matchSize !== undefined ? !!targetConfig.content_matchSize : (this.config.content_matchSize !== undefined ? !!this.config.content_matchSize : true);
        const contentMatchRot = targetConfig.content_matchRotation !== undefined ? !!targetConfig.content_matchRotation : (this.config.content_matchRotation !== undefined ? !!this.config.content_matchRotation : true);
        
        const contentX = targetConfig.content_x !== undefined ? targetConfig.content_x : (this.config.content_x !== undefined ? this.config.content_x : 0);
        const contentY = targetConfig.content_y !== undefined ? targetConfig.content_y : (this.config.content_y !== undefined ? this.config.content_y : 0);
        
        const contentScaleX = contentMatchSize ? 1.0 : (targetConfig.content_scaleX !== undefined ? targetConfig.content_scaleX : (this.config.content_scaleX !== undefined ? this.config.content_scaleX : 1.0));
        const contentScaleY = contentMatchSize ? 1.0 : (targetConfig.content_scaleY !== undefined ? targetConfig.content_scaleY : (this.config.content_scaleY !== undefined ? this.config.content_scaleY : 1.0));
        
        const contentRotation = contentMatchRot ? 0 : (targetConfig.content_rotation !== undefined ? targetConfig.content_rotation : (this.config.content_rotation !== undefined ? this.config.content_rotation : 0));

        let transforms = [];
        
        // 1. Translation offset
        if (contentX !== 0 || contentY !== 0) {
            transforms.push(`translate(${contentX}, ${contentY})`);
        }
        
        // 2. Decouple outer rotation from inner content rotation:
        // By default, text/icons/images stay vertical (upright) even when the outer map/shape rotates!
        const isRotated = this.mapContext.isRotated;
        const isAutoRotate = this.getIsAutoRotateActive();
        
        let totalContentRotation = 0;
        if (!contentMatchRot) {
            totalContentRotation = -customRot;
            if (isRotated && isAutoRotate) {
                totalContentRotation -= 90;
            }
            totalContentRotation += contentRotation;
        }
        
        if (totalContentRotation !== 0) {
            transforms.push(`rotate(${totalContentRotation})`);
        }
        
        // 3. Custom Scale offset
        if (!contentMatchSize && (contentScaleX !== 1.0 || contentScaleY !== 1.0)) {
            transforms.push(`scale(${contentScaleX}, ${contentScaleY})`);
        }
        
        this.contentGroup.setAttribute('transform', transforms.join(' '));
    }
    
    setupInteractions() {
        this.group.style.cursor = 'pointer';
        let pressTimer = null;
        let isDragging = false;
        let startPos = null;

        this.group.addEventListener('pointerdown', (e) => {
            isDragging = false;
            startPos = { x: e.clientX, y: e.clientY };
            pressTimer = window.setTimeout(() => {
                pressTimer = null;
                this.onLongPress(e);
            }, 500);
        });
        
        this.group.addEventListener('pointermove', (e) => {
            if (startPos) {
                const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
                if (dist > 8) {
                    isDragging = true;
                    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                }
            }
        });
        
        this.group.addEventListener('pointerup', (e) => {
            startPos = null;
            if (pressTimer) {
                clearTimeout(pressTimer);
                if (!isDragging) this.onClick(e);
            }
            e.stopPropagation();
        });
        
        this.group.addEventListener('pointercancel', () => {
            startPos = null;
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        });
    }
    
    onClick(e) {
        if (this.config.actions && this.config.actions.length > 0) {
            const tapActions = this.config.actions.filter(a => a.trigger === 'tap');
            if (tapActions.length > 0) {
                tapActions.forEach(act => {
                    const target = act.action_entity || this.sc.entity_id;
                    // Tap actions intentionally skip room-name -> segment-ID
                    // replacement and error alerts (see ActionRunner divergence notes).
                    executeAction(this.mapContext._hass, act, target);
                });
                return;
            }
        }
        // Sensors without an explicit tap action: tapping cycles the pill
        // between its configured readings (temperature ↔ humidity/moisture).
        if (this.sc.type === 'sensor') this.cycleSensorDisplay();
    }

    cycleSensorDisplay() {
        const cfg = this.config || {};
        const options = [null];
        if (cfg.humidity_entity) options.push({ entity: cfg.humidity_entity, unit: '%', icon: '💧' });
        if (options.length < 2) return;
        this._displayIdx = ((this._displayIdx || 0) + 1) % options.length;
        this.displayOverride = options[this._displayIdx];
        if (this.mapContext && this.mapContext._hass) this.updateState(this.mapContext._hass);
    }

    onLongPress(e) {
        if (!this.config.actions) return;
        const overlayActions = this.config.actions.filter(a => a.trigger === 'overlay' || a.trigger === 'long_press');
        if (overlayActions.length > 0 && this.mapContext.showOverlay) {
            this.mapContext.showOverlay(this, overlayActions, e);
        } else {
            if (this.sc.entity_id && this.mapContext._hass) {
                const event = new Event('hass-more-info', { bubbles: true, composed: true });
                event.detail = { entityId: this.sc.entity_id };
                this.mapContext.dispatchEvent(event);
            }
        }
    }
    
    render() {
        return this.group;
    }
}

