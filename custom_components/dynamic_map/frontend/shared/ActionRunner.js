/**
 * Shared executor for a shortcut's configured Home Assistant actions.
 *
 * Used by both action call sites, which must stay in sync:
 *  - card/OverlayManager.js  (long-press action menu buttons / toggle switch)
 *  - shortcuts/MapShortcut.js onClick (tap-triggered actions)
 *
 * Handled action types:
 *  - TOGGLE      -> <domain>.toggle (except media_player, which uses a
 *                   state-aware turn_on/turn_off because it has no toggle)
 *  - TOGGLE_ON   -> <domain>.turn_on  (vacuum remapped to vacuum.start)
 *  - TOGGLE_OFF  -> <domain>.turn_off (vacuum remapped to vacuum.return_to_base)
 *  - CALL_SERVICE-> arbitrary "domain.service" with optional JSON payload
 *
 * Known divergences between the two call sites (kept reachable via options,
 * do not silently merge):
 *  - Room-name -> segment-ID replacement in CALL_SERVICE payloads only happens
 *    in the OverlayManager menu (it has access to mapContext.shortcutElements
 *    and mapContext.rooms). MapShortcut.onClick does NOT perform replacement;
 *    it simply omits `nameToSegmentId`.
 *  - Error reporting: OverlayManager attaches a `.catch` that console.errors
 *    and alert()s on CALL_SERVICE failure; MapShortcut.onClick attaches no
 *    handler. Controlled via `onServiceError`.
 */

/**
 * Build the "Room Name" -> segment/robo ID dictionary for a vacuum target.
 * Mirrors the mapping logic used by the OverlayManager action menu: finds the
 * shortcut whose entity_id matches `targetEntityId`, then maps each configured
 * room_mapping entry's room name to its segment_mapping override (if any) or
 * to the (numeric when possible) robo ID.
 *
 * @param {string} targetEntityId entity the action targets (e.g. vacuum.robo)
 * @param {Object} shortcutElements map of shortcut elements ({ id: { sc } })
 * @param {Array}  rooms room definitions ([{ id, name, ... }])
 * @returns {Object} name -> segment ID map (possibly empty)
 */
export function buildRoomNameToSegmentMap(targetEntityId, shortcutElements, rooms) {
    const nameToRoboId = {};
    let scConfig = null;
    Object.values(shortcutElements || {}).forEach(scEl => {
        if (scEl.sc && scEl.sc.entity_id === targetEntityId) scConfig = scEl.sc.config;
    });
    if (scConfig && scConfig.room_mapping && rooms) {
        for (const [roboId, svgRoomId] of Object.entries(scConfig.room_mapping)) {
            const roomDef = rooms.find(r => r.id === svgRoomId);
            if (roomDef && roomDef.name) {
                if (scConfig.segment_mapping && scConfig.segment_mapping[roboId] !== undefined) {
                    nameToRoboId[roomDef.name] = scConfig.segment_mapping[roboId];
                } else {
                    nameToRoboId[roomDef.name] = isNaN(roboId) ? roboId : parseInt(roboId);
                }
            }
        }
    }
    return nameToRoboId;
}

/**
 * Recursively replace room-name strings with their mapped segment IDs inside
 * a parsed payload (arrays and nested objects). Mutates `obj` in place; only
 * string values that exactly match a mapping key are replaced.
 */
export function replaceRoomNamesWithIds(obj, nameToSegmentId) {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string' && nameToSegmentId[obj[i]] !== undefined) obj[i] = nameToSegmentId[obj[i]];
            else if (typeof obj[i] === 'object' && obj[i] !== null) replaceRoomNamesWithIds(obj[i], nameToSegmentId);
        }
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (typeof obj[key] === 'string' && nameToSegmentId[obj[key]] !== undefined) obj[key] = nameToSegmentId[obj[key]];
            else if (typeof obj[key] === 'object' && obj[key] !== null) replaceRoomNamesWithIds(obj[key], nameToSegmentId);
        }
    }
}

/**
 * Prepare the service-call payload for a CALL_SERVICE action.
 * entity_id defaulting: an explicit action_entity always wins; otherwise the
 * target is used only when the action has no JSON payload (a payload may
 * define its own entity_id and merging must not force one in).
 * On JSON parse failure the error is logged and the base payload is returned
 * (matches both original call sites).
 *
 * @param {Object} action the configured action ({ type, service, payload, action_entity })
 * @param {string|undefined} target resolved target entity (action_entity || shortcut entity)
 * @param {Object|null} nameToSegmentId optional room-name -> segment map to apply to the payload
 */
export function prepareServicePayload(action, target, nameToSegmentId = null) {
    let payload = {};
    if (action.action_entity) {
        payload.entity_id = action.action_entity;
    } else if (!action.payload && target) {
        payload.entity_id = target;
    }
    if (action.payload) {
        try {
            const parsed = JSON.parse(action.payload);
            if (nameToSegmentId && Object.keys(nameToSegmentId).length > 0) {
                replaceRoomNamesWithIds(parsed, nameToSegmentId);
            }
            payload = { ...payload, ...parsed };
        } catch (e) {
            console.error("[DynamicMap] Failed to parse action payload:", e);
        }
    }
    return payload;
}

/**
 * Execute one configured action against Home Assistant.
 *
 * @param {Object} hass Home Assistant object (must expose callService)
 * @param {Object} action configured action ({ type, service, payload, action_entity })
 * @param {string|undefined} target resolved target entity (action_entity || shortcut entity)
 * @param {Object} [options]
 * @param {Object|null} [options.nameToSegmentId] room-name -> segment ID map applied to
 *        CALL_SERVICE payloads (OverlayManager only; MapShortcut omits it).
 * @param {Function} [options.onServiceError] rejection handler attached to the
 *        CALL_SERVICE promise (OverlayManager only; MapShortcut omits it).
 * @returns {Promise|undefined} the callService result when a call was made
 */
export function executeAction(hass, action, target, options = {}) {
    if (!hass) return;
    if (!target && action.type !== 'CALL_SERVICE') return;

    if (action.type === 'CALL_SERVICE' && action.service) {
        const parts = action.service.split('.');
        if (parts.length !== 2) return;
        const payload = prepareServicePayload(action, target, options.nameToSegmentId || null);
        const result = hass.callService(parts[0], parts[1], payload);
        if (options.onServiceError && result && typeof result.catch === 'function') {
            result.catch(options.onServiceError);
        }
        return result;
    } else if (action.type && action.type.startsWith('TOGGLE')) {
        const domain = target.split('.')[0];
        let service = action.type === 'TOGGLE_ON' ? 'turn_on' : (action.type === 'TOGGLE_OFF' ? 'turn_off' : 'toggle');

        // media_player exposes turn_on/turn_off, but not a generic toggle
        // service. Treat an unavailable/unknown state as off so a tap still
        // attempts to wake the device rather than issuing an invalid service.
        if (domain === 'media_player' && service === 'toggle') {
            const state = hass.states && hass.states[target] && hass.states[target].state;
            service = state && state !== 'off' && state !== 'unavailable' && state !== 'unknown'
                ? 'turn_off'
                : 'turn_on';
        }

        if (domain === 'vacuum') {
            if (service === 'turn_on') service = 'start';
            else if (service === 'turn_off') service = 'return_to_base';
            // vacuum.toggle is valid in modern HA; no remap needed
        }

        return hass.callService(domain, service, { entity_id: target });
    }
}
