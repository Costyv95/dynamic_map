/**
 * Live-activity effects on a badge: a tiny animated equaliser while a
 * media player is playing, and trailing dust puffs while a vacuum is
 * cleaning. Functions take the MapShortcut instance as `host`.
 */

/** Current badge width/height in map units (mirrors the glow geometry). */
export function badgeSize(host) {
    let baseW = 24, baseH = 24;
    if (host.shape && host.shape.tagName === 'rect') {
        baseW = parseFloat(host.shape.getAttribute('width')) || 24;
        baseH = parseFloat(host.shape.getAttribute('height')) || 24;
    } else if (host.shape) {
        const r = parseFloat(host.shape.getAttribute('r')) || 12;
        baseW = baseH = r * 2;
    }
    return [baseW, baseH];
}

export function updateActivityFx(host, hass) {
    const tgt = host.sc.entity_id || host.config.state_entity;
    const stObj = tgt && hass && hass.states ? hass.states[tgt] : null;
    const state = stObj ? stObj.state : null;
    const domain = (tgt || '').split('.')[0];
    setEqualizer(host, (host.sc.type === 'media' || domain === 'media_player') && state === 'playing');
    setDust(host, host.sc.type === 'vacuum' && state === 'cleaning');
}

function setEqualizer(host, on) {
    host._eqVisible = !!on;
    if (!on) {
        if (host.eqGroup) host.eqGroup.style.display = 'none';
        return;
    }
    const svgNS = host.svgNS;
    if (!host.eqGroup) {
        host.eqGroup = document.createElementNS(svgNS, 'g');
        host.eqGroup.classList.add('dm-eq');
        host.eqGroup.style.pointerEvents = 'none';
        host.eqPill = document.createElementNS(svgNS, 'rect');
        host.eqPill.setAttribute('fill', 'rgba(15, 23, 42, 0.55)');
        host.eqGroup.appendChild(host.eqPill);
        host.eqBars = [0, 1, 2].map(() => {
            const bar = document.createElementNS(svgNS, 'rect');
            bar.setAttribute('fill', '#ffffff');
            host.eqGroup.appendChild(bar);
            return bar;
        });
        host.group.appendChild(host.eqGroup);
    }
    const [bw, bh] = badgeSize(host);
    const s = Math.max(bw, 18) / 24;
    host._eqScale = s;
    host.eqGroup.setAttribute('transform', `translate(${(bw / 2).toFixed(1)}, ${(-bh / 2).toFixed(1)})`);
    host.eqPill.setAttribute('x', -8 * s);
    host.eqPill.setAttribute('y', -8 * s);
    host.eqPill.setAttribute('width', 16 * s);
    host.eqPill.setAttribute('height', 13 * s);
    host.eqPill.setAttribute('rx', 4 * s);
    host.eqBars.forEach((bar, i) => {
        bar.setAttribute('x', (-5.4 + i * 4) * s);
        bar.setAttribute('width', 2.6 * s);
        bar.setAttribute('rx', 1.2 * s);
        bar.setAttribute('y', -3 * s);
        bar.setAttribute('height', 6 * s);
    });
    host.eqGroup.style.display = 'block';
}

function setDust(host, on) {
    host._dustActive = !!on;
    if (!on) {
        if (host.dustGroup) host.dustGroup.style.display = 'none';
        return;
    }
    if (!host.dustGroup) {
        host.dustGroup = document.createElementNS(host.svgNS, 'g');
        host.dustGroup.classList.add('dm-dust');
        host.dustGroup.style.pointerEvents = 'none';
        host.dustPuffs = [0, 1, 2].map(() => {
            const c = document.createElementNS(host.svgNS, 'circle');
            c.setAttribute('fill', '#94a3b8');
            host.dustGroup.appendChild(c);
            return c;
        });
        host.group.insertBefore(host.dustGroup, host.group.firstChild);
    }
    host._dustScale = Math.max(badgeSize(host)[0], 18) / 24;
    host.dustGroup.style.display = 'block';
}

/** Per-frame step for the equaliser bars and dust puffs. */
export function animateFx(host, t) {
    if (host._eqVisible && host.eqBars) {
        const s = host._eqScale || 1;
        host.eqBars.forEach((bar, i) => {
            const h = (3 + 6 * Math.abs(Math.sin(t * (2.1 + i * 0.7) + i * 1.3))) * s;
            bar.setAttribute('height', h.toFixed(2));
            bar.setAttribute('y', (3 * s - h).toFixed(2));
        });
    }
    if (host._dustActive && host.dustPuffs) {
        const s = host._dustScale || 1;
        host.dustPuffs.forEach((c, i) => {
            const p = ((t * 0.45) + i / 3) % 1;
            c.setAttribute('cx', (-(8 + p * 18) * s).toFixed(1));
            c.setAttribute('cy', (Math.sin((t + i * 2.1) * 1.7) * 4 * s).toFixed(1));
            c.setAttribute('r', ((2 + p * 3.5) * s).toFixed(1));
            c.setAttribute('opacity', ((1 - p) * 0.45).toFixed(2));
        });
    }
}
