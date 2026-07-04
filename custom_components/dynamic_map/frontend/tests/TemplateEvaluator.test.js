import { describe, it, expect } from 'vitest';
import { evaluateTemplate } from '../shortcuts/TemplateEvaluator.js';

describe('TemplateEvaluator', () => {
    const mockHass = {
        states: {
            'sensor.temperature': {
                state: '21.5',
                attributes: {
                    friendly_name: 'Living Room Temp',
                    humidity: 45
                }
            },
            'sensor.unavailable_sensor': {
                state: 'unavailable'
            }
        }
    };

    it('should evaluate raw states', () => {
        const template = "Temp is {states('sensor.temperature')}°C";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("Temp is 21.5°C");
    });

    it('should fall back to default values for non-existent states', () => {
        const template = "{states('sensor.non_existent', 'unknown')}";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("unknown");
    });

    it('should fall back to default values for unavailable/unknown states', () => {
        const template = "{states('sensor.unavailable_sensor', '22')}";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("22");
    });

    it('should evaluate state attributes', () => {
        const template = "Name: {state_attr('sensor.temperature', 'friendly_name')}, Humidity: {state_attr('sensor.temperature', 'humidity')}%";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("Name: Living Room Temp, Humidity: 45%");
    });

    it('should return null/default value for non-existent attributes', () => {
        const template = "{state_attr('sensor.temperature', 'non_existent')}";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("");
    });

    it('should perform math calculations using get_value', () => {
        const template = "{get_value('sensor.temperature') + 3.5}°C";
        const result = evaluateTemplate(template, mockHass);
        // 21.5 + 3.5 = 25
        expect(result).toBe("25°C");
    });

    it('should default get_value if state is missing or invalid', () => {
        const template = "{get_value('sensor.non_existent', 10) + 5}";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("15");
    });

    it('should handle complex mixed templates', () => {
        const template = "{states('sensor.temperature')}°C ({state_attr('sensor.temperature', 'friendly_name')})";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("21.5°C (Living Room Temp)");
    });

    it('should fallback gracefully and log warnings on script syntax errors', () => {
        const template = "{invalid.syntax()}";
        const result = evaluateTemplate(template, mockHass);
        expect(result).toBe("");
    });
});
