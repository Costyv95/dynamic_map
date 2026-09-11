import { EditorApp } from './editor.js?v=3.2.1';
import { ApiManager } from './shared/ApiManager.js?v=3.2.1';

/**
 * Home Assistant custom panel (`component_name: custom`). HA hands us
 * `hass`, `narrow`, `route` and `panel`; we mount the editor shell in a
 * shadow root and feed the live hass into the preview and the API.
 */
const BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
// Tests import without a query (vitest strips it) and set the version on the global instead.
const VERSION = (new URL(import.meta.url).searchParams.get('v')) || globalThis.__DM_PANEL_VERSION || '';
const q = VERSION ? `?v=${VERSION}` : '';

const SHELL = `
<div id="dm-app" class="dm-app dm-in-panel">
    <header id="toolbar" class="dm-toolbar"></header>
    <main id="canvas-container" class="dm-map"></main>
    <aside id="inspector" class="dm-inspector"></aside>
</div>
<datalist id="entityList"></datalist>
<datalist id="iconList"></datalist>
<datalist id="serviceList">
    <option value="light.turn_on"></option><option value="light.turn_off"></option><option value="light.toggle"></option>
    <option value="switch.turn_on"></option><option value="switch.turn_off"></option><option value="switch.toggle"></option>
    <option value="script.turn_on"></option><option value="scene.turn_on"></option>
    <option value="fan.turn_on"></option><option value="fan.turn_off"></option>
    <option value="cover.open_cover"></option><option value="cover.close_cover"></option><option value="cover.stop_cover"></option>
    <option value="climate.set_temperature"></option><option value="media_player.media_play_pause"></option>
</datalist>`;

/** PolyBool ships as a classic UMD script; load it once into the page. */
function ensurePolyBool() {
    if (window.PolyBool || document.querySelector('script[data-dm-polybool]')) return;
    const s = document.createElement('script');
    s.src = `${BASE}/polybool.min.js${q}`;
    s.dataset.dmPolybool = '1';
    document.head.appendChild(s);
}

class DynamicMapPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._hass = null;
        this.app = null;
    }

    connectedCallback() {
        if (this.app) return;
        ensurePolyBool();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${BASE}/editor.css${q}`;
        const wrap = document.createElement('div');
        wrap.innerHTML = SHELL;
        this.shadowRoot.append(link, ...wrap.childNodes);
        this.app = new EditorApp(this.shadowRoot);
        this.app.ui.toolbar.addMenuButton(() => this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })));
        this.app.start({ pollHass: false });
        if (this._hass) this.app.hassBridge.setHass(this._hass);
    }

    disconnectedCallback() {
        if (this.app) { this.app.destroy(); this.app = null; }
        ApiManager.setHass(null);
    }

    set hass(hass) {
        this._hass = hass;
        ApiManager.setHass(hass);
        if (this.app) this.app.hassBridge.setHass(hass);
    }

    get hass() { return this._hass; }

    set narrow(v) { this.toggleAttribute('narrow', !!v); }
    set panel(v) { this._panel = v; }
    set route(v) { this._route = v; }
}

DynamicMapPanel.VERSION = VERSION;

/**
 * A tab that already loaded an older panel keeps running its class (custom
 * elements cannot be redefined, and lifecycle callbacks are captured at
 * define time). HA assigns `hass` on every update, and that setter IS looked
 * up dynamically: wrap it so the old panel shows a reload bar instead of
 * silently running stale code.
 */
function markStale(Old) {
    if (Old.VERSION === VERSION || Old._dmStaleHook) return;
    Old._dmStaleHook = true;
    const desc = Object.getOwnPropertyDescriptor(Old.prototype, 'hass');
    Object.defineProperty(Old.prototype, 'hass', { get: desc.get, set(h) { desc.set.call(this, h); reloadBar(this); }, configurable: true });
}

function reloadBar(panel) {
    if (!panel.shadowRoot || panel.shadowRoot.querySelector('.dm-reload-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'dm-reload-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;gap:12px;align-items:center;justify-content:center;padding:8px 12px;background:#f59e0b;color:#111;font:600 14px/1.3 system-ui,sans-serif;';
    bar.innerHTML = '<span></span><button style="font:inherit;padding:4px 12px;border-radius:999px;border:0;background:#111;color:#fff;cursor:pointer">Reload</button>';
    bar.querySelector('span').textContent = `Map Editor ${VERSION} is installed but this page still runs an older version.`;
    bar.querySelector('button').addEventListener('click', () => location.reload());
    panel.shadowRoot.appendChild(bar);
}

const existing = customElements.get('dynamic-map-panel');
if (existing) markStale(existing);
else customElements.define('dynamic-map-panel', DynamicMapPanel);
