/**
 * Day/night ambient tint: a multiply overlay shaped to the rooms and driven
 * by sun.sun's elevation - clear at day, warm around sunset, cool blue-grey
 * at night. Disable with `ambient_tint: false`. `host` is the scene host.
 */

const WARM = [255, 158, 87];
const NIGHT = [95, 116, 160];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;

/** Tint colour and opacity for a sun elevation (degrees). */
export function tintFor(elev) {
    if (!Number.isFinite(elev)) return { color: mix(WARM, WARM, 0), opacity: 0 };
    if (elev >= 10) return { color: mix(WARM, WARM, 0), opacity: 0 };
    if (elev >= -4) {
        // golden hour: warm tint fading in as the sun drops from 10 to -4
        return { color: mix(WARM, WARM, 0), opacity: lerp(0, 0.18, (10 - elev) / 14) };
    }
    if (elev >= -10) {
        // dusk: warm shifts to a cool night tone
        const t = (-4 - elev) / 6;
        return { color: mix(WARM, NIGHT, t), opacity: lerp(0.18, 0.3, t) };
    }
    return { color: mix(NIGHT, NIGHT, 0), opacity: 0.3 };
}

export function buildAmbientTint(host) {
    host.ambientTint = null;
    if (host.config && host.config.ambient_tint === false) return;
    const svgNS = host.svgNS;
    let el;
    if (host.rooms && host.rooms.length) {
        // Shape the tint to the house (the rooms), never the full canvas. A
        // fattened plate covers the walls just outside the polygons; group
        // opacity flattens overlaps so multiply doesn't double-darken seams.
        el = document.createElementNS(svgNS, 'g');
        const pad = Math.max(host.imgW, host.imgH) * 0.02;
        host.rooms.forEach(room => {
            const poly = document.createElementNS(svgNS, 'polygon');
            poly.setAttribute('points', room.polygon.map(pt =>
                `${(pt[0] / 100) * host.imgW},${(pt[1] / 100) * host.imgH}`).join(' '));
            poly.setAttribute('stroke-width', (pad * 2).toString());
            poly.setAttribute('stroke-linejoin', 'round');
            el.appendChild(poly);   // fill + stroke inherit from the group
        });
    } else {
        el = document.createElementNS(svgNS, 'rect');
        el.setAttribute('width', host.imgW.toString());
        el.setAttribute('height', host.imgH.toString());
    }
    el.classList.add('dm-ambient-tint');
    el.setAttribute('opacity', '0');
    el.style.pointerEvents = 'none';
    el.style.mixBlendMode = 'multiply';
    host.ambientTint = el;
    host.mapRoot.appendChild(el);
}

export function updateAmbientTint(host, hass) {
    if (!host.ambientTint || !hass || !hass.states) return;
    const sun = hass.states['sun.sun'];
    const elev = sun && sun.attributes ? Number(sun.attributes.elevation) : NaN;
    if (!Number.isFinite(elev)) {
        host.ambientTint.setAttribute('opacity', '0');
        return;
    }
    const { color, opacity } = tintFor(elev);
    host.ambientTint.setAttribute('fill', color);
    host.ambientTint.setAttribute('stroke', color);
    host.ambientTint.setAttribute('opacity', opacity.toFixed(3));
}
