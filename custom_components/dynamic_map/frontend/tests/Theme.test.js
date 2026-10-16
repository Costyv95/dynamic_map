import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CARD_STYLES } from '../card/CardStyles.js?v=3.2.1';
import { OverlayManager } from '../card/OverlayManager.js?v=3.2.1';

const ROOT = join(__dirname, '..');
const THEME_DOC = readFileSync(join(ROOT, 'THEME.md'), 'utf8');

/** Tokens declared in the :host block. */
function declaredTokens() {
    const host = CARD_STYLES.slice(CARD_STYLES.indexOf(':host'), CARD_STYLES.indexOf('.dm-render-root'));
    return [...host.matchAll(/(--dm-[a-z0-9-]+):/g)].map(m => m[1]);
}

describe('theme tokens', () => {
    it('every token the stylesheet reads is declared on :host', () => {
        const declared = new Set(declaredTokens());
        const used = new Set([...CARD_STYLES.matchAll(/var\((--dm-[a-z0-9-]+)/g)].map(m => m[1]));
        // --dm-room-glow is set per room polygon by the renderer.
        used.delete('--dm-room-glow');
        // Room labels: the renderer sets the -auto tone colours; the plain
        // names are optional overrides, undeclared so the fallback applies.
        ['--dm-room-label', '--dm-room-label-auto', '--dm-room-label-halo', '--dm-room-label-halo-auto'].forEach(t => used.delete(t));
        expect([...used].filter(t => !declared.has(t))).toEqual([]);
    });

    it('THEME.md documents every declared token', () => {
        expect(declaredTokens().filter(t => !THEME_DOC.includes('`' + t + '`'))).toEqual([]);
    });

    it('overlay builders carry no colour literals (the HUD tokens style them)', () => {
        const dir = join(ROOT, 'card', 'overlay');
        const files = ['buttons.js', 'sliders.js', 'infoItems.js', 'roomSelection.js', 'common.js'];
        const offenders = files.filter(f => /#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(readFileSync(join(dir, f), 'utf8')));
        expect(offenders).toEqual([]);
        expect(readdirSync(dir)).toEqual(expect.arrayContaining(files));
    });

    it('the floor filter reaches every floor surface; the object filter reaches decor only', () => {
        const rule = sel => CARD_STYLES.match(new RegExp(`([^{}]*${sel}[^{}]*)\\{([^}]*)\\}`));
        for (const sel of ['\\.dm-bg-image', '\\.dm-bg-underlay', '\\.dm-room-plate']) {
            expect(rule(sel)[2]).toContain('var(--dm-floor-filter)');
        }
        expect(rule('\\.dm-decor-layer')[2]).toContain('var(--dm-object-filter)');
    });
});

describe('long-press menu placement', () => {
    function show(isNarrow) {
        const renderRoot = document.createElement('div');
        renderRoot.getBoundingClientRect = () => ({ left: 0, top: 0, width: isNarrow ? 390 : 1280, height: 800 });
        const mapContext = { _hass: { states: {}, callService: vi.fn() }, renderRoot, activeOverlay: null, shortcutElements: {}, rooms: [], isNarrow };
        const shortcut = { sc: { entity_id: 'light.desk', config: {} } };
        OverlayManager.showActionMenu(mapContext, shortcut, [{ type: 'TOGGLE', name: 'Desk' }], { clientX: 200, clientY: 300 });
        return mapContext.activeOverlay;
    }

    it('docks as a bottom sheet on a narrow card', () => {
        const ov = show(true);
        expect(ov.classList.contains('dm-overlay')).toBe(true);
        expect(ov.classList.contains('dm-sheet')).toBe(true);
    });

    it('floats by the finger on a wide card', () => {
        expect(show(false).classList.contains('dm-sheet')).toBe(false);
    });

    it('the toggle is an accessible switch', () => {
        const sw = show(false).querySelector('.dm-ov-switch');
        expect(sw.getAttribute('role')).toBe('switch');
        expect(sw.getAttribute('aria-checked')).toBe('false');
    });
});
