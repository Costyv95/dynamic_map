/**
 * Quick-action chips at the bottom of the card, from the card config:
 *
 *   quick_actions:
 *     - name: All off
 *       icon: 🌙
 *       service: light.turn_off
 *       data: { entity_id: all }
 *       confirm: true          # two taps
 *     - entity: switch.garden  # shorthand: toggle, chip lit while on
 *       name: Garden
 */

const CONFIRM_MS = 4000;

/** Normalise one config entry into { name, icon, call, entity, confirm }. */
export function normalizeAction(a) {
    if (!a || typeof a !== 'object') return null;
    let call = null;
    if (a.service && typeof a.service === 'string' && a.service.includes('.')) {
        const [domain, service] = a.service.split('.', 2);
        call = { domain, service, data: { ...(a.data || {}) } };
    } else if (a.entity) {
        call = { domain: a.entity.split('.')[0], service: 'toggle', data: { entity_id: a.entity } };
    }
    if (!call) return null;
    const entity = a.entity || (typeof call.data.entity_id === 'string' && call.data.entity_id !== 'all' ? call.data.entity_id : null);
    return { name: a.name || (entity ? entity.split('.')[1].replace(/_/g, ' ') : a.service), icon: a.icon || '', call, entity, confirm: !!a.confirm };
}

export function buildQuickActions(host) {
    host.quickActions = null;
    const items = (Array.isArray(host.config.quick_actions) ? host.config.quick_actions : []).map(normalizeAction).filter(Boolean);
    if (!items.length) return;
    const bar = document.createElement('div');
    bar.className = 'dm-quick-actions';
    bar.addEventListener('pointerdown', e => e.stopPropagation());
    host._quickEls = items.map(item => {
        const chip = document.createElement('button');
        chip.className = 'dm-quick-chip';
        chip.innerHTML = `<span class="dm-qc-icon"></span><span class="dm-qc-name"></span>`;
        chip.querySelector('.dm-qc-icon').textContent = item.icon;
        chip.querySelector('.dm-qc-icon').style.display = item.icon ? '' : 'none';
        chip.querySelector('.dm-qc-name').textContent = item.name;
        chip.title = item.name;
        let armed = null;
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!host._hass) return;
            if (item.confirm && !armed) {
                chip.classList.add('dm-armed');
                chip.querySelector('.dm-qc-name').textContent = 'Tap again';
                armed = setTimeout(() => { armed = null; chip.classList.remove('dm-armed'); chip.querySelector('.dm-qc-name').textContent = item.name; }, CONFIRM_MS);
                return;
            }
            if (armed) { clearTimeout(armed); armed = null; chip.classList.remove('dm-armed'); chip.querySelector('.dm-qc-name').textContent = item.name; }
            host._hass.callService(item.call.domain, item.call.service, item.call.data);
            chip.classList.add('dm-fired');
            setTimeout(() => chip.classList.remove('dm-fired'), 350);
        });
        bar.appendChild(chip);
        return { chip, item };
    });
    host.renderRoot.appendChild(bar);
    host.quickActions = bar;
    if (host._hass) updateQuickActions(host, host._hass);
}

/** Light up chips whose entity is on. */
export function updateQuickActions(host, hass) {
    if (!host._quickEls || !hass || !hass.states) return;
    host._quickEls.forEach(({ chip, item }) => {
        const st = item.entity ? hass.states[item.entity] : null;
        chip.classList.toggle('dm-on', !!st && ['on', 'playing', 'open', 'unlocked', 'cleaning', 'heat', 'cool'].includes(st.state));
        chip.classList.toggle('dm-unavailable', !!item.entity && (!st || st.state === 'unavailable'));
    });
}
