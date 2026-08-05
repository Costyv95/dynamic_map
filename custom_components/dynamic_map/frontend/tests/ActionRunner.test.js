import { describe, it, expect, vi } from 'vitest';
import {
    executeAction,
    prepareServicePayload,
    buildRoomNameToSegmentMap,
    replaceRoomNamesWithIds
} from '../shared/ActionRunner.js';

function makeHass() {
    const calls = [];
    return {
        calls,
        callService: (domain, service, payload) => {
            calls.push({ domain, service, payload });
            return Promise.resolve();
        }
    };
}

describe('ActionRunner.executeAction', () => {
    it('executes TOGGLE as <domain>.toggle with the target entity', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'TOGGLE' }, 'input_boolean.sensor_living_room');

        expect(hass.calls).toEqual([{
            domain: 'input_boolean',
            service: 'toggle',
            payload: { entity_id: 'input_boolean.sensor_living_room' }
        }]);
    });

    it('does not remap TOGGLE for vacuums (vacuum.toggle is valid in modern HA)', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'TOGGLE' }, 'vacuum.robo');

        expect(hass.calls).toEqual([{
            domain: 'vacuum',
            service: 'toggle',
            payload: { entity_id: 'vacuum.robo' }
        }]);
    });

    it('maps media_player TOGGLE to turn_on when the player is off', () => {
        const hass = makeHass();
        hass.states = { 'media_player.projector': { state: 'off' } };
        executeAction(hass, { type: 'TOGGLE' }, 'media_player.projector');

        expect(hass.calls).toEqual([{
            domain: 'media_player',
            service: 'turn_on',
            payload: { entity_id: 'media_player.projector' }
        }]);
    });

    it('maps media_player TOGGLE to turn_off when the player is active', () => {
        const hass = makeHass();
        hass.states = { 'media_player.projector': { state: 'idle' } };
        executeAction(hass, { type: 'TOGGLE' }, 'media_player.projector');

        expect(hass.calls).toEqual([{
            domain: 'media_player',
            service: 'turn_off',
            payload: { entity_id: 'media_player.projector' }
        }]);
    });

    it('executes TOGGLE_ON / TOGGLE_OFF as turn_on / turn_off', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'TOGGLE_ON' }, 'light.desk_lamp');
        executeAction(hass, { type: 'TOGGLE_OFF' }, 'light.desk_lamp');

        expect(hass.calls).toEqual([
            { domain: 'light', service: 'turn_on', payload: { entity_id: 'light.desk_lamp' } },
            { domain: 'light', service: 'turn_off', payload: { entity_id: 'light.desk_lamp' } }
        ]);
    });

    it('remaps vacuum TOGGLE_ON to start and TOGGLE_OFF to return_to_base', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'TOGGLE_ON' }, 'vacuum.robo');
        executeAction(hass, { type: 'TOGGLE_OFF' }, 'vacuum.robo');

        expect(hass.calls).toEqual([
            { domain: 'vacuum', service: 'start', payload: { entity_id: 'vacuum.robo' } },
            { domain: 'vacuum', service: 'return_to_base', payload: { entity_id: 'vacuum.robo' } }
        ]);
    });

    it('executes CALL_SERVICE with a merged JSON payload and no implicit entity_id', () => {
        const hass = makeHass();
        executeAction(hass, {
            type: 'CALL_SERVICE',
            service: 'vacuum.send_command',
            payload: '{"command": "app_segment_clean", "params": [{"segments": [16], "repeat": 1}]}'
        }, 'vacuum.robo');

        // A JSON payload without action_entity must NOT inherit target as entity_id
        expect(hass.calls).toEqual([{
            domain: 'vacuum',
            service: 'send_command',
            payload: { command: 'app_segment_clean', params: [{ segments: [16], repeat: 1 }] }
        }]);
    });

    it('defaults CALL_SERVICE entity_id to the target when there is no payload', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'CALL_SERVICE', service: 'script.turn_on' }, 'script.cleanup');

        expect(hass.calls).toEqual([{
            domain: 'script',
            service: 'turn_on',
            payload: { entity_id: 'script.cleanup' }
        }]);
    });

    it('prefers action_entity as CALL_SERVICE entity_id even when a payload exists', () => {
        const hass = makeHass();
        executeAction(hass, {
            type: 'CALL_SERVICE',
            service: 'light.turn_on',
            action_entity: 'light.spot',
            payload: '{"brightness_pct": 40}'
        }, 'light.spot');

        expect(hass.calls).toEqual([{
            domain: 'light',
            service: 'turn_on',
            payload: { entity_id: 'light.spot', brightness_pct: 40 }
        }]);
    });

    it('logs and keeps the base payload when the JSON payload is invalid', () => {
        const hass = makeHass();
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            executeAction(hass, {
                type: 'CALL_SERVICE',
                service: 'light.turn_on',
                action_entity: 'light.spot',
                payload: '{not valid json'
            }, 'light.spot');
        } finally {
            errSpy.mockRestore();
        }

        expect(hass.calls).toEqual([{
            domain: 'light',
            service: 'turn_on',
            payload: { entity_id: 'light.spot' }
        }]);
    });

    it('ignores CALL_SERVICE with a malformed service string', () => {
        const hass = makeHass();
        executeAction(hass, { type: 'CALL_SERVICE', service: 'not_a_service' }, 'light.spot');
        expect(hass.calls).toEqual([]);
    });

    it('does nothing without hass, and without a target for non-CALL_SERVICE actions', () => {
        const hass = makeHass();
        expect(executeAction(null, { type: 'TOGGLE' }, 'light.a')).toBeUndefined();
        executeAction(hass, { type: 'TOGGLE_ON' }, undefined);
        expect(hass.calls).toEqual([]);
    });

    it('replaces room names with segment IDs in CALL_SERVICE payloads when a map is provided', () => {
        const hass = makeHass();
        executeAction(hass, {
            type: 'CALL_SERVICE',
            service: 'vacuum.send_command',
            payload: '{"command": "app_segment_clean", "params": [{"segments": ["Kitchen", "Living Room"], "repeat": 2}]}'
        }, 'vacuum.robo', {
            nameToSegmentId: { 'Kitchen': 16, 'Living Room': 17 }
        });

        expect(hass.calls).toEqual([{
            domain: 'vacuum',
            service: 'send_command',
            payload: { command: 'app_segment_clean', params: [{ segments: [16, 17], repeat: 2 }] }
        }]);
    });

    // Divergent-mode behavior: MapShortcut.onClick passes no options, so room
    // names must pass through untouched there.
    it('leaves room names untouched when no nameToSegmentId map is provided (tap-action mode)', () => {
        const hass = makeHass();
        executeAction(hass, {
            type: 'CALL_SERVICE',
            service: 'vacuum.send_command',
            payload: '{"params": [{"segments": ["Kitchen"]}]}'
        }, 'vacuum.robo');

        expect(hass.calls[0].payload.params[0].segments).toEqual(['Kitchen']);
    });

    // Divergent-mode behavior: only OverlayManager passes onServiceError.
    it('routes CALL_SERVICE rejections to onServiceError when provided (overlay-menu mode)', async () => {
        const failure = new Error('boom');
        const hass = {
            callService: () => Promise.reject(failure)
        };
        const onServiceError = vi.fn();

        executeAction(hass, { type: 'CALL_SERVICE', service: 'light.turn_on' }, 'light.spot', { onServiceError });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(onServiceError).toHaveBeenCalledTimes(1);
        expect(onServiceError).toHaveBeenCalledWith(failure);
    });
});

describe('ActionRunner.prepareServicePayload', () => {
    it('merges parsed payload over the implicit entity_id', () => {
        const payload = prepareServicePayload(
            { type: 'CALL_SERVICE', service: 'fan.set_percentage', action_entity: 'fan.office', payload: '{"percentage": 60}' },
            'fan.office'
        );
        expect(payload).toEqual({ entity_id: 'fan.office', percentage: 60 });
    });

    it('lets an explicit payload entity_id win over the implicit one', () => {
        const payload = prepareServicePayload(
            { type: 'CALL_SERVICE', service: 'light.turn_on', action_entity: 'light.a', payload: '{"entity_id": "light.b"}' },
            'light.a'
        );
        expect(payload).toEqual({ entity_id: 'light.b' });
    });
});

describe('ActionRunner.buildRoomNameToSegmentMap', () => {
    const rooms = [
        { id: 'room_svg_1', name: 'Kitchen' },
        { id: 'room_svg_2', name: 'Living Room' },
        { id: 'room_svg_3', name: 'Hallway' }
    ];

    it('maps room names to numeric robo IDs from room_mapping', () => {
        const shortcutElements = {
            sc1: {
                sc: {
                    entity_id: 'vacuum.robo',
                    config: {
                        room_mapping: { '16': 'room_svg_1', '17': 'room_svg_2' }
                    }
                }
            }
        };

        expect(buildRoomNameToSegmentMap('vacuum.robo', shortcutElements, rooms)).toEqual({
            'Kitchen': 16,
            'Living Room': 17
        });
    });

    it('prefers segment_mapping overrides and keeps non-numeric robo IDs as strings', () => {
        const shortcutElements = {
            sc1: {
                sc: {
                    entity_id: 'vacuum.robo',
                    config: {
                        room_mapping: { '16': 'room_svg_1', 'zone_a': 'room_svg_3' },
                        segment_mapping: { '16': 99 }
                    }
                }
            }
        };

        expect(buildRoomNameToSegmentMap('vacuum.robo', shortcutElements, rooms)).toEqual({
            'Kitchen': 99,
            'Hallway': 'zone_a'
        });
    });

    it('returns an empty map for unknown targets or missing mappings', () => {
        expect(buildRoomNameToSegmentMap('vacuum.other', {}, rooms)).toEqual({});
        expect(buildRoomNameToSegmentMap('vacuum.robo', {
            sc1: { sc: { entity_id: 'vacuum.robo', config: {} } }
        }, rooms)).toEqual({});
    });
});

describe('ActionRunner.replaceRoomNamesWithIds', () => {
    it('replaces matching strings in nested arrays and objects in place', () => {
        const payload = {
            params: [{ segments: ['Kitchen', 'Unknown', { deep: 'Living Room' }], repeat: 1 }],
            note: 'Kitchen'
        };
        replaceRoomNamesWithIds(payload, { 'Kitchen': 16, 'Living Room': 17 });

        expect(payload).toEqual({
            params: [{ segments: [16, 'Unknown', { deep: 17 }], repeat: 1 }],
            note: 16
        });
    });
});
