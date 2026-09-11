// Screenshots of the new editor UI at desktop and phone sizes, plus a few interactions.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = 'http://192.168.1.202:8765';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');

async function run(name, viewport, steps) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 800, isMobile: viewport.width < 800 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
    await page.goto(`${BASE}/dynamic_map_ui/editor.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await steps(page, async (tag) => { await page.screenshot({ path: `${OUT}${name}-${tag}.png` }); console.log('shot', `${name}-${tag}`); });
    console.log(name, 'errors', JSON.stringify(errors));
    await ctx.close();
}

await run('desk', { width: 1400, height: 860 }, async (page, shot) => {
    await shot('list');
    const box = await page.evaluate(() => { const r = document.querySelector('svg.dm-editor-svg .shortcut-group[data-shortcut-id]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(300);
    await shot('object');
    await page.click('#toolbar [data-value="rooms"]');
    await page.waitForTimeout(200);
    const room = await page.evaluate(() => { const r = document.querySelector('svg.dm-editor-svg polygon.room-polygon').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.click(room.x, room.y);
    await page.waitForTimeout(300);
    await shot('room');
    await page.click('#toolbar [title^="More"]');
    await page.waitForTimeout(200);
    await shot('menu');
});

await run('phone', { width: 390, height: 844 }, async (page, shot) => {
    await shot('list');
    await page.click('#toolbar [data-value="vertical"]');
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => { const r = document.querySelector('svg.dm-editor-svg .shortcut-group[data-shortcut-id]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(300);
    await shot('object');
    await page.click('.dm-inspector-handle');
    await page.waitForTimeout(400);
    await shot('expanded');
});
await browser.close();
