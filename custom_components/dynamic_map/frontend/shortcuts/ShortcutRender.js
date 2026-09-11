import { ComponentRegistry } from './ComponentRegistry.js?v=3.2.1';
import { evaluateTemplate } from './TemplateEvaluator.js?v=3.2.1';
import { buildTiledImage, applyBadgeDepth } from './ShortcutDefs.js?v=3.2.1';

const IMAGE_RETRY_MS = 15000;

/**
 * Turns a component layout into SVG children of the badge's bgGroup /
 * contentGroup. Takes the MapShortcut instance as `host` and keeps the
 * legacy element handles (shape, iconText, haIcon, iconImage, ...) that
 * the glow/fx modules and the tests rely on.
 */

function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function bindIcon(host, el, comp) {
    host.haIcon = el.querySelector('ha-icon');
    // <ha-icon> accepts MDI identifiers, not literal Unicode artwork. Keep
    // the foreignObject/haIcon for styling and add real SVG text for
    // values such as "📺" so the card can render them.
    if (typeof comp.value === 'string' && !comp.value.includes(':')) {
        const unicodeText = document.createElementNS(host.svgNS, 'text');
        unicodeText.setAttribute('x', comp.x || 0);
        unicodeText.setAttribute('y', comp.y || 0);
        unicodeText.setAttribute('text-anchor', 'middle');
        unicodeText.setAttribute('dominant-baseline', 'central');
        unicodeText.setAttribute('font-size', comp.size || 18);
        unicodeText.style.pointerEvents = 'none';
        unicodeText.textContent = comp.value;
        host.unicodeIconText = unicodeText;
        host.contentGroup.appendChild(unicodeText);
    }
    let fillColor = comp.color || 'white';
    if (fillColor === '#ffffff') fillColor = 'white';
    host.iconText.setAttribute('fill', fillColor);
    if (host.haIcon) {
        // Style setter override so jsdom reports the colour back.
        Object.defineProperty(host.haIcon.style, 'color', {
            get() { return this._haIconColorVal || fillColor; },
            set(val) { this._haIconColorVal = val; },
            configurable: true
        });
        host.haIcon.style.color = fillColor;
    }
    const isMdi = comp.value && comp.value.includes(':');
    host.iconText.textContent = isMdi ? '' : (comp.value || '');
    if (host.haIcon) host.haIcon.style.display = isMdi ? 'block' : 'none';
    host.contentGroup.appendChild(host.iconText);
}

/** Returns true when the image is known to have failed (fallback needed). */
function bindImage(host, el, comp, hass) {
    host.iconImage = el;
    const href = comp.value || '';
    if (!host._imageLoadStates[href]) {
        host._imageLoadStates[href] = { status: 'loading', failedTime: 0 };
    }
    const state = host._imageLoadStates[href];
    if (state.status === 'failed' && Date.now() - state.failedTime > IMAGE_RETRY_MS) {
        state.status = 'loading';
    }
    if (state.status === 'loading') {
        el.style.opacity = '0';
        // Remove href before binding listeners so a cached load is not missed.
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
            host.updateState(hass);
        });
        if (href) {
            el.setAttribute('href', href);
            el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
        }
        return false;
    }
    el.style.opacity = state.status === 'loaded' ? '1' : '0';
    return state.status === 'failed';
}

export function renderComponents(host, layout, hass) {
    clear(host.bgGroup);
    clear(host.contentGroup);
    let hasFailedImage = false;

    layout.forEach(comp => {
        if (comp.type === 'image' && comp.tiling) {
            const el = buildTiledImage(host, comp);
            if (comp.id) el.setAttribute('id', comp.id);
            host.contentGroup.appendChild(el);
            host.iconImage = el;
            return;
        }
        const renderer = ComponentRegistry[comp.type];
        if (!renderer) return;
        // Evaluate templates inside text, icons and image paths on a copy.
        const evaluated = { ...comp };
        for (const key of ['value', 'icon', 'image']) {
            if (typeof evaluated[key] === 'string') evaluated[key] = evaluateTemplate(evaluated[key], hass);
        }
        const el = renderer(host.svgNS, evaluated, hass);
        if (comp.id) el.setAttribute('id', comp.id);

        if (comp.type === 'rect' || comp.type === 'circle') {
            host.shape = el;
            host.bgGroup.appendChild(el);
            applyBadgeDepth(host, el, comp);
        } else {
            host.contentGroup.appendChild(el);
        }
        if (comp.id === 'sensor_value') host.iconText = el;
        else if (comp.id === 'sensor_emoji') host.emojiText = el;

        if (comp.type === 'icon') bindIcon(host, el, comp);
        else if (comp.type === 'image') hasFailedImage = bindImage(host, el, comp, hass) || hasFailedImage;

        // Absolute sizing mode: counter the camera zoom.
        if (host.sc.scale_mode === 'absolute') {
            const inverseScale = 1 / (host.mapContext.currentZoomScale || 1);
            const existing = el.getAttribute('transform') || '';
            el.setAttribute('transform', `scale(${inverseScale}) ${existing}`.trim());
        }
    });

    if (hasFailedImage) {
        const fallbackIcon = (host.activeState && host.activeState.icon) || host.config.icon || '💡';
        host.iconText.textContent = fallbackIcon;
        host.contentGroup.appendChild(host.iconText);
    } else if (host.iconText && host.iconText.id !== 'sensor_value' && !host.haIcon) {
        host.iconText.textContent = '';
    }
}
