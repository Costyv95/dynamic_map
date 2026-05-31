# Stage 2 Guide: Standalone Nested Logical Evaluator

This document details the complete technical specifications and step-by-step implementation for Phase 2: creating the standalone composite **Condition Evaluator** (`ConditionEvaluator.js`) to support infinite nesting of AND/OR logical rules groups.

---

## 🏛️ 1. Technical Design

* **Zero-DOM Scoping**: To ensure testability, the evaluator class has absolutely no UI or DOM dependencies. It reads raw entity status strings from Home Assistant's state machine (`hass.states`) and evaluates them purely mathematically.
* **Composite Query Resolution**: Evaluates condition blocks recursively. A block is either:
  1. A **Leaf Rule**: Compares a single entity's state against a target value using comparison operators (`==`, `!=`, `<`, `<=`, `>`, `>=`, `between`).
  2. A **Logical Group**: An `AND` or `OR` query group containing a list of sub-rules (recursive calls).

---

## 📐 2. Code Implementation (`ConditionEvaluator.js`)

Create the file at `custom_components/dynamic_map/frontend/shortcuts/ConditionEvaluator.js`:

```javascript
/**
 * Evaluates a leaf-level comparison rule.
 */
function evaluateLeafRule(rule, hass) {
    if (!hass || !rule.state_entity) return false;
    
    const stateObj = hass.states[rule.state_entity];
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
```

---

## 🧪 3. Robust Vitest Test Suites

Create a comprehensive testing suite at `custom_components/dynamic_map/frontend/tests/ConditionEvaluator.test.js` to assert the evaluation engine:

```javascript
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../shortcuts/ConditionEvaluator.js';

describe('ConditionEvaluator', () => {
    // Mock Home Assistant State Machine
    const mockHass = {
        states: {
            'sensor.temperature': { state: '26.5' },
            'sensor.diana_phone': { state: 'charging' },
            'sensor.costin_phone': { state: 'not_charging' },
            'light.bedroom_light': { state: 'off' }
        }
    };

    it('should correctly evaluate standard legacy flat condition lists (implied AND)', () => {
        const flatConditions = [
            { state_entity: 'sensor.temperature', operator: '>', value: '25' },
            { state_entity: 'sensor.diana_phone', operator: '==', value: 'charging' }
        ];
        expect(evaluateCondition(flatConditions, mockHass)).toBe(true);
        
        const flatConditionsFail = [
            { state_entity: 'sensor.temperature', operator: '>', value: '25' },
            { state_entity: 'sensor.costin_phone', operator: '==', value: 'charging' }
        ];
        expect(evaluateCondition(flatConditionsFail, mockHass)).toBe(false);
    });

    it('should evaluate complex composite logical AND/OR groups recursively', () => {
        // Condition logic: Temperature > 25 AND (Diana Phone == charging OR Costin Phone == charging)
        const compositeCondition = {
            type: 'AND',
            rules: [
                {
                    type: 'OR',
                    rules: [
                        { state_entity: 'sensor.diana_phone', operator: '==', value: 'charging' },
                        { state_entity: 'sensor.costin_phone', operator: '==', value: 'charging' }
                    ]
                },
                { state_entity: 'sensor.temperature', operator: '>', value: '25' }
            ]
        };

        // Permutation 1: Diana phone charging (True)
        expect(evaluateCondition(compositeCondition, mockHass)).toBe(true);

        // Permutation 2: Neither charging (False)
        const customHassNeither = {
            states: {
                'sensor.temperature': { state: '26.5' },
                'sensor.diana_phone': { state: 'not_charging' },
                'sensor.costin_phone': { state: 'not_charging' }
            }
        };
        expect(evaluateCondition(compositeCondition, customHassNeither)).toBe(false);

        // Permutation 3: Temperature too low (False)
        const customHassLowTemp = {
            states: {
                'sensor.temperature': { state: '22.0' },
                'sensor.diana_phone': { state: 'charging' },
                'sensor.costin_phone': { state: 'not_charging' }
            }
        };
        expect(evaluateCondition(compositeCondition, customHassLowTemp)).toBe(false);
    });
    
    it('should correctly handle numeric comparisons and boundary between checks', () => {
        const betweenCondition = {
            state_entity: 'sensor.temperature',
            operator: 'between',
            value: '20-30'
        };
        expect(evaluateCondition([betweenCondition], mockHass)).toBe(true);
        
        const customHassOutside = {
            states: { 'sensor.temperature': { state: '34.0' } }
        };
        expect(evaluateCondition([betweenCondition], customHassOutside)).toBe(false);
    });
});
```

---

## 🔬 4. Stage 2 Verification Checklist
- [ ] Run `npm run test` using Vitest inside the frontend directory.
- [ ] Assert that `ConditionEvaluator.test.js` loads perfectly and all logical gate permutations pass green.
