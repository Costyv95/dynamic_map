/**
 * Fixed screen-space "outside" dashboard docked at the top of the card.
 * Items come from the global outside.json (managed in the editor); unlike
 * shortcuts it never pans or zooms with the camera. `host` is the card.
 */

export const WEATHER_ICONS = {
    'clear-night': '🌙', 'cloudy': '☁️', 'fog': '🌫️', 'hail': '🌨️',
    'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅',
    'pouring': '🌧️', 'rainy': '🌦️', 'snowy': '🌨️', 'snowy-rainy': '🌨️',
    'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨', 'exceptional': '⚠️'
};

const isDead = (st) => !st || st.state === 'unavailable' || st.state === 'unknown';

export function buildOutsideBar(host) {
    host.outsideBar = null;
    host._outsideEls = null;
    host.renderRoot.classList.remove('dm-has-outside');
    if (host.config.outside_bar === false) return;
    const items = host.outsideItems || [];
    if (!items.length) return;

    const bar = document.createElement('div');
    bar.className = 'dm-outside-bar';
    host._outsideEls = items.map(item => {
        const el = document.createElement('div');
        el.className = 'dm-outside-item';
        el.title = item.name || item.entity_id || '';
        el.innerHTML = `<span class="dm-outside-value"><span class="dm-oi-icon"></span><span class="dm-oi-text">—</span></span><span class="dm-outside-label"></span>`;
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.entity_id) {
                host.dispatchEvent(new CustomEvent('hass-more-info', {
                    detail: { entityId: item.entity_id }, bubbles: true, composed: true
                }));
            }
        });
        bar.appendChild(el);
        return { el, item };
    });
    // Lives in the top flex row with the floor/rotation controls, so it
    // wraps to its own line instead of overlapping them on narrow cards.
    (host.topLeftUI || host.renderRoot).appendChild(bar);
    host.outsideBar = bar;
    host.renderRoot.classList.add('dm-has-outside');
    if (host._hass) updateOutsideBar(host, host._hass);
}

/** Format one item's value/label/icon from its entity state. */
export function outsideItemView(item, st) {
    let icon = item.icon || '';
    let value = '—';
    let label = item.name || '';
    if (!isDead(st)) {
        const isWeather = item.entity_id.startsWith('weather.');
        if (isWeather && !item.attribute) {
            if (!icon) icon = WEATHER_ICONS[st.state] || '🌤️';
            const temp = st.attributes.temperature;
            value = (temp !== undefined && temp !== null) ? `${temp}°` : String(st.state).replace(/[-_]/g, ' ');
            if (!label) label = String(st.state).replace(/[-_]/g, ' ');
        } else {
            const raw = item.attribute ? st.attributes[item.attribute] : st.state;
            const num = Number(raw);
            if (raw === undefined || raw === null || raw === '') {
                value = '—';
            } else if (Number.isFinite(num)) {
                value = String(Math.round(num * 10) / 10);
                const unit = item.unit !== undefined ? item.unit : (st.attributes.unit_of_measurement || '');
                if (unit) value += unit.startsWith('°') ? unit : ` ${unit}`;
            } else {
                value = String(raw).replace(/[-_]/g, ' ');
            }
        }
    }
    return { icon, value, label, dead: isDead(st) };
}

export function updateOutsideBar(host, hass) {
    if (!host._outsideEls) return;
    host._outsideEls.forEach(({ el, item }) => {
        const st = item.entity_id ? hass.states[item.entity_id] : null;
        const v = outsideItemView(item, st);
        el.classList.toggle('dm-unavailable', v.dead);
        const iconEl = el.querySelector('.dm-oi-icon');
        iconEl.textContent = v.icon;
        iconEl.style.display = v.icon ? '' : 'none';
        el.querySelector('.dm-oi-text').textContent = v.value;
        const labelEl = el.querySelector('.dm-outside-label');
        labelEl.textContent = v.label;
        labelEl.style.display = v.label ? '' : 'none';
    });
}
