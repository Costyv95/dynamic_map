/**
 * Keyboard helpers. Inside the HA custom panel the editor lives in a shadow
 * root, so a document-level listener sees the panel host as `e.target`;
 * the real element is the first entry of the composed path.
 */

/** The element that actually received the key event. */
export function realTarget(e) {
    if (e && typeof e.composedPath === 'function') {
        const path = e.composedPath();
        if (path && path.length) return path[0];
    }
    return e ? e.target : null;
}

/** True while a text field, select or editable element has the focus. */
export function isTyping(e) {
    let t = realTarget(e);
    // Fall back to the deep active element (older browsers without composedPath).
    if (!t || t === document || t === document.body || (t.tagName && t.tagName.includes('-'))) t = deepActiveElement();
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable;
}

export function deepActiveElement(root = document) {
    let el = root.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
}
