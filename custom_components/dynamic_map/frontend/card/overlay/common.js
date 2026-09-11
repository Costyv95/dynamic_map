/**
 * Helpers shared by the overlay builders: pointer-relative placement,
 * the visual-menu absolute positioning, and icon markup.
 */

/**
 * Clamp the overlay near the pointer while keeping it inside the
 * renderRoot bounds, then apply left/top/transform. `defaultW`/`defaultH`
 * are fallbacks used when the overlay has no measurable size yet.
 */
export function clampAndPositionOverlay(overlayEl, rect, posX, posY, defaultW = 0, defaultH = 0) {
    const w = overlayEl.offsetWidth || defaultW;
    const h = overlayEl.offsetHeight || defaultH;
    let finalX = posX;
    let finalY = posY - 20; // 20px above cursor
    let transX = -50;
    let transY = -100;
    if (posX - w / 2 < 10) {
        transX = 0;
        finalX = 10;
    } else if (posX + w / 2 > rect.width - 10) {
        transX = -100;
        finalX = rect.width - 10;
    }
    if (posY - h - 20 < 10) {
        transY = 0;
        finalY = posY + 20; // Place below cursor
        if (finalY + h > rect.height - 10) finalY = rect.height - h - 10;
    } else if (posY - 20 > rect.height - 10) {
        finalY = rect.height - 10;
    }
    overlayEl.style.left = `${finalX}px`;
    overlayEl.style.top = `${finalY}px`;
    overlayEl.style.transform = `translate(${transX}%, ${transY}%)`;
}

/** In a visual (designed) menu, place an item at its saved box. */
export function placeVisual(el, act, isVisual, { height = true } = {}) {
    if (!isVisual || act.pos_x === undefined) return false;
    el.style.position = 'absolute';
    el.style.left = act.pos_x + 'px';
    el.style.top = act.pos_y + 'px';
    el.style.width = act.width + 'px';
    if (height && act.height) el.style.height = act.height + 'px';
    el.style.margin = '0';
    if (act.rotation) el.style.transform = `rotate(${act.rotation}deg)`;
    return true;
}

/** <ha-icon> for mdi ids, a span for emoji, '' when no icon. */
export function iconHtml(icon, size = 18, extraStyle = '') {
    if (!icon) return '';
    if (icon.includes(':')) {
        return `<ha-icon icon="${icon}" style="--mdc-icon-size: ${size}px; ${extraStyle}"></ha-icon>`;
    }
    return `<span style="${extraStyle}">${icon}</span>`;
}

/** Report a callService failure to the user. */
export function onServiceError(err) {
    console.error('[DynamicMap] callService Error:', err);
    alert('HA Error: ' + (err.message || JSON.stringify(err)));
}
