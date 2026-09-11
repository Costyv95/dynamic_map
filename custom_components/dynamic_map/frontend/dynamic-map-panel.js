import { EditorApp } from './editor.js?v=3.2.1';
import { ApiManager } from './shared/ApiManager.js?v=3.2.1';

/**
 * Home Assistant custom panel (`component_name: custom`). HA hands us
 * `hass`, `narrow`, `route` and `panel`; we mount the editor shell in a
 * shadow root and feed the live hass into the preview and the API.
 */
const BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const VERSION = (new URL(import.meta.url).searchParams.get('v')) || '';
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
        if (this.app) {
            this.app.hassBridge.stop();
            this.app.canvas.destroy();
            this.app = null;
        }
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

if (!customElements.get('dynamic-map-panel')) {
    customElements.define('dynamic-map-panel', DynamicMapPanel);
}
