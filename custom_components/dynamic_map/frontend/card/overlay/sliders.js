import { placeVisual, iconHtml } from './common.js?v=3.2.1';

/** SLIDER and VALUE_SLIDER overlay items. */

/** Bounds, initial value and unit for a slider target, per domain. */
export function sliderRange(hass, target) {
    const domain = (target || '').split('.')[0];
    const st = hass ? hass.states[target] : null;
    const attrs = st ? st.attributes : {};
    let min = 1, max = 100, step = 1, value = 50, unit = '';
    if (domain === 'climate') {
        if (attrs.min_temp !== undefined) min = attrs.min_temp;
        if (attrs.max_temp !== undefined) max = attrs.max_temp;
        if (attrs.target_temp_step !== undefined) step = attrs.target_temp_step;
        if (attrs.temperature !== undefined && attrs.temperature !== null) value = parseFloat(attrs.temperature);
        unit = '°C';
    } else if (domain === 'input_number' || domain === 'number') {
        if (attrs.min !== undefined) min = attrs.min;
        if (attrs.max !== undefined) max = attrs.max;
        if (attrs.step !== undefined) step = attrs.step;
        if (st) value = parseFloat(st.state);
        unit = attrs.unit_of_measurement || '';
    } else if (attrs.brightness !== undefined && attrs.brightness !== null) {
        value = Math.round((attrs.brightness / 255) * 100);
        unit = '%';
    }
    return { domain, min, max, step, value, unit, hasState: !!st };
}

/** Send a slider value to the right service for the target's domain. */
export function commitSliderValue(hass, target, domain, val) {
    if (domain === 'input_number' || domain === 'number') {
        hass.callService(domain, 'set_value', { entity_id: target, value: val });
    } else if (domain === 'climate') {
        hass.callService('climate', 'set_temperature', { entity_id: target, temperature: val });
    } else {
        hass.callService(domain, 'turn_on', { entity_id: target, brightness_pct: parseInt(val) });
    }
}

/** Symmetric scale: slider -4..4 maps to 1/5x..5x. */
export const symmetricToValue = (v) => (v >= 0 ? v + 1 : 1 / (-v + 1));
export const valueToSymmetric = (x) => (x >= 1 ? x - 1 : 1 - (1 / x));

export function buildSlider(mapContext, target, act, isVisual) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    const displayName = act.name !== undefined ? act.name : 'Brightness';
    if (displayName) {
        const label = document.createElement('span');
        label.textContent = displayName;
        label.className = 'dm-ov-label';
        container.appendChild(label);
    }
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'dm-ov-range';
    const isSymmetric = act.symmetric_scale === true;
    const r = sliderRange(mapContext._hass, target);
    if (isSymmetric) {
        slider.min = '-4'; slider.max = '4'; slider.step = '1';
        slider.value = r.hasState && (r.domain === 'input_number' || r.domain === 'number')
            ? valueToSymmetric(r.value) : '0';
    } else {
        slider.min = r.min; slider.max = r.max; slider.step = r.step;
        slider.value = r.value;
    }
    slider.style.width = act.width || '150px';
    slider.addEventListener('change', (e) => {
        if (!mapContext._hass) return;
        let val = parseFloat(e.target.value);
        if (isSymmetric) val = symmetricToValue(val);
        commitSliderValue(mapContext._hass, target, r.domain, val);
    });
    if (placeVisual(container, act, isVisual)) {
        slider.style.width = '100%';
        container.style.justifyContent = 'center';
        if (!displayName) container.style.alignItems = 'center';
    }
    if (!displayName && !(isVisual && act.pos_x !== undefined)) return slider;
    container.appendChild(slider);
    return container;
}

/** Like SLIDER, with a live numeric readout while dragging. */
export function buildValueSlider(mapContext, target, act, isVisual) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;';
    const r = sliderRange(mapContext._hass, target);
    const unit = act.unit !== undefined ? act.unit : r.unit;
    const decimals = act.decimals !== undefined ? act.decimals : (parseFloat(r.step) < 1 ? 1 : 0);
    const fmt = (v) => `${parseFloat(v).toFixed(decimals)}${unit ? ' ' + unit : ''}`;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; gap: 8px;';
    const label = document.createElement('span');
    label.textContent = act.name !== undefined ? act.name : 'Value';
    label.className = 'dm-ov-label';
    const valueOut = document.createElement('span');
    valueOut.textContent = fmt(r.value);
    valueOut.className = 'dm-ov-value dm-live';
    header.appendChild(label);
    header.appendChild(valueOut);
    container.appendChild(header);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = r.min; slider.max = r.max; slider.step = r.step; slider.value = r.value;
    slider.className = 'dm-ov-range';
    container.appendChild(slider);
    slider.addEventListener('input', (e) => { valueOut.textContent = fmt(e.target.value); });
    slider.addEventListener('change', (e) => {
        if (!mapContext._hass) return;
        commitSliderValue(mapContext._hass, target, r.domain, parseFloat(e.target.value));
    });
    if (placeVisual(container, act, isVisual)) container.style.justifyContent = 'center';
    return container;
}

/** The light's colour-temperature range and current value, in kelvin. */
export function warmthRange(hass, target) {
    const st = hass ? hass.states[target] : null;
    const a = st ? st.attributes || {} : {};
    const min = Number(a.min_color_temp_kelvin) || 2200, max = Number(a.max_color_temp_kelvin) || 6500;
    const k = Number(a.color_temp_kelvin);
    return { min, max, value: Number.isFinite(k) && k > 0 ? Math.min(max, Math.max(min, k)) : Math.round((min + max) / 2) };
}

/** WARMTH: colour temperature of a light, warm (left) to cool (right). Commits light.turn_on color_temp_kelvin. */
export function buildWarmthSlider(mapContext, target, act, isVisual) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    const displayName = act.name !== undefined && act.name !== '' ? act.name : 'Warmth';
    const label = document.createElement('span');
    label.textContent = displayName;
    label.className = 'dm-ov-label';
    container.appendChild(label);
    const r = warmthRange(mapContext._hass, target);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'dm-ov-range dm-ov-warmth';
    slider.min = r.min; slider.max = r.max; slider.step = 50; slider.value = r.value;
    slider.style.width = act.width ? act.width + (String(act.width).match(/\d$/) ? 'px' : '') : '150px';
    slider.addEventListener('change', (e) => {
        if (!mapContext._hass) return;
        mapContext._hass.callService('light', 'turn_on', { entity_id: target, color_temp_kelvin: parseInt(e.target.value, 10) });
    });
    container.appendChild(slider);
    if (placeVisual(container, act, isVisual)) {
        slider.style.width = '100%';
        container.style.justifyContent = 'center';
    }
    return container;
}

export { iconHtml };
