import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../custom-svg-map.js';
import { HIDDEN_SUBSCRIBE, applyHidden, shortcutEntity } from '../card/HiddenEntities.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function shortcut(entityId, config = {}) {
    const group = document.createElementNS(SVG_NS, 'g');
    const glowGroup = document.createElementNS(SVG_NS, 'g');
    return { sc: { entity_id: entityId }, config, group, glowGroup, updateState: () => false };
}

function chip(entity, builtin) {
    const el = document.createElement('button');
    return { chip: el, item: { entity, builtin } };
}

/** hass whose connection records the ha_tools subscription, so a test can push to it. */
function hassWithHaTools() {
    const feed = { push: null, unsub: vi.fn() };
    const hass = {
        states: {},
        callService: vi.fn(),
        connection: {
            subscribeMessage: vi.fn(async (cb, msg) => {
                feed.push = cb;
                feed.msg = msg;
                return feed.unsub;
            }),
        },
    };
    return { hass, feed };
}

function cardWith(shortcuts, chips = []) {
    const card = document.createElement('custom-svg-map');
    card.shortcutElements = shortcuts;
    card._quickEls = chips;
    card.updateLiveFeatures = vi.fn();
    card.updateRoomStyles = vi.fn();
    card._initialStylesRendered = true;
    return card;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('hidden entities from HA Tools', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false });
        global.requestAnimationFrame = vi.fn();
        global.cancelAnimationFrame = vi.fn();
        global.ResizeObserver = class { observe() {} disconnect() {} };
    });
    afterEach(() => vi.restoreAllMocks());

    it('hides the shortcut, its glow and its chip while HA Tools lists the entity', async () => {
        const ac = shortcut('climate.bedroom_ac');
        const lamp = shortcut('light.bed');
        const acChip = chip('climate.bedroom_ac');
        const card = cardWith({ ac, lamp }, [acChip]);
        const { hass, feed } = hassWithHaTools();

        card.hass = hass;
        await flush();
        expect(feed.msg).toEqual(HIDDEN_SUBSCRIBE);

        feed.push({ hidden: ['climate.bedroom_ac'] });
        expect(ac.group.style.display).toBe('none');
        expect(ac.glowGroup.style.visibility).toBe('hidden');
        expect(acChip.chip.hidden).toBe(true);
        expect(lamp.group.style.display).toBe('');

        feed.push({ hidden: [] });
        expect(ac.group.style.display).toBe('');
        expect(ac.glowGroup.style.visibility).toBe('');
        expect(acChip.chip.hidden).toBe(false);
    });

    it('subscribes once, however often hass changes', async () => {
        const card = cardWith({});
        const { hass } = hassWithHaTools();
        card.hass = hass;
        card.hass = { ...hass };
        await flush();
        expect(hass.connection.subscribeMessage).toHaveBeenCalledTimes(1);
    });

    it('shows everything when HA Tools is not installed', async () => {
        const ac = shortcut('climate.bedroom_ac');
        const card = cardWith({ ac });
        const hass = {
            states: {},
            connection: { subscribeMessage: vi.fn().mockRejectedValue({ code: 'unknown_command' }) },
        };
        card.hass = hass;
        await flush();
        expect(ac.group.style.display).toBe('');
    });

    it('unsubscribes when the card leaves the page and subscribes again on return', async () => {
        const card = cardWith({});
        const { hass, feed } = hassWithHaTools();
        document.body.appendChild(card);
        card.hass = hass;
        await flush();
        card.remove();
        await flush();
        expect(feed.unsub).toHaveBeenCalledTimes(1);
        card.hass = hass;
        await flush();
        expect(hass.connection.subscribeMessage).toHaveBeenCalledTimes(2);
    });

    it('leaves the built-in lights-off chip to its own rule', () => {
        const lightsOff = chip(null, 'lights_off');
        lightsOff.chip.hidden = true;
        const host = { hiddenEntities: new Set(['light.bed']), shortcutElements: {}, _quickEls: [lightsOff] };
        applyHidden(host);
        expect(lightsOff.chip.hidden).toBe(true);
    });

    it('matches a shortcut by its entity, else the entity its config follows', () => {
        expect(shortcutEntity(shortcut('climate.bedroom_ac'))).toBe('climate.bedroom_ac');
        expect(shortcutEntity(shortcut('', { state_entity: 'switch.water_valve_heavy' }))).toBe('switch.water_valve_heavy');
        expect(shortcutEntity(shortcut(null))).toBe(null);
    });
});
