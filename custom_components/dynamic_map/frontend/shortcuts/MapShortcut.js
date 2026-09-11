import { evaluateCondition } from './ConditionEvaluator.js?v=3.2.1';
import { resolveOriented, resolveOrientedStrict } from '../shared/OrientationProps.js?v=3.2.1';
import { resolveEntityColor, contrastText } from '../shared/Color.js?v=3.2.1';
import { shortcutFrame } from '../shared/ShortcutGeometry.js?v=3.2.1';
import { estimateTextWidth } from '../shared/SensorPill.js?v=3.2.1';
import { buildLayout } from './ShortcutLayout.js?v=3.2.1';
import { renderComponents } from './ShortcutRender.js?v=3.2.1';
import { updateGlow, animateGlow } from './ShortcutGlow.js?v=3.2.1';
import { updateActivityFx, animateFx } from './ShortcutFx.js?v=3.2.1';
import { setupInteractions, onClick, onLongPress, cycleSensorDisplay } from './ShortcutInteractions.js?v=3.2.1';
import { collectEntities, snapshotStates, statesChanged } from './ShortcutDeps.js?v=3.2.1';

/**
 * One badge on the map: evaluates its state, builds a declarative layout
 * (ShortcutLayout), renders it into SVG (ShortcutRender) and drives the
 * glow / activity effects. The editor mounts the same class, so what you
 * edit is what the dashboard shows.
 */
export class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext || { activeMode: 'horizontal' };
        this.config = scData.config || {};

        this.group = document.createElementNS(svgNS, 'g');
        this.group.classList.add('shortcut-group');
        this.group.setAttribute('id', scData.id);
        this.group.dataset.shortcutId = scData.id;
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
        this._deps = collectEntities(scData);
        this._snap = null;

        this.updateCoordinates();

        const interactive = this.mapContext.interactive !== false;
        if (this.config.decor) {
            // Decor is scenery: never intercepts a tap, binds no handlers.
            this.group.style.pointerEvents = interactive ? 'none' : '';
        } else {
            // Invisible hitbox to expand the tap area of small elements.
            this.hitbox = document.createElementNS(svgNS, 'circle');
            this.hitbox.setAttribute('r', 30);
            this.hitbox.setAttribute('fill', 'rgba(0,0,0,0)');
            this.hitbox.style.pointerEvents = 'all';
            this.group.appendChild(this.hitbox);
            // The editor mounts the same badges but must never fire actions.
            if (interactive) setupInteractions(this);
        }
    }

    get activeMode() { return this.mapContext.activeMode || 'horizontal'; }

    /**
     * Width of `text` at `fontSize` as the browser will actually draw it
     * (a hidden <text> in this badge), falling back to the estimate when
     * the badge is not mounted yet or the platform cannot measure.
     */
    measureText(text, fontSize, weight = 'bold') {
        if (!this.group.isConnected) return estimateTextWidth(text, fontSize);
        if (!this._measureEl) {
            this._measureEl = document.createElementNS(this.svgNS, 'text');
            this._measureEl.setAttribute('visibility', 'hidden');
            this._measureEl.style.pointerEvents = 'none';
            this.group.appendChild(this._measureEl);
        }
        const el = this._measureEl;
        if (typeof el.getComputedTextLength !== 'function') return estimateTextWidth(text, fontSize);
        el.setAttribute('font-size', fontSize);
        el.setAttribute('font-weight', weight);
        el.textContent = String(text);
        const w = el.getComputedTextLength();
        return Number.isFinite(w) && w > 0 ? w : estimateTextWidth(text, fontSize);
    }

    /** Current frame (map px) for the active mode and matched state. */
    frame() {
        return shortcutFrame(this.sc, {
            mode: this.activeMode, state: this.activeState || null,
            imgW: this.imgW, imgH: this.imgH, hass: this.mapContext._hass
        });
    }

    updateCoordinates() {
        const f = shortcutFrame(this.sc, { mode: this.activeMode, imgW: this.imgW, imgH: this.imgH });
        this.px = f.x;
        this.py = f.y;
        this.group.setAttribute('transform', this._badgeTransformStr());
        this._applyGlowTransform();
    }

    /**
     * Placement in map coordinates: position, the badge's own rotation,
     * then the card's counter-transforms (flip scale and the rotate(-90)
     * that keeps an upright badge upright while the map is rotated). The
     * glow lives in mapRoot so it must use this exact transform.
     */
    _badgeTransformStr() {
        const customRot = resolveOriented(this.sc.rotation, this.activeMode, 0);
        const rotStr = customRot ? `rotate(${customRot})` : '';
        return `translate(${this.px}, ${this.py}) ${rotStr} ${this.extraTransformStr || ''}`.trim();
    }

    _applyGlowTransform() {
        if (!this.glowInner || !this.mapContext || !this.mapContext.mapRoot) return;
        this.glowInner.setAttribute('transform', this._badgeTransformStr());
    }

    _matchState(hass) {
        const states = this.config.states;
        if (!states || !states.length) return null;
        // Editor preview: a forced state wins over the live evaluation.
        if (this.forcedState && states.includes(this.forcedState)) return this.forcedState;
        for (const st of states) {
            if (st.is_default) continue;
            const cond = st.conditions || (st.state_entity || st.entity ? st : null);
            if (evaluateCondition(cond, hass)) return st;
        }
        return states.find(st => st.is_default) || null;
    }

    getIsAutoRotateActive() {
        const hass = this.mapContext._hass;
        const st = hass ? this._matchState(hass) : null;
        if (st && st.autoRotate !== undefined) return st.autoRotate;
        return !!this.config.autoRotate;
    }

    /** Forget the dependency snapshot so the next updateState re-renders. */
    invalidate() { this._snap = null; }

    /**
     * Re-evaluate and re-render. Returns true when something was rendered.
     * With mapContext.skipUnchanged the badge is left alone on hass ticks
     * that changed none of its entities and no layout inputs.
     */
    updateState(hass) {
        if (hass && (hass.states || hass.callService)) this.mapContext._hass = hass;
        const mode = this.activeMode;
        if (this.mapContext.skipUnchanged && this._snap && this._snapMode === mode
            && this._snapOverride === this.displayOverride
            && !statesChanged(this._deps, this._snap, hass)) {
            this.updateCoordinates();
            return false;
        }
        this._snap = snapshotStates(this._deps, hass);
        this._snapMode = mode;
        this._snapOverride = this.displayOverride;

        this.updateCoordinates();
        this.activeState = this._matchState(hass);
        const built = buildLayout(this, this.activeState, hass, mode);
        this.scaleX = built.scaleX;
        this.scaleY = built.scaleY;
        this._pillHalfW = built.pillHalfW;
        renderComponents(this, built.layout, hass);

        const isUnavailable = this._updateAvailability(hass, built.isSensor);
        updateGlow(this, isUnavailable ? null : hass);
        updateActivityFx(this, isUnavailable ? null : hass);

        // One-artwork state styling: image shortcuts without explicit state
        // overrides derive their off-look automatically.
        if (this.iconImage && !(this.config.states && this.config.states.length) && !isUnavailable) {
            const tgt = this.sc.entity_id || this.config.state_entity;
            const stObj = tgt && hass && hass.states ? hass.states[tgt] : null;
            this.contentGroup.style.filter = (stObj && stObj.state === 'off') ? 'grayscale(55%) brightness(0.75)' : '';
        }
        return true;
    }

    /** Grey out + strike through when any source entity is unavailable. */
    _updateAvailability(hass, isSensor) {
        const cfg = this.config;
        let entities;
        if (cfg.availability_entity) entities = [cfg.availability_entity];
        else if (this.sc.entity_id) entities = [this.sc.entity_id];
        else entities = [cfg.entity, cfg.state_entity, cfg.display_entity, cfg.temperature_entity, cfg.humidity_entity].filter(Boolean);
        const isUnavailable = !!(hass && hass.states) && entities.some((e) => {
            const s = hass.states[e];
            return !!s && (s.state === 'unavailable' || s.state === 'unknown');
        });
        const filter = isUnavailable ? 'grayscale(100%) opacity(45%)' : '';
        this.bgGroup.style.filter = filter;
        if (this.iconText) this.iconText.style.filter = filter;
        this.unavailableLine.style.display = isUnavailable ? 'block' : 'none';
        if (isUnavailable) {
            const num = (v) => {
                const r = resolveOrientedStrict(v, this.activeMode);
                return Number.isFinite(r) ? r : undefined;
            };
            const scale = num(this.sc.scale) ?? 1.0;
            const sX = num(this.scaleX) ?? num(this.sc.scaleX) ?? scale;
            const sY = num(this.scaleY) ?? num(this.sc.scaleY) ?? scale;
            const lineRx = isSensor ? (this._pillHalfW ?? 26 * sX) : 12 * sX;
            this.unavailableLine.setAttribute('x1', -lineRx * 0.7);
            this.unavailableLine.setAttribute('y1', -12 * sY * 0.7);
            this.unavailableLine.setAttribute('x2', lineRx * 0.7);
            this.unavailableLine.setAttribute('y2', 12 * sY * 0.7);
        }
        return isUnavailable;
    }

    _contrastText(color) { return contrastText(color); }

    _resolveColor(color, hass) {
        return resolveEntityColor(color, hass, this.sc.entity_id || this.config.state_entity);
    }

    /** Per-frame hook driven by the card's animation loop. */
    animate(dt) {
        this._fxT = (this._fxT || 0) + dt;
        animateGlow(this, this._fxT);
        animateFx(this, this._fxT);
    }

    /**
     * Card counter-transforms (flips, upright rotation) plus the inner
     * content transform: text/icons/images stay upright by default even
     * when the badge or the map rotates.
     */
    setTransformStr(str) {
        this.extraTransformStr = str;
        const customRot = resolveOriented(this.sc.rotation, this.activeMode, 0);
        this.group.setAttribute('transform', this._badgeTransformStr());
        this._applyGlowTransform();

        const cfg = this.config;
        const tc = this.activeState || cfg || {};
        const pick = (prop, def) => tc[prop] !== undefined ? tc[prop] : (cfg[prop] !== undefined ? cfg[prop] : def);
        const matchSize = !!pick('content_matchSize', true);
        const matchRot = !!pick('content_matchRotation', true);
        const contentX = pick('content_x', 0);
        const contentY = pick('content_y', 0);
        const contentScaleX = matchSize ? 1.0 : pick('content_scaleX', 1.0);
        const contentScaleY = matchSize ? 1.0 : pick('content_scaleY', 1.0);
        const contentRotation = matchRot ? 0 : pick('content_rotation', 0);

        const transforms = [];
        if (contentX !== 0 || contentY !== 0) transforms.push(`translate(${contentX}, ${contentY})`);
        let totalRot = 0;
        if (!matchRot) {
            totalRot = -customRot;
            if (this.mapContext.isRotated && this.getIsAutoRotateActive()) totalRot -= 90;
            totalRot += contentRotation;
        }
        if (totalRot !== 0) transforms.push(`rotate(${totalRot})`);
        if (!matchSize && (contentScaleX !== 1.0 || contentScaleY !== 1.0)) {
            transforms.push(`scale(${contentScaleX}, ${contentScaleY})`);
        }
        this.contentGroup.setAttribute('transform', transforms.join(' '));
    }

    onClick() { onClick(this); }
    onLongPress(e) { onLongPress(this, e); }
    cycleSensorDisplay() { cycleSensorDisplay(this); }

    render() {
        return this.group;
    }
}
