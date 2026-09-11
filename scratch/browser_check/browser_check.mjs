// Drive the headless Chrome on .202 (via the CDP tunnel) against the mock
// server there. Usage: node browser_check.mjs [editor|card|both]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://192.168.1.202:8765';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const what = process.argv[2] || 'both';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });

async function shot(name) {
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log('shot', name);
}

if (what === 'card' || what === 'both') {
    await page.goto(`${BASE}/card.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
        const c = window.__card;
        const svg = c.shadowRoot.querySelector('svg');
        return {
            rooms: c.shadowRoot.querySelectorAll('polygon.room-polygon').length,
            badges: c.shadowRoot.querySelectorAll('.shortcut-group').length,
            glows: c.shadowRoot.querySelectorAll('.dm-light-glow').length,
            viewBox: svg && svg.getAttribute('viewBox'),
            rotated: c.isRotated, mode: c.activeMode, errors: window.__errors
        };
    });
    console.log('card', JSON.stringify(info));
    await shot('card-landscape');
    await page.evaluate(() => document.getElementById('wrap').classList.add('portrait'));
    await page.waitForTimeout(800);
    console.log('card portrait', JSON.stringify(await page.evaluate(() => ({ rotated: window.__card.isRotated, mode: window.__card.activeMode }))));
    await shot('card-portrait');
}

if (what === 'editor' || what === 'both') {
    await page.goto(`${BASE}/dynamic_map_ui/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => {
        const svg = document.querySelector('svg.dm-editor-svg');
        return {
            rooms: svg.querySelectorAll('polygon.room-polygon').length,
            badges: svg.querySelectorAll('.shortcut-group').length,
            viewBox: svg.getAttribute('viewBox'),
            floors: [...document.querySelectorAll('.floor-btn[data-floor]')].map(b => b.dataset.floor),
            active: window.dmEditor.state.activeFloor
        };
    });
    console.log('editor', JSON.stringify(info));
    await shot('editor-initial');
    // Select the first badge by clicking its centre on screen.
    const box = await page.evaluate(() => {
        const g = document.querySelector('svg.dm-editor-svg .shortcut-group[data-shortcut-id]');
        const r = g.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: g.dataset.shortcutId };
    });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(300);
    const sel = await page.evaluate(() => ({
        selected: window.dmEditor.state.selectedShortcutIdx,
        handles: document.querySelectorAll('.dm-edit-overlay [data-handle]').length,
        panel: document.getElementById('shortcutUI').style.display,
        name: document.getElementById('scName').value
    }));
    console.log('after click', JSON.stringify(sel));
    await shot('editor-selected');
    // Drag it 80px right and check the position changed.
    const before = await page.evaluate(() => JSON.stringify(window.dmEditor.state.shortcuts[window.dmEditor.state.selectedShortcutIdx].position));
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 10, { steps: 5 });
    await page.mouse.move(box.x + 80, box.y + 20, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => JSON.stringify(window.dmEditor.state.shortcuts[window.dmEditor.state.selectedShortcutIdx].position));
    console.log('drag', before, '->', after);
    // Portrait layout toggle
    await page.click('#toggleVerticalBtn');
    await page.waitForTimeout(600);
    console.log('vertical', JSON.stringify(await page.evaluate(() => ({ rotated: window.dmEditor.canvas.isRotated, mode: window.dmEditor.canvas.activeMode }))));
    await shot('editor-vertical');
    // Walls layer
    await page.click('#toggleHorizontalBtn');
    await page.click('#layerWallsBtn');
    await page.waitForTimeout(400);
    await shot('editor-walls');
}

console.log('errors', JSON.stringify(errors, null, 1));
await ctx.close();
await browser.close();
