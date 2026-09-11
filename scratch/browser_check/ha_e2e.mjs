// End-to-end against the throwaway HA on .202:8124 - onboard once, then open
// the Map Editor custom panel and exercise it. Usage: node ha_e2e.mjs [onboard]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const HA = 'http://192.168.1.202:8124';
const USER = { name: 'Tester', username: 'tester', password: 'tester-pw-2026' };
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
const shot = async (n) => { await page.screenshot({ path: `${OUT}ha-${n}.png` }); console.log('shot', `ha-${n}`); };

/** Log in by injecting the onboarding tokens the way the HA frontend stores them. */
async function login() {
    const t = JSON.parse(fs.readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));
    await page.goto(`${HA}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([tok, ha]) => {
        localStorage.setItem('hassTokens', JSON.stringify({
            access_token: tok.access_token, refresh_token: tok.refresh_token, token_type: 'Bearer',
            expires_in: tok.expires_in, expires: Date.now() + tok.expires_in * 1000, hassUrl: ha, clientId: ha + '/'
        }));
    }, [t, HA]);
}

await login();
await page.goto(`${HA}/dynamic_map_editor`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
    const panel = document.querySelector('home-assistant')?.shadowRoot?.querySelector('home-assistant-main')?.shadowRoot
        ?.querySelector('partial-panel-resolver')?.querySelector('dynamic-map-panel');
    if (!panel) return { panel: false };
    const sr = panel.shadowRoot;
    return {
        panel: true,
        toolbarButtons: sr.querySelectorAll('#toolbar button').length,
        rooms: sr.querySelectorAll('polygon.room-polygon').length,
        badges: sr.querySelectorAll('.shortcut-group').length,
        floors: [...sr.querySelectorAll('[data-floor]')].map(b => b.dataset.floor),
        hass: !!panel.hass, live: !!panel.app?.canvas?._hass?.states,
        inspector: sr.querySelector('#inspector')?.textContent.slice(0, 60)
    };
});
console.log('panel', JSON.stringify(info));
await shot('panel');
// Select a badge inside the shadow DOM by clicking its screen position.
const box = await page.evaluate(() => {
    const panel = document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.querySelector('partial-panel-resolver').querySelector('dynamic-map-panel');
    const g = panel.shadowRoot.querySelector('.shortcut-group[data-shortcut-id]');
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(500);
const sel = await page.evaluate(() => {
    const panel = document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.querySelector('partial-panel-resolver').querySelector('dynamic-map-panel');
    return { selected: panel.app.state.selectedShortcutIdx, handles: panel.shadowRoot.querySelectorAll('.dm-edit-overlay [data-handle]').length };
});
console.log('selected', JSON.stringify(sel));
await shot('panel-selected');
// Save through hass.fetchWithAuth
const saved = await page.evaluate(async () => {
    const panel = document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.querySelector('partial-panel-resolver').querySelector('dynamic-map-panel');
    try { await panel.app.save(); return 'ok'; } catch (e) { return 'error: ' + e.message; }
});
console.log('save', saved);
console.log('errors', JSON.stringify(errors, null, 1));
await ctx.close();
await browser.close();
