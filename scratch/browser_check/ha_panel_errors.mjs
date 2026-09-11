import { chromium } from 'playwright-core';
import fs from 'node:fs';
const HA = 'http://192.168.1.202:8124';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const log = [];
page.on('pageerror', e => log.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`console.${m.type()}: ` + m.text().slice(0, 300)); });
page.on('response', r => { if (r.status() >= 400 && r.url().includes('dynamic_map')) log.push(`http ${r.status()}: ${r.url()}`); });
page.on('requestfailed', r => log.push('requestfailed: ' + r.url()));
const t = JSON.parse(fs.readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));
await page.goto(`${HA}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(([tok, ha]) => localStorage.setItem('hassTokens', JSON.stringify({ access_token: tok.access_token, refresh_token: tok.refresh_token, token_type: 'Bearer', expires_in: tok.expires_in, expires: Date.now() + tok.expires_in * 1000, hassUrl: ha, clientId: ha + '/' })), [t, HA]);
await page.goto(`${HA}/dynamic_map_editor`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
console.log(JSON.stringify(await page.evaluate(() => {
    const main = document.querySelector('home-assistant')?.shadowRoot?.querySelector('home-assistant-main');
    const resolver = main?.shadowRoot?.querySelector('partial-panel-resolver');
    const panel = resolver?.querySelector('dynamic-map-panel');
    return { url: location.href, hasMain: !!main, hasResolver: !!resolver, hasPanel: !!panel, upgraded: !!panel?.shadowRoot, defined: !!customElements.get('dynamic-map-panel'),
        resolverChildren: resolver ? [...resolver.children].map(c => c.tagName) : null };
}), null, 1));
console.log(log.join('\n') || 'no errors');
await page.screenshot({ path: 'shots/ha-panel-debug.png' });
await ctx.close(); await browser.close();
