import { tempColor } from './RoomTemperature.js?v=3.2.1';

/** Small gradient scale shown while `room_temperature` is on. */
export function buildTempLegend(host) {
    host.tempLegend = null;
    if (!host.config || !host.config.room_temperature) return;
    const range = Array.isArray(host.config.temperature_range) && host.config.temperature_range.length === 2 ? host.config.temperature_range : [16, 28];
    const stops = [0, 0.25, 0.5, 0.75, 1].map(k => tempColor(range[0] + (range[1] - range[0]) * k, range[0], range[1]));
    const el = document.createElement('div');
    el.className = 'dm-temp-legend';
    el.innerHTML = `<span class="dm-tl-min"></span><span class="dm-tl-bar"></span><span class="dm-tl-max"></span>`;
    el.querySelector('.dm-tl-min').textContent = `${range[0]}°`;
    el.querySelector('.dm-tl-max').textContent = `${range[1]}°`;
    el.querySelector('.dm-tl-bar').style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
    el.title = 'Room colour by temperature';
    host.renderRoot.appendChild(el);
    host.tempLegend = el;
}
