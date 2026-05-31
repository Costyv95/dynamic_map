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

    it('should recursively evaluate nested logic groups inside standard flat condition arrays', () => {
        const nestedInFlatArray = [
            { state_entity: 'light.bedroom_light', operator: '==', value: 'off' },
            {
                type: 'OR',
                rules: [
                    { state_entity: 'sensor.diana_phone', operator: '==', value: 'charging' },
                    { state_entity: 'sensor.costin_phone', operator: '==', value: 'charging' }
                ]
            }
        ];
        
        // Diana phone is charging, light is off (True)
        expect(evaluateCondition(nestedInFlatArray, mockHass)).toBe(true);

        // Neither charging, light is off (False)
        const customHassNeitherCharging = {
            states: {
                'light.bedroom_light': { state: 'off' },
                'sensor.diana_phone': { state: 'not_charging' },
                'sensor.costin_phone': { state: 'not_charging' }
            }
        };
        expect(evaluateCondition(nestedInFlatArray, customHassNeitherCharging)).toBe(false);
    });
});
