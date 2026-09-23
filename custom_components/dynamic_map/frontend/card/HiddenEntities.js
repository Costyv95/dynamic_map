/**
 * Hides map objects and quick-action chips whose entity HA Tools puts out of
 * position (its "Dial: Position" labels, such as "Cooling: On"). HA Tools
 * decides; the card only listens:
 *
 *   ha_tools/hidden/subscribe  ->  { hidden: ['climate.bedroom_ac', ...] }
 *
 * The first message comes at once, then one per change. Without HA Tools the
 * command is unknown, the subscription fails quietly and nothing is hidden.
 * Only the card hides: the editor always shows every object.
 */

export const HIDDEN_SUBSCRIBE = { type: 'ha_tools/hidden/subscribe' };

/** Subscribe once per connection; `set hass` calls this on every tick. */
export function watchHidden(host, hass) {
    const conn = hass && hass.connection;
    if (host._hiddenWatch || !conn || typeof conn.subscribeMessage !== 'function') return;
    host._hiddenWatch = Promise.resolve()
        .then(() => conn.subscribeMessage((msg) => {
            host.hiddenEntities = new Set((msg && msg.hidden) || []);
            applyHidden(host);
        }, HIDDEN_SUBSCRIBE))
        .catch(() => null);
}

/** Drop the subscription; the next `set hass` subscribes again. */
export function unwatchHidden(host) {
    const watch = host._hiddenWatch;
    host._hiddenWatch = null;
    if (watch) watch.then((unsub) => { if (typeof unsub === 'function') unsub(); }).catch(() => {});
}

export function isHidden(host, entityId) {
    return !!entityId && !!host.hiddenEntities && host.hiddenEntities.has(entityId);
}

/** The entity a shortcut stands for: its own, else the one its config follows. */
export function shortcutEntity(obj) {
    const cfg = (obj && obj.config) || {};
    return (obj && obj.sc && obj.sc.entity_id) || cfg.entity || cfg.state_entity || null;
}

/** Show or hide one shortcut, with its glow (the glow lives outside the badge). */
export function setShortcutHidden(obj, hidden) {
    if (!obj || !obj.group || obj._dialHidden === hidden) return;
    obj._dialHidden = hidden;
    obj.group.style.display = hidden ? 'none' : '';
    // visibility, not display: the glow toggles its own display as the light changes.
    if (obj.glowGroup) obj.glowGroup.style.visibility = hidden ? 'hidden' : '';
}

/** Apply the hidden set to every shortcut and entity chip of the card. */
export function applyHidden(host) {
    const shortcuts = host.shortcutElements || {};
    for (const id in shortcuts) setShortcutHidden(shortcuts[id], isHidden(host, shortcutEntity(shortcuts[id])));
    (host._quickEls || []).forEach(({ chip, item }) => {
        if (!item.builtin) chip.hidden = isHidden(host, item.entity);
    });
}
