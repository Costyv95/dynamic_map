/**
 * TemplateEvaluator.js
 * Client-side template evaluation: each expression wrapped in {...} is parsed by TemplateExpression.js
 * (no eval, so the card runs under a CSP without 'unsafe-eval') and compiled once per text.
 */
import { compileExpression } from './TemplateExpression.js?v=3.2.1';

const compiled = new Map();
const MAX_COMPILED = 500;

function compile(expression) {
    let fn = compiled.get(expression);
    if (!fn) {
        fn = compileExpression(expression);
        if (compiled.size >= MAX_COMPILED) compiled.clear();
        compiled.set(expression, fn);
    }
    return fn;
}

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

            const res = compile(expression)({ states, state_attr, get_value });
            return (res !== undefined && res !== null) ? String(res) : '';
        } catch (e) {
            console.warn(`[DynamicMap] Template evaluation failed for: "${expression}":`, e);
            return '';
        }
    });
}
