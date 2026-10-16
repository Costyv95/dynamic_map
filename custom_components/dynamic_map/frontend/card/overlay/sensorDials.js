import { clampAndPositionOverlay } from './common.js?v=3.2.1';

/**
 * Sensor radial gauges popup: temperature and humidity rings with comfort
 * colouring, animated in after mount.
 */

const RING = 188.5; // circumference of the r=30 ring

export function comfortColors(tempVal, humVal) {
    let tempColor = '#ef4444';
    if (!isNaN(tempVal)) {
        if (tempVal < 19) tempColor = '#3b82f6';
        else if (tempVal <= 22) tempColor = '#10b981';
        else tempColor = '#f97316';
    }
    let humColor = '#3b82f6';
    if (!isNaN(humVal)) {
        if (humVal < 40) humColor = '#eab308';
        else if (humVal <= 60) humColor = '#10b981';
        else humColor = '#3b82f6';
    }
    return { tempColor, humColor };
}

function column(title, color, icon, valueStr, id) {
    return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
            <span class="dm-ov-caption">${title}</span>
            <div style="position: relative; width: 70px; height: 70px;">
                <svg width="70" height="70" viewBox="0 0 70 70">
                    <circle class="dm-ov-gauge-ring" cx="35" cy="35" r="30" fill="none" stroke-width="4"></circle>
                    <circle id="${id}" cx="35" cy="35" r="30" fill="none" stroke="${color}" stroke-width="4"
                            stroke-dasharray="${RING}" stroke-dashoffset="${RING}" stroke-linecap="round"
                            style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); transform: rotate(-90deg); transform-origin: 35px 35px;"></circle>
                </svg>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <ha-icon icon="${icon}" style="--mdc-icon-size: 24px; color: ${color};"></ha-icon>
                </div>
            </div>
            <span class="dm-ov-value dm-big">${valueStr}</span>
        </div>`;
}

export function showSensorDials(mapContext, shortcut, event) {
    const sc = shortcut.sc;
    const hass = mapContext._hass;
    const tempEntity = sc.config.temperature_entity || 'sensor.room_temperature';
    const humEntity = sc.config.humidity_entity || 'sensor.room_humidity';
    const tempVal = hass && hass.states[tempEntity] ? parseFloat(hass.states[tempEntity].state) : NaN;
    const humVal = hass && hass.states[humEntity] ? parseFloat(hass.states[humEntity].state) : NaN;
    const tempValStr = !isNaN(tempVal) ? `${tempVal.toFixed(1)}°C` : '--';
    const humValStr = !isNaN(humVal) ? `${humVal.toFixed(0)}%` : '--';
    const { tempColor, humColor } = comfortColors(tempVal, humVal);
    // Fill ratios (Temp 0-40, Hum 0-100)
    const tempPct = !isNaN(tempVal) ? Math.max(0, Math.min(1, tempVal / 40)) : 0;
    const humPct = !isNaN(humVal) ? Math.max(0, Math.min(1, humVal / 100)) : 0;

    const el = mapContext.activeOverlay;
    el.classList.add('dm-gauges');
    el.innerHTML = column('Temperature', tempColor, 'mdi:thermometer', tempValStr, 'tempCircle')
        + '<div class="dm-ov-divider"></div>'
        + column('Humidity', humColor, 'mdi:water-percent', humValStr, 'humCircle');
    mapContext.renderRoot.appendChild(el);
    // Smoothly animate the fill values upon mounting
    setTimeout(() => {
        const tempEl = el.querySelector('#tempCircle');
        const humEl = el.querySelector('#humCircle');
        if (tempEl) tempEl.style.strokeDashoffset = (RING - RING * tempPct).toString();
        if (humEl) humEl.style.strokeDashoffset = (RING - RING * humPct).toString();
    }, 50);
    const rect = mapContext.renderRoot.getBoundingClientRect();
    clampAndPositionOverlay(el, rect, event.clientX - rect.left, event.clientY - rect.top, 230, 140);
}
