import { resolveOriented } from '../shared/OrientationProps.js?v=3.2.1';
import { computeSensorPill } from '../shared/SensorPill.js?v=3.2.1';
import { contrastText, resolveEntityColor } from '../shared/Color.js?v=3.2.1';

/**
 * Builds the declarative component layout for a badge from its config and
 * the matched state. Pure apart from reading `host.sc`/`host.config` and
 * `host.displayOverride`; returns { layout, scaleX, scaleY, pillHalfW }.
 */

function pick(matchedState, config, prop, fallback) {
    if (matchedState && matchedState[prop] !== undefined) return matchedState[prop];
    if (config[prop] !== undefined) return config[prop];
    return fallback;
}

/** Auto-sized sensor pill mapped onto the component schema. */
function sensorLayout(host, matchedState, hass, scaleX, scaleY) {
    const target = host.sc.entity_id || host.config.state_entity;
    const p = computeSensorPill({
        sc: host.sc, state: matchedState, hass, scaleX, scaleY,
        displayOverride: host.displayOverride || null,
        measure: typeof host.measureText === 'function' ? (t, fs) => host.measureText(t, fs, 'bold') : undefined
    });
    if (p.color === 'entity') {
        p.color = resolveEntityColor('entity', hass, target);
        if (p.transparent) p.fg = p.color;
    }
    const layout = [
        {
            id: 'sensor_bg', type: 'rect', width: p.width, height: p.height, rx: p.rx, ry: p.rx,
            color: p.transparent ? 'rgba(0,0,0,0)' : p.color,
            stroke_color: p.transparent ? 'rgba(0,0,0,0)' : 'white',
            stroke_width: p.transparent ? 0 : 1
        },
        { id: 'sensor_emoji', type: 'text', x: p.iconX, y: 0, value: p.icon, font_size: p.fontIcon, align: 'middle', color: p.fg },
        { id: 'sensor_value', type: 'text', x: p.textX, y: 0, value: p.value, font_size: p.fontValue, align: 'start', font_weight: 'bold', color: p.fg }
    ];
    return { layout, pillHalfW: p.width / 2 };
}

/** Default badge: a shape plus an icon or an image. */
function badgeLayout(host, matchedState, hass, shape, scaleX, scaleY) {
    const config = host.config;
    const target = host.sc.entity_id || config.state_entity;
    const w = 24 * scaleX, h = 24 * scaleY;
    const scale = Math.min(scaleX, scaleY);
    const contentMatchSize = pick(matchedState, config, 'content_matchSize', true) !== false;
    const stColor = resolveEntityColor(matchedState?.color || config.color, hass, target);
    const stTrans = pick(matchedState, config, 'transparent', false);
    const isRect = shape === 'rect';
    // config.border: false drops the outline so solid shapes read as
    // architecture (walls) instead of badges.
    const noBorder = pick(matchedState, config, 'border', true) === false;
    const layout = [{
        id: 'fallback_bg', type: isRect ? 'rect' : 'circle',
        radius: 12 * scaleX, radiusX: 12 * scaleX, radiusY: 12 * scaleY, width: w, height: h,
        color: stTrans ? 'rgba(0,0,0,0)' : (stColor || '#0ea5e9'),
        stroke_color: (stTrans || noBorder) ? 'rgba(0,0,0,0)' : 'white',
        stroke_width: (stTrans || noBorder) ? 0 : 1
    }];
    // A state image beats the base icon; otherwise icon beats image.
    const iconVal = matchedState?.icon || config.icon;
    const imgVal = matchedState?.image || config.image;
    if (imgVal && (matchedState?.image || !iconVal)) {
        const tiling = pick(matchedState, config, 'image_tiling', undefined);
        layout.push({
            id: 'fallback_image', type: 'image', value: imgVal,
            width: contentMatchSize ? w : 24, height: contentMatchSize ? h : 24,
            // Seamless textures repeat as square tiles: 'axis' runs along
            // the long side (LED strips), 'both' fills the rect (panels).
            tiling: isRect && tiling ? (tiling === 'both' ? 'both' : 'axis') : false,
            tile_size: pick(matchedState, config, 'image_tile_size', undefined)
        });
    } else if (iconVal) {
        layout.push({
            id: 'fallback_icon', type: 'icon', value: iconVal, size: 18 * scale,
            color: stTrans ? (stColor || '#facaca') : contrastText(stColor || '#0ea5e9')
        });
    }
    return layout;
}

/** Sensor value/emoji patch used on user-provided layouts. */
function patchSensorText(host, copy, state, hass, fallbackColor) {
    const config = host.config;
    const transparent = state ? pick(state, config, 'transparent', false) : config.transparent;
    const color = state ? resolveEntityColor(state.color || config.color, hass, host.sc.entity_id) : resolveEntityColor(config.color, hass, host.sc.entity_id);
    const fg = transparent ? (color || fallbackColor) : '#ffffff';
    const emojiEl = copy.find(el => el.id === 'sensor_emoji');
    if (emojiEl) {
        if (state && state.icon) emojiEl.value = state.icon;
        emojiEl.color = fg;
    }
    const valueEl = copy.find(el => el.id === 'sensor_value');
    if (valueEl) {
        const dispEntity = (state && (state.display_entity || state.state_entity))
            || config.temperature_entity || config.state_entity || host.sc.entity_id;
        const unit = (state && state.unit) || config.unit || '°';
        const defaultTemplate = dispEntity ? `{states('${dispEntity}')}${unit}` : '';
        valueEl.value = (state && state.value_template) || config.value_template || defaultTemplate;
        valueEl.color = fg;
    }
}

/** Classic patch pass for a user-provided layout with a matched state. */
function patchCustomLayout(host, layout, matchedState, hass, isSensor) {
    const config = host.config;
    const copy = JSON.parse(JSON.stringify(layout));
    if (!copy.length) return copy;
    const stColor = resolveEntityColor(matchedState.color || config.color, hass, host.sc.entity_id);
    const stTrans = pick(matchedState, config, 'transparent', undefined);
    if (stColor) {
        if (stTrans) { copy[0].stroke_color = 'rgba(0,0,0,0)'; copy[0].color = 'rgba(0,0,0,0)'; }
        else copy[0].color = stColor;
    }
    if (isSensor) {
        patchSensorText(host, copy, matchedState, hass, '#10b981');
        return copy;
    }
    let contentEl = copy.find(el => el.type === 'icon' || el.type === 'image');
    if (!contentEl && (matchedState.icon || matchedState.image)) {
        contentEl = { id: 'fallback_content', type: 'icon', value: '' };
        copy.push(contentEl);
    }
    if (contentEl) {
        const contentMatchSize = pick(matchedState, config, 'content_matchSize', true) !== false;
        if (matchedState.image) {
            contentEl.type = 'image';
            contentEl.value = matchedState.image;
            contentEl.width = contentMatchSize ? (copy[0].width || 24) : 24;
            contentEl.height = contentMatchSize ? (copy[0].height || 24) : 24;
        } else if (matchedState.icon) {
            contentEl.type = 'icon';
            contentEl.value = matchedState.icon;
            contentEl.color = stTrans ? (stColor || '#facaca') : 'white';
        }
    }
    return copy;
}

export function buildLayout(host, matchedState, hass, activeMode) {
    const config = host.config;
    const sc = host.sc;
    const isSensor = sc.type === 'sensor' || !!(config.states && config.states.some(s => s.display_entity));
    const customLayout = config.default_layout || [];
    const resolveProp = (prop, def) => {
        // state > shortcut > instance (callers may pre-set host.scaleX).
        const val = matchedState?.[prop] !== undefined ? matchedState[prop]
            : (sc[prop] !== undefined ? sc[prop] : host[prop]);
        return resolveOriented(val, activeMode, def);
    };
    const scaleVal = resolveProp('scale', 1.0);
    const scaleX = resolveProp('scaleX', scaleVal);
    let scaleY = resolveProp('scaleY', scaleVal);
    const shape = matchedState?.shape || config.shape || sc.shape || (isSensor ? 'rect' : 'circle');
    const proportional = config.proportional !== undefined ? config.proportional : (shape === 'circle');
    if (proportional) scaleY = scaleX;

    let layout = customLayout;
    let pillHalfW;
    if (layout.length === 0) {
        if (isSensor) {
            const r = sensorLayout(host, matchedState, hass, scaleX, scaleY);
            layout = r.layout;
            pillHalfW = r.pillHalfW;
        } else {
            layout = badgeLayout(host, matchedState, hass, shape, scaleX, scaleY);
        }
    }
    if (matchedState) {
        if (matchedState.layout_override && matchedState.layout_override.length > 0) {
            layout = matchedState.layout_override;
        } else if (customLayout.length > 0) {
            layout = patchCustomLayout(host, layout, matchedState, hass, isSensor);
        }
    } else if (isSensor && customLayout.length > 0 && config.states && config.states.length > 0) {
        // No state matched for a sensor with a user layout: root templates.
        const copy = JSON.parse(JSON.stringify(layout));
        patchSensorText(host, copy, null, hass, '#10b981');
        layout = copy;
    }
    return { layout, scaleX, scaleY, isSensor, pillHalfW };
}
