/**
 * TemplateEvaluator.js
 * High-performance client-side dynamic JS template evaluation engine.
 * Safely parses and evaluates expressions wrapped in {...} blocks.
 */
export function evaluateTemplate(templateStr, hass) {
    if (!templateStr || typeof templateStr !== 'string') return templateStr || '';
    if (!templateStr.includes('{') || !templateStr.includes('}')) return templateStr;
    
    return templateStr.replace(/\{([^}]+)\}/g, (match, expression) => {
        try {
            // Decoupled states resolver helper
            const states = (entityId, defaultVal = '21') => {
                if (hass && hass.states && hass.states[entityId]) {
                    const st = hass.states[entityId].state;
                    if (st !== 'unavailable' && st !== 'unknown') return st;
                }
                return defaultVal;
            };
            
            // Decoupled attributes resolver helper
            const state_attr = (entityId, attr, defaultVal = null) => {
                if (hass && hass.states && hass.states[entityId] && hass.states[entityId].attributes) {
                    const val = hass.states[entityId].attributes[attr];
                    if (val !== undefined) return val;
                }
                return defaultVal;
            };

            // High utility float/numeric getter helper
            const get_value = (entityId, defaultVal = 0) => {
                const val = parseFloat(states(entityId, defaultVal));
                return isNaN(val) ? defaultVal : val;
            };

            // Compile sandbox Function to execute the expression safely with helper variables
            const fn = new Function('states', 'state_attr', 'get_value', `return (${expression});`);
            const res = fn(states, state_attr, get_value);
            return (res !== undefined && res !== null) ? String(res) : '';
        } catch (e) {
            console.warn(`[DynamicMap] Template evaluation failed for: "${expression}":`, e);
            return '';
        }
    });
}
