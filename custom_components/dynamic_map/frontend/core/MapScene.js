import { ShortcutFactory } from '../shortcuts/ShortcutFactory.js?v=3.2.1';
import { MapGeometry } from '../shared/MapGeometry.js?v=3.2.1';
import { labelTransform } from './Viewport.js?v=3.2.1';
import { WALL_DEFAULT_THICKNESS, WALL_DEFAULT_COLOR } from '../shared/WallGeometry.js?v=3.2.1';

/**
 * The one SVG scene for a floor, built into a "scene host": an object (the
 * card element, or the editor's host) carrying `svgNS`, `mapRoot`,
 * `rooms`, `walls`, `shortcuts`, `imgW`, `imgH`, `floorBgMode`,
 * `floorBgColor` and `_hass`. Shortcuts also read `activeMode`,
 * `isRotated`, `showOverlay`, `interactive` and `skipUnchanged` from it.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

function polygonPoints(host, polygon) {
    return polygon.map(pt => `${(pt[0] / 100) * host.imgW},${(pt[1] / 100) * host.imgH}`).join(' ');
}

/** Background image with optional colour underlay, or the 'fit' plate. */
export function buildBackground(host, bgUrl) {
    const svgNS = host.svgNS;
    if (host.floorBgMode === 'fit') {
        host.mapRoot.appendChild(buildRoomPlate(host));
        return;
    }
    if (host.floorBgColor) {
        // Underlay in the floor colour: shows around the plan and through
        // any transparent parts of the background image.
        const underlay = document.createElementNS(svgNS, 'rect');
        underlay.setAttribute('width', host.imgW.toString());
        underlay.setAttribute('height', host.imgH.toString());
        underlay.setAttribute('fill', host.floorBgColor);
        host.mapRoot.appendChild(underlay);
    }
    const image = document.createElementNS(svgNS, 'image');
    image.setAttribute('href', bgUrl);
    image.setAttribute('width', host.imgW.toString());
    image.setAttribute('height', host.imgH.toString());
    image.setAttribute('preserveAspectRatio', 'none');
    image.classList.add('dm-bg-image');
    host.mapRoot.appendChild(image);
}

/**
 * Background plate for 'fit' mode: the room polygons in the floor colour
 * with a fat round-joined stroke, so adjacent rooms merge into one padded,
 * rounded silhouette of the layout.
 */
export function buildRoomPlate(host) {
    const plate = document.createElementNS(host.svgNS, 'g');
    plate.classList.add('dm-room-plate');
    const color = host.floorBgColor || '#1e293b';
    const pad = Math.max(host.imgW, host.imgH) * 0.035;
    host.rooms.forEach(room => {
        const poly = document.createElementNS(host.svgNS, 'polygon');
        poly.setAttribute('points', polygonPoints(host, room.polygon));
        poly.setAttribute('fill', color);
        poly.setAttribute('stroke', color);
        poly.setAttribute('stroke-width', (pad * 2).toString());
        poly.setAttribute('stroke-linejoin', 'round');
        poly.setAttribute('pointer-events', 'none');
        plate.appendChild(poly);
    });
    return plate;
}

export function roomLabelCenter(host, room) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    room.polygon.forEach(pt => {
        const px = (pt[0] / 100) * host.imgW;
        const py = (pt[1] / 100) * host.imgH;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    });
    return { cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2 };
}

/** Room polygons (with data-room-id) and their upright labels. */
export function buildRooms(host, onRoomTap) {
    const svgNS = host.svgNS;
    host.rooms.forEach(room => {
        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', polygonPoints(host, room.polygon));
        polygon.setAttribute('stroke-width', (host.imgW * 0.002).toString());
        polygon.classList.add('room-polygon');
        polygon.dataset.roomId = room.id;
        if (onRoomTap) {
            polygon.addEventListener('click', (e) => {
                e.stopPropagation();
                onRoomTap(room);
            });
        }
        host.mapRoot.appendChild(polygon);
        if (room.name) {
            const { cx, cy } = roomLabelCenter(host, room);
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('font-size', (host.imgW * 0.017).toString());
            text.setAttribute('fill', 'rgba(255, 255, 255, 0.96)');
            text.setAttribute('font-weight', '600');
            text.textContent = room.name;
            text.classList.add('room-label');
            text.dataset.roomId = room.id;
            text.rawCx = cx;   // kept for counter-rotation under a viewport
            text.rawCy = cy;
            host.mapRoot.appendChild(text);
        }
    });
}

/**
 * Walls from config_floorN.json: one stroked path each so corners join
 * cleanly. Above rooms, below decor/shortcuts, never intercept a tap.
 */
export function buildWalls(host) {
    if (!host.walls || !host.walls.length || !host.mapRoot) return;
    const layer = document.createElementNS(host.svgNS, 'g');
    layer.classList.add('dm-walls');
    layer.style.pointerEvents = 'none';
    host.walls.forEach((wall, idx) => {
        const pts = wall.points || [];
        if (pts.length < 2) return;
        const path = document.createElementNS(host.svgNS, 'path');
        const d = pts.map((pt, i) =>
            `${i === 0 ? 'M' : 'L'} ${((pt[0] / 100) * host.imgW).toFixed(1)} ${((pt[1] / 100) * host.imgH).toFixed(1)}`
        ).join(' ');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', wall.color || WALL_DEFAULT_COLOR);
        path.setAttribute('stroke-width', Number(wall.thickness) > 0 ? wall.thickness : WALL_DEFAULT_THICKNESS);
        path.setAttribute('stroke-linecap', 'square');
        path.setAttribute('stroke-linejoin', 'miter');
        path.dataset.wallIdx = String(idx);
        layer.appendChild(path);
    });
    host.mapRoot.appendChild(layer);
    host.wallsLayer = layer;
}

/**
 * Decor sub-layer plus interactive shortcuts. Decor always renders beneath
 * badges regardless of array order. Fills host.shortcutElements.
 */
export function buildShortcuts(host) {
    host.shortcutElements = {};
    host.decorLayer = document.createElementNS(host.svgNS, 'g');
    host.decorLayer.classList.add('dm-decor-layer');
    host.mapRoot.appendChild(host.decorLayer);
    host.shortcuts.forEach(sc => {
        const obj = ShortcutFactory.create(sc, host.svgNS, host.imgW, host.imgH, host);
        host.shortcutElements[sc.id] = obj;
        const parent = (sc.config && sc.config.decor) ? host.decorLayer : host.mapRoot;
        parent.appendChild(obj.render());
        if (host._hass) obj.updateState(host._hass);
    });
}

/** Apply per-shortcut counter-transforms for the current rotation/flip state. */
export function applyShortcutTransforms(host, scaleX, scaleY) {
    if (!host.shortcutElements) return;
    const flipped = scaleX !== 1 || scaleY !== 1;
    Object.values(host.shortcutElements).forEach(obj => {
        const autoRotate = obj.getIsAutoRotateActive && obj.getIsAutoRotateActive();
        let str = '';
        if (flipped) str += `scale(${scaleX}, ${scaleY}) `;
        if (host.isRotated && !autoRotate) str += 'rotate(-90) ';
        if (obj.setTransformStr) obj.setTransformStr(str.trim());
        if (obj.updateCoordinates) obj.updateCoordinates();
    });
}

/** Put the viewport's rotation/flip on the root and keep labels upright. */
export function applyViewport(host, vp) {
    if (vp.transform) host.mapRoot.setAttribute('transform', vp.transform);
    else host.mapRoot.removeAttribute('transform');
    host.mapRoot.querySelectorAll('.room-label').forEach(label => {
        const t = labelTransform(vp, label.rawCx, label.rawCy);
        if (t) label.setAttribute('transform', t);
        else label.removeAttribute('transform');
    });
    applyShortcutTransforms(host, vp.transform ? vp.scaleX : 1, vp.transform ? vp.scaleY : 1);
}

/** Build the whole scene into host.mapRoot (must be empty). */
export function buildScene(host, { bgUrl, onRoomTap }) {
    buildBackground(host, bgUrl);
    buildRooms(host, onRoomTap);
    buildWalls(host);
    buildShortcuts(host);
}

export const sceneGeometry = { isPointInPolygon: MapGeometry.isPointInPolygon };
