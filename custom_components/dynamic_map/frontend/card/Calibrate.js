const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Calibrate positions (#1354): 📍 next to the floor chips, for admins only.
 * Pick the phone you carry, stand still, tap where you are: the backend
 * records ~20 s of every Bluetooth proxy's reading there
 * (dynamic_map.record_fingerprint) and from then on places that phone inside
 * the room by comparing live readings with the recorded spots.
 *
 * Recorded spots show as small rings on the floor; tap one to delete it.
 * While calibrating, taps never reach rooms or devices.
 */

const SECONDS = 20;

export function buildCalibrate(host) {
    const hass = host._hass;
    if (!host.topLeftUI || !hass || !hass.user || !hass.user.is_admin || !hass.callWS) return;
    if (host.config && host.config.calibrate === false) return;
    const btn = document.createElement('button');
    btn.className = 'dm-icon-btn dm-calib-btn' + (host._calib ? ' active' : '');
    btn.title = 'Calibrate positions';
    btn.textContent = '📍';
    btn.addEventListener('click', (e) => { e.stopPropagation(); host._calib ? stopCalibrate(host) : startCalibrate(host); });
    host.topLeftUI.appendChild(btn);
    // A floor switch rebuilds the card; carry on calibrating on the new floor.
    if (host._calib) mount(host);
}

export async function startCalibrate(host) {
    host._calib = { tracker: null, trackers: [], fingerprints: [], busy: false, message: '' };
    const btn = host.renderRoot && host.renderRoot.querySelector('.dm-calib-btn');
    if (btn) btn.classList.add('active');
    mount(host);
    await refresh(host);
}

export function stopCalibrate(host) {
    unmount(host);
    host._calib = null;
    const btn = host.renderRoot && host.renderRoot.querySelector('.dm-calib-btn');
    if (btn) btn.classList.remove('active');
}

async function refresh(host) {
    const c = host._calib;
    if (!c) return;
    try {
        const data = await host._hass.callApi('GET', 'dynamic_map/fingerprints');
        c.trackers = (data.trackers || []).filter(t => t.entity_id);
        c.fingerprints = data.fingerprints || [];
        if (!c.tracker || !c.trackers.some(t => t.entity_id === c.tracker)) c.tracker = c.trackers[0] ? c.trackers[0].entity_id : null;
        if (!c.trackers.length) c.message = 'No phone is tracked by Bermuda yet.';
    } catch (err) {
        c.message = `Could not load calibration: ${err && err.message ? err.message : err}`;
    }
    render(host);
}

function mount(host) {
    unmount(host);
    const c = host._calib;
    const panel = document.createElement('div');
    panel.className = 'dm-calib';
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    panel.addEventListener('click', e => e.stopPropagation());
    host.renderRoot.appendChild(panel);
    c.panel = panel;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.classList.add('dm-calib-layer');
    host.mapRoot.appendChild(layer);
    c.layer = layer;

    // Capture phase: a tap while calibrating marks a spot, it never opens a room or a device.
    c.onTap = (e) => {
        if (!host._calib) return;
        e.stopPropagation();
        e.preventDefault();
        if (e.type !== 'click') return;
        const ring = e.target && e.target.closest && e.target.closest('.dm-calib-spot');
        if (ring) { remove(host, ring.dataset.id); return; }
        const p = toMapPercent(host, e.clientX, e.clientY);
        if (p) record(host, p);
    };
    for (const t of ['pointerdown', 'pointerup', 'click']) host.svg.addEventListener(t, c.onTap, true);
    render(host);
}

function unmount(host) {
    const c = host._calib;
    if (!c) return;
    if (c.panel) c.panel.remove();
    if (c.layer) c.layer.remove();
    if (c.onTap && host.svg) for (const t of ['pointerdown', 'pointerup', 'click']) host.svg.removeEventListener(t, c.onTap, true);
    c.panel = c.layer = c.onTap = null;
}

/** Screen point → map percent of the floor, or null off the floor. */
export function toMapPercent(host, clientX, clientY) {
    const ctm = host.mapRoot && host.mapRoot.getScreenCTM && host.mapRoot.getScreenCTM();
    if (!ctm || !host.imgW || !host.imgH) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const x = (pt.x / host.imgW) * 100, y = (pt.y / host.imgH) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

async function record(host, p) {
    const c = host._calib;
    if (!c || c.busy) return;
    if (!c.tracker) { c.message = 'Pick the phone you are carrying first.'; render(host); return; }
    c.busy = true;
    c.pending = { x: p.x, y: p.y };
    let left = SECONDS;
    c.message = `Stand still… ${left} s`;
    render(host);
    const tick = setInterval(() => { left = Math.max(0, left - 1); if (host._calib) { c.message = `Stand still… ${left} s`; render(host); } }, 1000);
    try {
        const res = await host._hass.callWS({
            type: 'call_service', domain: 'dynamic_map', service: 'record_fingerprint',
            service_data: { entity_id: c.tracker, floor: Number(host.activeFloor), x: p.x, y: p.y, seconds: SECONDS },
            return_response: true
        });
        const r = (res && res.response) || {};
        c.message = `Saved in ${r.room || 'the room'}: ${r.proxies || 0} proxies heard the phone. Tap the next spot.`;
    } catch (err) {
        c.message = `Not saved: ${err && err.message ? err.message : err}`;
    } finally {
        clearInterval(tick);
        c.busy = false;
        c.pending = null;
    }
    await refresh(host);
}

async function remove(host, id) {
    const c = host._calib;
    if (!c || c.busy || !id) return;
    if (c.confirmDelete !== id) { c.confirmDelete = id; c.message = 'Tap the ring again to delete that spot.'; render(host); return; }
    c.confirmDelete = null;
    try {
        await host._hass.callWS({ type: 'call_service', domain: 'dynamic_map', service: 'delete_fingerprint', service_data: { id }, return_response: true });
        c.message = 'Spot deleted.';
    } catch (err) {
        c.message = `Not deleted: ${err && err.message ? err.message : err}`;
    }
    await refresh(host);
}

function render(host) {
    const c = host._calib;
    if (!c || !c.panel) return;
    const here = c.fingerprints.filter(f => String(f.floor) === String(host.activeFloor));
    c.panel.replaceChildren();
    const title = document.createElement('div');
    title.className = 'dm-calib-title';
    title.textContent = `Calibrate positions · ${here.length} spot${here.length === 1 ? '' : 's'} on this floor`;
    const row = document.createElement('div');
    row.className = 'dm-calib-row';
    const pick = document.createElement('select');
    pick.disabled = c.busy;
    for (const t of c.trackers) {
        const o = document.createElement('option');
        o.value = t.entity_id;
        o.textContent = `${t.name} (${t.proxies} proxies)`;
        o.selected = t.entity_id === c.tracker;
        pick.appendChild(o);
    }
    pick.addEventListener('change', () => { c.tracker = pick.value; });
    const done = document.createElement('button');
    done.className = 'dm-calib-done';
    done.textContent = 'Done';
    done.addEventListener('click', () => stopCalibrate(host));
    row.append(pick, done);
    const msg = document.createElement('div');
    msg.className = 'dm-calib-msg';
    msg.textContent = c.message || 'Carry the phone, stand still, and tap where you are on the map.';
    c.panel.append(title, row, msg);
    drawSpots(host, here);
}

function drawSpots(host, spots) {
    const c = host._calib;
    if (!c || !c.layer) return;
    c.layer.replaceChildren();
    const r = host.imgW * 0.012;
    const ring = (x, y, cls, id) => {
        const el = document.createElementNS(SVG_NS, 'circle');
        el.setAttribute('cx', ((x / 100) * host.imgW).toFixed(1));
        el.setAttribute('cy', ((y / 100) * host.imgH).toFixed(1));
        el.setAttribute('r', r.toFixed(1));
        el.setAttribute('class', cls);
        if (id) el.dataset.id = id;
        c.layer.appendChild(el);
    };
    for (const s of spots) ring(s.x, s.y, 'dm-calib-spot' + (c.confirmDelete === s.id ? ' doomed' : ''), s.id);
    if (c.pending) ring(c.pending.x, c.pending.y, 'dm-calib-pending');
}
