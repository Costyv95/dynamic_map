import { drawFurniture } from '../../shared/Furniture.js?v=3.2.1';

/** A parametric furniture / door / window drawing (shared/Furniture.js). */
export function renderFurniture(svgNS, props) {
    return drawFurniture(svgNS, {
        kind: props.kind, width: props.width, height: props.height,
        colors: props.colors, opts: props.opts, x: props.x, y: props.y
    });
}
