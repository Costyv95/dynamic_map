/**
 * Evaluates a leaf-level comparison rule.
 */
function evaluateLeafRule(rule, hass) {
    if (!hass || !hass.states) return false;
    const stateEntity = rule.state_entity || rule.entity;
    if (!stateEntity) return false;
    
    const stateObj = hass.states[stateEntity];
    if (!stateObj) return false;
    
    const actualVal = stateObj.state;
    const targetVal = rule.value;
    const actualNum = parseFloat(actualVal);
    const isActualNumeric = !isNaN(actualNum);
    
    const op = rule.operator || '==';
    
    switch (op) {
        case '==':
            return String(actualVal) === String(targetVal);
        case '!=':
            return String(actualVal) !== String(targetVal);
        case '<':
            return isActualNumeric && actualNum < parseFloat(targetVal);
        case '<=':
            return isActualNumeric && actualNum <= parseFloat(targetVal);
        case '>':
            return isActualNumeric && actualNum > parseFloat(targetVal);
        case '>=':
            return isActualNumeric && actualNum >= parseFloat(targetVal);
        case 'between':
            if (!isActualNumeric) return false;
            const parts = String(targetVal).split('-');
            if (parts.length === 2) {
                const min = parseFloat(parts[0]);
                const max = parseFloat(parts[1]);
                return !isNaN(min) && !isNaN(max) && actualNum >= min && actualNum <= max;
            }
            return false;
        default:
            return false;
    }
}

/**
 * Recursively evaluates an AND or OR logical rules group.
 */
export function evaluateCondition(cond, hass) {
    if (!cond) return true; // Empty condition evaluates to true
    
    // Backwards Compatibility: If cond is an array, treat it as an implicit AND group
    if (Array.isArray(cond)) {
        return cond.every(rule => evaluateLeafRule(rule, hass));
    }
    
    // If cond is a single leaf rule object directly
    if (cond.state_entity || cond.entity) {
        return evaluateLeafRule(cond, hass);
    }
    
    const type = cond.type || 'AND';
    const rules = cond.rules || [];
    
    if (rules.length === 0) return true;
    
    if (type === 'AND') {
        return rules.every(rule => {
            if (rule.rules) {
                return evaluateCondition(rule, hass); // Recursive subgroup call
            }
            return evaluateLeafRule(rule, hass);
        });
    } else if (type === 'OR') {
        return rules.some(rule => {
            if (rule.rules) {
                return evaluateCondition(rule, hass); // Recursive subgroup call
            }
            return evaluateLeafRule(rule, hass);
        });
    }
    
    return false;
}
