import { ShortcutFactory } from './shortcuts/ShortcutFactory.js?v=3.2.0';
import { CameraManager } from './card/CameraManager.js?v=3.2.0';
import { MapGeometry } from './shared/MapGeometry.js?v=3.2.0';
import { OverlayManager } from './card/OverlayManager.js?v=3.2.0';
import { MapBuilder } from './card/MapBuilder.js?v=3.2.0';

const ZOOM_ANIMATION_MS = 320;

const WEATHER_ICONS = {
    'clear-night': '🌙', 'cloudy': '☁️', 'fog': '🌫️', 'hail': '🌨️',
    'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅',
    'pouring': '🌧️', 'rainy': '🌦️', 'snowy': '🌨️', 'snowy-rainy': '🌨️',
    'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨', 'exceptional': '⚠️'
};

const CARD_STYLES = `
    :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 70vh; /* Fallback for non-panel views */
        position: relative;
        /* Theme tokens with HA theme fallbacks — override via HA themes */
        --dm-accent: var(--primary-color, #0ea5e9);
        --dm-surface: var(--card-background-color, #ffffff);
        --dm-text: var(--primary-text-color, #1e293b);
        --dm-muted: var(--secondary-text-color, #64748b);
        --dm-border: var(--divider-color, #e2e8f0);
        --dm-glass: color-mix(in srgb, var(--card-background-color, #ffffff) 72%, transparent);
        --dm-glass-border: color-mix(in srgb, var(--divider-color, #94a3b8) 45%, transparent);
        --dm-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        font-family: var(--primary-font-family, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
    }
    .dm-render-root {
        position: absolute;
        inset: 0;
        background: var(--dm-surface);
        overflow: hidden;
    }
    .dm-top-ui {
        position: absolute;
        top: 14px;
        left: 14px;
        right: 14px;
        display: flex;
        gap: 10px;
        row-gap: 8px;
        align-items: flex-start;
        flex-wrap: wrap;
        z-index: 10;
        pointer-events: none;
    }
    .dm-top-ui > * { pointer-events: auto; }
    .dm-chip-group {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
        padding: 4px;
        background: var(--dm-glass);
        border: 1px solid var(--dm-glass-border);
        border-radius: 999px;
        box-shadow: var(--dm-shadow);
        backdrop-filter: blur(14px) saturate(1.4);
        -webkit-backdrop-filter: blur(14px) saturate(1.4);
    }
    .dm-chip {
        padding: 7px 16px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--dm-text);
        cursor: pointer;
        border-radius: 999px;
        transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
        user-select: none;
        text-align: center;
        white-space: nowrap;
    }
    .dm-chip:hover:not(.active) { background: rgba(127, 127, 127, 0.14); }
    .dm-chip:active { transform: scale(0.96); }
    .dm-chip.active {
        background: var(--dm-accent);
        color: #fff;
        box-shadow: 0 2px 8px color-mix(in srgb, var(--dm-accent) 55%, transparent);
    }
    .dm-icon-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--dm-glass);
        border: 1px solid var(--dm-glass-border);
        border-radius: 999px;
        cursor: pointer;
        color: var(--dm-text);
        box-shadow: var(--dm-shadow);
        backdrop-filter: blur(14px) saturate(1.4);
        -webkit-backdrop-filter: blur(14px) saturate(1.4);
        transition: background 0.2s ease, transform 0.15s ease;
        padding: 0;
    }
    .dm-icon-btn:hover { background: rgba(127, 127, 127, 0.14); }
    .dm-icon-btn:active { transform: scale(0.94); }
    .dm-outside-bar {
        display: flex;
        align-items: stretch;
        margin: 0 auto;
        padding: 5px 4px;
        background: var(--dm-glass);
        border: 1px solid var(--dm-glass-border);
        border-radius: 18px;
        box-shadow: var(--dm-shadow);
        backdrop-filter: blur(14px) saturate(1.4);
        -webkit-backdrop-filter: blur(14px) saturate(1.4);
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
    }
    .dm-outside-bar::-webkit-scrollbar { display: none; }
    .dm-outside-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 3px 13px;
        min-width: 48px;
        cursor: pointer;
        border-radius: 12px;
        transition: background 0.2s ease;
    }
    .dm-outside-item:hover { background: rgba(127, 127, 127, 0.14); }
    .dm-outside-item:not(:first-child) { border-left: 1px solid var(--dm-glass-border); border-radius: 0; }
    .dm-outside-item:last-child { border-radius: 0 12px 12px 0; }
    .dm-outside-item:first-child { border-radius: 12px 0 0 12px; }
    .dm-outside-item:only-child { border-radius: 12px; }
    .dm-outside-item.dm-unavailable { opacity: 0.45; }
    .dm-outside-value {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        font-weight: 700;
        color: var(--dm-text);
        white-space: nowrap;
    }
    .dm-outside-value .dm-oi-icon { font-size: 14px; }
    .dm-outside-label {
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--dm-muted);
        white-space: nowrap;
    }
    /* With the outside bar present, the focus pill moves to the bottom so it
       can never collide with the (possibly wrapped) top controls. */
    .dm-render-root.dm-has-outside .dm-focus-pill {
        top: auto;
        bottom: 18px;
        transform: translate(-50%, 12px);
    }
    .dm-render-root.dm-has-outside .dm-focus-pill.dm-visible {
        transform: translate(-50%, 0);
    }
    .dm-focus-pill {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translate(-50%, -12px);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 8px 18px;
        background: var(--dm-glass);
        border: 1px solid var(--dm-glass-border);
        border-radius: 999px;
        box-shadow: var(--dm-shadow);
        backdrop-filter: blur(14px) saturate(1.4);
        -webkit-backdrop-filter: blur(14px) saturate(1.4);
        color: var(--dm-text);
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        letter-spacing: 0.02em;
        cursor: pointer;
        z-index: 11;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .dm-focus-pill.dm-visible {
        opacity: 1;
        pointer-events: auto;
        transform: translate(-50%, 0);
    }
    .dm-focus-pill .dm-pill-x {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        font-size: 12px;
        background: rgba(127, 127, 127, 0.16);
        transition: background 0.2s ease;
    }
    .dm-focus-pill:hover .dm-pill-x { background: rgba(127, 127, 127, 0.3); }
    .room-polygon {
        cursor: pointer;
        stroke-linejoin: round;
        transition: fill 0.3s ease, stroke 0.3s ease, filter 0.3s ease, opacity 0.35s ease;
    }
    .room-polygon.dm-on { filter: drop-shadow(0 0 10px var(--dm-room-glow, transparent)); }
    .room-polygon.dm-selected { filter: drop-shadow(0 0 8px var(--dm-accent)); }
    .room-polygon.dm-dimmed { opacity: 0.4; }
    .room-polygon:hover:not(.dm-selected):not(.dm-on) { filter: brightness(1.2); }
    .room-label {
        pointer-events: none;
        user-select: none;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        paint-order: stroke;
        stroke: rgba(10, 16, 30, 0.6);
        stroke-width: 3px;
        stroke-linejoin: round;
        transition: opacity 0.35s ease;
    }
    .room-label.dm-dimmed { opacity: 0.35; }
    .dm-error { color: var(--error-color, #ef4444); padding: 20px; font-size: 14px; }
`;

class CustomSvgMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.svgNS = "http://www.w3.org/2000/svg";

        const style = document.createElement('style');
        style.textContent = CARD_STYLES;
        this.shadowRoot.appendChild(style);

        this.rooms = [];
        this.shortcuts = [];
        this.lastTime = 0;
        this.focusedRoomId = null;
        this.rotationMode = 'auto';
        this.activeOverlay = null;
        this._loadSeq = 0;
        this._vbAnimFrame = null;

        this.renderRoot = document.createElement('div');
        this.renderRoot.className = 'dm-render-root';
        this.shadowRoot.appendChild(this.renderRoot);
        this.animationFrame = null;
    }

    connectedCallback() {
        if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.rooms && this.rooms.length > 0 && this.imgW && this.imgH) {
                    this.calculateAutoCrop();
                }
            });
            this.resizeObserver.observe(this);
        }
    }

    disconnectedCallback() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.cameraManager) {
            this.cameraManager.destroy();
            this.cameraManager = null;
        }
    }

    static getStubConfig() {
        return { type: 'custom:custom-svg-map', default_floor: 1 };
    }

    setConfig(config) {
        this.config = { ...config };
        if (this.config.floors && this.config.floors.length) {
            this.activeFloor = this.config.default_floor || this.config.floor || this.config.floors[0];
            this.loadData();
        } else {
            // No floors configured: discover them from the backend once hass is available.
            this._needsFloorDiscovery = true;
        }
    }

    async discoverFloors(hass) {
        this._needsFloorDiscovery = false;
        let floors = [1];
        try {
            const data = await hass.callApi('GET', 'dynamic_map/floors');
            if (data && data.floors && data.floors.length) floors = data.floors;
        } catch (e) {
            console.warn('[custom-svg-map] Floor discovery failed, defaulting to floor 1', e);
        }
        this.config.floors = floors;
        const preferred = this.config.default_floor || this.config.floor;
        this.activeFloor = floors.includes(preferred) ? preferred : floors[0];
        this.loadData();
    }

    floorLabel(floorNum) {
        const names = this.config.floor_names || {};
        return names[floorNum] || `Floor ${floorNum}`;
    }

    async loadData() {
        const floor = this.activeFloor;
        const requestId = ++this._loadSeq;
        const t = Date.now();
        const bgUrl = `/dynamic_map_data/bg_floor${floor}.png?t=${t}`;

        const fetchJson = async (url) => {
            try {
                const res = await fetch(url);
                return res.ok ? await res.json() : null;
            } catch (e) {
                return null;
            }
        };

        try {
            const [rooms, shortcuts, config, outside] = await Promise.all([
                fetchJson(`/dynamic_map_data/rooms_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/shortcuts_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/config_floor${floor}.json?t=${t}`),
                fetchJson(`/dynamic_map_data/outside.json?t=${t}`)
            ]);
            // A newer floor switch superseded this load — drop it.
            if (requestId !== this._loadSeq) return;

            this.rooms = rooms || [];
            this.shortcuts = shortcuts || [];
            this.outsideItems = outside || [];

            const floorConfig = config || { rotation_mode: 'auto' };
            this.rotationMode = floorConfig.rotation_mode || 'auto';
            this.floorBgColor = floorConfig.background_color || null;
            this.floorBgMode = floorConfig.background_mode || 'image';
            this.walls = floorConfig.walls || [];
            this.flips = floorConfig.flips || {
                horizontal: { h: false, v: false },
                vertical: { h: false, v: false }
            };

            const img = new Image();
            img.onload = () => {
                if (requestId !== this._loadSeq) return;
                this.imgW = img.naturalWidth || 1000;
                this.imgH = img.naturalHeight || 1000;
                this.buildSVG(bgUrl);
            };
            img.onerror = () => {
                if (requestId !== this._loadSeq) return;
                this.imgW = 1000;
                this.imgH = 1000;
                this.buildSVG(bgUrl);
            };
            img.src = bgUrl;

        } catch (e) {
            console.error("Failed to load map data", e);
            this.renderRoot.innerHTML = `<div class="dm-error">Failed to load map data. Ensure rooms_floor${floor}.json exists in /config/dynamic_map_data/.</div>`;
        }
    }

    buildFloorSwitcher() {
        const switcher = MapBuilder.buildFloorSwitcher(this);
        if (switcher && this.topLeftUI) {
            this.topLeftUI.appendChild(switcher);
        }
    }

    buildRotationSwitcher() {
        const switcher = MapBuilder.buildRotationSwitcher(this);
        if (switcher && this.topLeftUI) {
            this.topLeftUI.appendChild(switcher);
        }
    }

    buildSVG(bgUrl) {
        this.renderRoot.innerHTML = '';
        this.focusedRoomId = null;

        // mapWrapper will strictly confine the SVG and overlay UI
        this.mapWrapper = document.createElement('div');
        this.mapWrapper.style.position = 'relative';
        this.mapWrapper.style.margin = '0 auto';
        this.mapWrapper.style.display = 'block';

        this.svg = document.createElementNS(this.svgNS, 'svg');
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.display = 'block';

        this.mapRoot = document.createElementNS(this.svgNS, 'g');
        this.mapRoot.id = 'map-root';

        this.applyFloorBackground();
        if (this.floorBgMode === 'fit') {
            // No background image: draw a rounded plate that hugs the room
            // layout instead of a fixed-size canvas rectangle.
            this.mapRoot.appendChild(this.buildRoomPlate());
        } else {
            if (this.floorBgColor) {
                // Underlay in the floor color: shows around the plan and
                // through any transparent parts of the background image.
                const underlay = document.createElementNS(this.svgNS, 'rect');
                underlay.setAttribute('width', this.imgW.toString());
                underlay.setAttribute('height', this.imgH.toString());
                underlay.setAttribute('fill', this.floorBgColor);
                this.mapRoot.appendChild(underlay);
            }
            const image = document.createElementNS(this.svgNS, 'image');
            image.setAttribute('href', bgUrl);
            image.setAttribute('width', this.imgW.toString());
            image.setAttribute('height', this.imgH.toString());
            image.setAttribute('preserveAspectRatio', 'none');
            this.mapRoot.appendChild(image);
        }

        this.rooms.forEach(room => {
            const polygon = document.createElementNS(this.svgNS, 'polygon');
            const pointsStr = room.polygon.map(pt => {
                const px = (pt[0] / 100) * this.imgW;
                const py = (pt[1] / 100) * this.imgH;
                return `${px},${py}`;
            }).join(' ');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('stroke-width', (this.imgW * 0.002).toString());

            if (room.name) {
                const { cx, cy } = this.getRoomLabelCenter(room);
                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('x', cx);
                text.setAttribute('y', cy);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'central');
                text.setAttribute('font-size', (this.imgW * 0.017).toString());
                text.setAttribute('fill', 'rgba(255, 255, 255, 0.96)');
                text.setAttribute('font-weight', '600');
                text.textContent = room.name;
                text.classList.add('room-label');
                text.dataset.roomId = room.id;

                // Save raw center for counter-rotation later
                text.rawCx = cx;
                text.rawCy = cy;
                this.mapRoot.appendChild(text);
            }

            polygon.classList.add('room-polygon');

            polygon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onRoomTap(room);
            });

            this.mapRoot.insertBefore(polygon, this.mapRoot.lastChild);
        });

        this.updateRoomStyles();

        this.buildWalls();

        this.shortcutElements = {};
        // Decor items (config.decor) live in their own sub-layer appended
        // before any interactive shortcut, so furniture always renders
        // beneath badges regardless of array order.
        this.decorLayer = document.createElementNS(this.svgNS, 'g');
        this.decorLayer.classList.add('dm-decor-layer');
        this.mapRoot.appendChild(this.decorLayer);
        this.shortcuts.forEach(sc => {
            const shortcutObj = ShortcutFactory.create(sc, this.svgNS, this.imgW, this.imgH, this);
            this.shortcutElements[sc.id] = shortcutObj;
            const parent = (sc.config && sc.config.decor) ? this.decorLayer : this.mapRoot;
            parent.appendChild(shortcutObj.render());

            if (this._hass) {
                shortcutObj.updateState(this._hass);
            }
        });

        this.buildAmbientTint();
        this.buildPresenceLayer();

        this.svg.appendChild(this.mapRoot);
        this.mapWrapper.appendChild(this.svg);
        this.renderRoot.appendChild(this.mapWrapper);

        // Clicking the background (not a room or a shortcut) exits room focus.
        this.svg.addEventListener('click', (e) => {
            if (this._cameraDragged) return;
            const t = e.target;
            if (t && t.closest && t.closest('.room-polygon, .shortcut-group')) return;
            if (this.focusedRoomId) this.zoomOutToDefault();
        });

        // Calculate geometry and rotation
        this.calculateAutoCrop();

        // Top-left UI container for overlay controls
        this.topLeftUI = document.createElement('div');
        this.topLeftUI.className = 'dm-top-ui';
        this.renderRoot.appendChild(this.topLeftUI);

        this.buildFloorSwitcher();
        this.buildRotationSwitcher();
        this.buildFocusPill();
        this.buildOutsideBar();

        if (this.cameraManager) this.cameraManager.destroy();
        this.cameraManager = new CameraManager(this.svg, this);

        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.lastTime = performance.now();
        this.animate(this.lastTime);
    }

    /** Paint the letterbox area around the map in the floor's background color. */
    applyFloorBackground() {
        // In 'fit' mode the plate itself carries the color; the letterbox
        // keeps the card surface so the layout silhouette stays visible.
        const paint = this.floorBgMode === 'fit' ? null : this.floorBgColor;
        if (this.renderRoot) this.renderRoot.style.background = paint || '';
    }

    /**
     * Background plate for 'fit' mode: the room polygons themselves, drawn
     * in the floor color with a fat round-joined stroke so adjacent rooms
     * merge into one padded, rounded silhouette of the layout.
     */
    buildRoomPlate() {
        const plate = document.createElementNS(this.svgNS, 'g');
        const color = this.floorBgColor || '#1e293b';
        const pad = Math.max(this.imgW, this.imgH) * 0.035;
        this.rooms.forEach(room => {
            const poly = document.createElementNS(this.svgNS, 'polygon');
            const pointsStr = room.polygon.map(pt =>
                `${(pt[0] / 100) * this.imgW},${(pt[1] / 100) * this.imgH}`
            ).join(' ');
            poly.setAttribute('points', pointsStr);
            poly.setAttribute('fill', color);
            poly.setAttribute('stroke', color);
            poly.setAttribute('stroke-width', (pad * 2).toString());
            poly.setAttribute('stroke-linejoin', 'round');
            poly.setAttribute('pointer-events', 'none');
            plate.appendChild(poly);
        });
        return plate;
    }

    buildFocusPill() {
        this.focusPill = document.createElement('button');
        this.focusPill.className = 'dm-focus-pill';
        this.focusPill.innerHTML = `<span class="dm-pill-label"></span><span class="dm-pill-x">✕</span>`;
        this.focusPill.addEventListener('click', (e) => {
            e.stopPropagation();
            this.zoomOutToDefault();
        });
        this.renderRoot.appendChild(this.focusPill);
    }

    /**
     * Fixed screen-space "outside" dashboard docked at the top of the card.
     * Items come from the global outside.json (managed in the Map Editor);
     * unlike shortcuts it never pans or zooms with the camera.
     */
    buildOutsideBar() {
        this.outsideBar = null;
        this._outsideEls = null;
        this.renderRoot.classList.remove('dm-has-outside');
        if (this.config.outside_bar === false) return;
        const items = this.outsideItems || [];
        if (!items.length) return;

        const bar = document.createElement('div');
        bar.className = 'dm-outside-bar';
        this._outsideEls = items.map(item => {
            const el = document.createElement('div');
            el.className = 'dm-outside-item';
            el.title = item.name || item.entity_id || '';
            el.innerHTML = `<span class="dm-outside-value"><span class="dm-oi-icon"></span><span class="dm-oi-text">—</span></span><span class="dm-outside-label"></span>`;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.entity_id) {
                    this.dispatchEvent(new CustomEvent('hass-more-info', {
                        detail: { entityId: item.entity_id }, bubbles: true, composed: true
                    }));
                }
            });
            bar.appendChild(el);
            return { el, item };
        });
        // Lives in the top flex row with the floor/rotation controls, so it
        // wraps to its own line instead of overlapping them on narrow cards.
        (this.topLeftUI || this.renderRoot).appendChild(bar);
        this.outsideBar = bar;
        this.renderRoot.classList.add('dm-has-outside');
        if (this._hass) this.updateOutsideBar(this._hass);
    }

    updateOutsideBar(hass) {
        if (!this._outsideEls) return;
        this._outsideEls.forEach(({ el, item }) => {
            const st = item.entity_id ? hass.states[item.entity_id] : null;
            let icon = item.icon || '';
            let value = '—';
            let label = item.name || '';

            if (st && st.state !== 'unavailable' && st.state !== 'unknown') {
                const isWeather = item.entity_id.startsWith('weather.');
                if (isWeather && !item.attribute) {
                    // Weather entity: condition icon + current temperature.
                    if (!icon) icon = WEATHER_ICONS[st.state] || '🌤️';
                    const temp = st.attributes.temperature;
                    value = (temp !== undefined && temp !== null)
                        ? `${temp}°`
                        : String(st.state).replace(/[-_]/g, ' ');
                    if (!label) label = String(st.state).replace(/[-_]/g, ' ');
                } else {
                    const raw = item.attribute ? st.attributes[item.attribute] : st.state;
                    const num = Number(raw);
                    if (raw === undefined || raw === null || raw === '') {
                        value = '—';
                    } else if (Number.isFinite(num)) {
                        value = String(Math.round(num * 10) / 10);
                        const unit = item.unit !== undefined ? item.unit : (st.attributes.unit_of_measurement || '');
                        if (unit) value += unit.startsWith('°') ? unit : ` ${unit}`;
                    } else {
                        value = String(raw).replace(/[-_]/g, ' ');
                    }
                }
            }

            el.classList.toggle('dm-unavailable', !st || st.state === 'unavailable' || st.state === 'unknown');
            el.querySelector('.dm-oi-icon').textContent = icon;
            el.querySelector('.dm-oi-icon').style.display = icon ? '' : 'none';
            el.querySelector('.dm-oi-text').textContent = value;
            const labelEl = el.querySelector('.dm-outside-label');
            labelEl.textContent = label;
            labelEl.style.display = label ? '' : 'none';
        });
    }

    getRoomLabelCenter(room) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        room.polygon.forEach(pt => {
            const px = (pt[0] / 100) * this.imgW;
            const py = (pt[1] / 100) * this.imgH;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        });
        return { cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2 };
    }

    /**
     * Room tap behavior, configurable via card config `room_tap_action` and
     * per-room `tap_action`: 'zoom' | 'toggle' | 'area_toggle' | 'more-info' | 'none'.
     * Default 'zoom': smoothly zooms the camera into the room, making its
     * shortcuts larger and easier to tap. Tapping the focused room again,
     * the room-name pill, or the background zooms back out.
     */
    onRoomTap(room) {
        // Multi-select mode (e.g. picking rooms for vacuum cleaning)
        if (this.isSelectingRooms) {
            if (this.selectedRoomIds.includes(room.id)) {
                this.selectedRoomIds = this.selectedRoomIds.filter(id => id !== room.id);
            } else {
                this.selectedRoomIds.push(room.id);
            }
            this.updateRoomStyles();
            return;
        }

        const action = room.tap_action || this.config.room_tap_action || 'zoom';

        switch (action) {
            case 'none':
                return;
            case 'more-info': {
                const entityId = room.entity_id;
                if (entityId && this._hass) {
                    this.dispatchEvent(new CustomEvent('hass-more-info', {
                        detail: { entityId }, bubbles: true, composed: true
                    }));
                }
                return;
            }
            case 'area_toggle':
                if (room.area_id && this._hass) {
                    this._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
                }
                return;
            case 'toggle':
                if (!this._hass) return;
                this.focusedRoomId = (this.focusedRoomId === room.id) ? null : room.id;
                this.updateRoomStyles();
                if (room.entity_id) {
                    const domain = room.entity_id.split('.')[0];
                    this._hass.callService(domain, 'toggle', { entity_id: room.entity_id });
                } else if (room.area_id) {
                    this._hass.callService('light', 'toggle', {}, { area_id: room.area_id });
                }
                return;
            case 'zoom':
            default:
                if (this.focusedRoomId === room.id) {
                    this.zoomOutToDefault();
                } else {
                    this.focusedRoomId = room.id;
                    this.zoomToRoom(room);
                    this.updateRoomStyles();
                    this.syncFocusPill();
                }
        }
    }

    /** Map a point from image coordinates into viewBox space (flips, then rotation). */
    mapPointToView(px, py) {
        const c = this.transformCenter;
        if (!c) return { x: px, y: py };
        let x = c.cx + (this.mapScaleX || 1) * (px - c.cx);
        let y = c.cy + (this.mapScaleY || 1) * (py - c.cy);
        if (this.isRotated) {
            const rx = c.cx - (y - c.cy);
            const ry = c.cy + (x - c.cx);
            x = rx;
            y = ry;
        }
        return { x, y };
    }

    /** Animate the camera into a room's bounding box. */
    zoomToRoom(room) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        room.polygon.forEach(pt => {
            const p = this.mapPointToView((pt[0] / 100) * this.imgW, (pt[1] / 100) * this.imgH);
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const bw = Math.max(maxX - minX, 1);
        const bh = Math.max(maxY - minY, 1);
        const cx = minX + bw / 2;
        const cy = minY + bh / 2;

        // Pad the room, then expand to the screen's aspect ratio.
        let w = bw * 1.24;
        let h = bh * 1.24;
        const rect = this.getBoundingClientRect();
        const ratio = (rect.width > 0 ? rect.width : 1) / (rect.height > 0 ? rect.height : 1);
        if (w / h < ratio) w = h * ratio;
        else h = w / ratio;

        // Respect the same minimum zoom window as manual pinch/wheel zoom.
        const minW = this.imgW * 0.05;
        if (w < minW) {
            h *= minW / w;
            w = minW;
        }

        this._zoomTargetVb = { x: cx - w / 2, y: cy - h / 2, w, h };
        this.animateViewBox(this._zoomTargetVb);
    }

    zoomOutToDefault() {
        this.focusedRoomId = null;
        this._zoomTargetVb = null;
        if (this.defaultVb) this.animateViewBox({ ...this.defaultVb });
        this.updateRoomStyles();
        this.syncFocusPill();
    }

    /** Smoothly interpolate the SVG viewBox to a target rectangle. */
    animateViewBox(target, duration = ZOOM_ANIMATION_MS) {
        if (this._vbAnimFrame) cancelAnimationFrame(this._vbAnimFrame);
        if (typeof requestAnimationFrame !== 'function') {
            this.vb = { ...target };
            this.updateViewBox();
            return;
        }
        const from = { ...this.vb };
        const start = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const k = ease(t);
            this.vb = {
                x: from.x + (target.x - from.x) * k,
                y: from.y + (target.y - from.y) * k,
                w: from.w + (target.w - from.w) * k,
                h: from.h + (target.h - from.h) * k
            };
            this.updateViewBox();
            this._vbAnimFrame = (t < 1) ? requestAnimationFrame(step) : null;
        };
        this._vbAnimFrame = requestAnimationFrame(step);
    }

    syncFocusPill() {
        if (!this.focusPill) return;
        const room = this.rooms.find(r => r.id === this.focusedRoomId);
        if (room) {
            this.focusPill.querySelector('.dm-pill-label').textContent = room.name || 'Room';
            this.focusPill.classList.add('dm-visible');
        } else {
            this.focusPill.classList.remove('dm-visible');
        }
    }

    /** Called by CameraManager when the user starts a manual pan/pinch/wheel. */
    onManualCameraStart() {
        if (this._vbAnimFrame) {
            cancelAnimationFrame(this._vbAnimFrame);
            this._vbAnimFrame = null;
        }
    }

    /** Called by CameraManager when a manual zoom snaps back to the full view. */
    onCameraReset() {
        if (this.focusedRoomId) {
            this.focusedRoomId = null;
            this.updateRoomStyles();
            this.syncFocusPill();
        }
    }

    calculateAutoCrop() {
        this.isRotated = false;
        this.focusedRoomId = null;
        this.syncFocusPill();

        if (this.rooms.length === 0) {
            this.vb = { x: 0, y: 0, w: this.imgW, h: this.imgH };
            this.defaultVb = { ...this.vb };
            this.updateViewBox();
            return;
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.rooms.forEach(r => {
            r.polygon.forEach(pt => {
                const px = (pt[0] / 100) * this.imgW;
                const py = (pt[1] / 100) * this.imgH;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
            });
        });

        const w = maxX - minX;
        const h = maxY - minY;
        const padX = w * 0.15;
        const padY = h * 0.15;

        let targetW = w + (padX * 2);
        let targetH = h + (padY * 2);
        const cx = minX + w / 2;
        const cy = minY + h / 2;

        const rect = this.getBoundingClientRect();
        const screenW = rect.width > 0 ? rect.width : 1;
        const screenH = rect.height > 0 ? rect.height : 1;
        const screenRatio = screenW / screenH;

        let shouldRotate = false;
        const isScreenLandscape = screenRatio > 1;
        const isMapLandscape = targetW > targetH;

        if (this.rotationMode === 'auto') {
            shouldRotate = isScreenLandscape !== isMapLandscape;
        } else if (this.rotationMode === 'horizontal') {
            shouldRotate = !isMapLandscape;
        } else if (this.rotationMode === 'vertical') {
            shouldRotate = isMapLandscape;
        }

        this.isRotated = shouldRotate;

        let scaleX = 1;
        let scaleY = 1;
        const finalIsHorizontal = isMapLandscape !== this.isRotated;
        const activeMode = finalIsHorizontal ? 'horizontal' : 'vertical';
        this.activeMode = activeMode;

        const currentFlips = this.flips[activeMode];
        if (this.isRotated) {
            if (currentFlips.h) scaleY = -1;
            if (currentFlips.v) scaleX = -1;
        } else {
            if (currentFlips.h) scaleX = -1;
            if (currentFlips.v) scaleY = -1;
        }

        this.mapScaleX = scaleX;
        this.mapScaleY = scaleY;
        this.transformCenter = { cx, cy };

        let transformStr = '';
        if (this.isRotated) transformStr += `rotate(90, ${cx}, ${cy}) `;
        if (scaleX !== 1 || scaleY !== 1) transformStr += `translate(${cx}, ${cy}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-cy})`;

        if (transformStr.trim()) {
            this.mapRoot.setAttribute('transform', transformStr.trim());

            this.mapRoot.querySelectorAll('.room-label').forEach(label => {
                let childTransformStr = `translate(${label.rawCx}, ${label.rawCy}) `;
                if (scaleX !== 1 || scaleY !== 1) childTransformStr += `scale(${scaleX}, ${scaleY}) `;
                if (this.isRotated) childTransformStr += `rotate(-90) `;
                childTransformStr += `translate(${-label.rawCx}, ${-label.rawCy})`;

                label.setAttribute('transform', childTransformStr);
            });
            this.applyShortcutTransforms(scaleX, scaleY);

            // Content rotated, swap target dimensions
            if (this.isRotated) {
                const temp = targetW;
                targetW = targetH;
                targetH = temp;
            }
        } else {
            this.mapRoot.removeAttribute('transform');
            this.mapRoot.querySelectorAll('.room-label').forEach(label => {
                label.removeAttribute('transform');
            });
            this.applyShortcutTransforms(1, 1);
        }

        const targetRatio = targetW / targetH;
        let finalW = targetW;
        let finalH = targetH;

        // Expand viewBox to perfectly match screen aspect ratio
        if (targetRatio < screenRatio) {
            finalW = targetH * screenRatio;
        } else {
            finalH = targetW / screenRatio;
        }

        this.vb = {
            x: cx - finalW/2,
            y: cy - finalH/2,
            w: finalW,
            h: finalH
        };

        this.defaultVb = { ...this.vb };
        this.updateViewBox();

        // Shortcut layouts resolve per-orientation props (scale, rotation,
        // tiling direction) at render time. When the active mode flips -
        // e.g. the first layout pass after load decides the map is rotated -
        // rebuild them NOW instead of leaving stale-orientation strips on
        // screen until the next hass state change happens to arrive.
        if (this._lastAppliedMode !== this.activeMode && this.shortcutElements && this._hass) {
            for (const id in this.shortcutElements) {
                this.shortcutElements[id].updateState(this._hass);
            }
            this.applyShortcutTransforms(this.isRotated ? this.mapScaleX : 1, this.isRotated ? this.mapScaleY : 1);
        }
        this._lastAppliedMode = this.activeMode;
    }

    /**
     * Walls from config_floorN.json: polylines with thickness, drawn as one
     * stroked path each so corners join cleanly. They sit above rooms and
     * below decor/shortcuts, rotate with the map like the floorplan itself,
     * and never intercept a tap.
     */
    buildWalls() {
        if (!this.walls || !this.walls.length || !this.mapRoot) return;
        const layer = document.createElementNS(this.svgNS, 'g');
        layer.classList.add('dm-walls');
        layer.style.pointerEvents = 'none';
        this.walls.forEach(wall => {
            const pts = wall.points || [];
            if (pts.length < 2) return;
            const path = document.createElementNS(this.svgNS, 'path');
            const d = pts.map((pt, i) =>
                `${i === 0 ? 'M' : 'L'} ${((pt[0] / 100) * this.imgW).toFixed(1)} ${((pt[1] / 100) * this.imgH).toFixed(1)}`
            ).join(' ');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', wall.color || '#0f172a');
            path.setAttribute('stroke-width', Number(wall.thickness) > 0 ? wall.thickness : 8);
            path.setAttribute('stroke-linecap', 'square');
            path.setAttribute('stroke-linejoin', 'miter');
            layer.appendChild(path);
        });
        this.mapRoot.appendChild(layer);
    }

    /** Apply per-shortcut counter-transforms for the current rotation/flip state. */
    applyShortcutTransforms(scaleX, scaleY) {
        if (!this.shortcutElements) return;
        const flipped = scaleX !== 1 || scaleY !== 1;
        Object.values(this.shortcutElements).forEach(scObj => {
            const isAutoRotate = scObj.getIsAutoRotateActive && scObj.getIsAutoRotateActive();
            let scTransformStr = '';
            if (flipped) scTransformStr += `scale(${scaleX}, ${scaleY}) `;
            if (this.isRotated && !isAutoRotate) scTransformStr += `rotate(-90) `;
            if (scObj.setTransformStr) scObj.setTransformStr(scTransformStr.trim());
            else if (scObj.setRotation) scObj.setRotation((this.isRotated && !isAutoRotate) ? -90 : 0);

            if (scObj.updateCoordinates) {
                scObj.updateCoordinates();
            }
        });
    }

    updateViewBox() {
        if (!this.svg) return;
        this.svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);

        if (this.mapWrapper) {
            this.mapWrapper.style.width = '100%';
            this.mapWrapper.style.height = '100%';
        }
    }

    set hass(hass) {
        this._hass = hass;

        if (this._needsFloorDiscovery) {
            this.discoverFloors(hass);
            return;
        }

        let needsStyleUpdate = false;
        for (const id in this.shortcutElements) {
            const sc = this.shortcutElements[id];
            const changed = sc.updateState(hass);
            // If the shortcut represents a room light and it changed state, we need to update room styles
            if (changed && sc.sc.type === 'light') {
                needsStyleUpdate = true;
            }
        }

        // Re-apply shortcut transforms in case their active autoRotate state changed
        if (this.shortcutElements) {
            const sX = this.mapScaleX !== undefined ? this.mapScaleX : 1;
            const sY = this.mapScaleY !== undefined ? this.mapScaleY : 1;
            this.applyShortcutTransforms(this.isRotated ? sX : 1, this.isRotated ? sY : 1);
        }

        // Only update room styles if something actually changed, or on first load
        if (needsStyleUpdate || !this._initialStylesRendered) {
            this.updateRoomStyles();
            this._initialStylesRendered = true;
        }

        this.updateOutsideBar(hass);
        this.updateAmbientTint(hass);
        this.updatePresence(hass);
    }

    /**
     * Day/night ambient tint: a full-map multiply overlay driven by sun.sun's
     * elevation - clear at day, warm around sunset, cool blue-grey at night.
     * Disable with `ambient_tint: false` in the card config.
     */
    buildAmbientTint() {
        this.ambientTint = null;
        if (this.config.ambient_tint === false) return;
        let el;
        if (this.rooms && this.rooms.length) {
            // Shape the tint to the house (the rooms), never the full canvas —
            // otherwise it darkens the empty margins around the plan (and, in
            // fit mode, spills past it entirely). A fattened plate covers the
            // walls just outside the room polygons; group opacity flattens the
            // overlapping rooms first, so multiply doesn't double-darken the
            // seams between adjacent rooms.
            el = document.createElementNS(this.svgNS, 'g');
            const pad = Math.max(this.imgW, this.imgH) * 0.02;
            this.rooms.forEach(room => {
                const poly = document.createElementNS(this.svgNS, 'polygon');
                poly.setAttribute('points', room.polygon.map(pt =>
                    `${(pt[0] / 100) * this.imgW},${(pt[1] / 100) * this.imgH}`).join(' '));
                poly.setAttribute('stroke-width', (pad * 2).toString());
                poly.setAttribute('stroke-linejoin', 'round');
                el.appendChild(poly);   // fill + stroke inherit from the group
            });
        } else {
            // No rooms defined yet: fall back to the full background.
            el = document.createElementNS(this.svgNS, 'rect');
            el.setAttribute('width', this.imgW.toString());
            el.setAttribute('height', this.imgH.toString());
        }
        el.classList.add('dm-ambient-tint');
        el.setAttribute('opacity', '0');
        el.style.pointerEvents = 'none';
        el.style.mixBlendMode = 'multiply';
        this.ambientTint = el;
        this.mapRoot.appendChild(el);
    }

    updateAmbientTint(hass) {
        if (!this.ambientTint || !hass || !hass.states) return;
        const sun = hass.states['sun.sun'];
        const elev = sun && sun.attributes ? Number(sun.attributes.elevation) : NaN;
        if (!Number.isFinite(elev)) {
            this.ambientTint.setAttribute('opacity', '0');
            return;
        }
        const lerp = (a, b, t) => a + (b - a) * t;
        const mix = (c1, c2, t) => `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(lerp(c1[2], c2[2], t))})`;
        const WARM = [255, 158, 87], NIGHT = [95, 116, 160];
        let color, opacity;
        if (elev >= 10) {
            opacity = 0;
            color = mix(WARM, WARM, 0);
        } else if (elev >= -4) {
            // golden hour: warm tint fading in as the sun drops from 10 to -4
            opacity = lerp(0, 0.18, (10 - elev) / 14);
            color = mix(WARM, WARM, 0);
        } else if (elev >= -10) {
            // dusk: warm shifts to a cool night tone
            const t = (-4 - elev) / 6;
            opacity = lerp(0.18, 0.3, t);
            color = mix(WARM, NIGHT, t);
        } else {
            opacity = 0.3;
            color = mix(NIGHT, NIGHT, 0);
        }
        this.ambientTint.setAttribute('fill', color);
        // In fit mode the plate is fattened with a stroke; the polygons
        // inherit both fill and stroke from the group.
        this.ambientTint.setAttribute('stroke', color);
        this.ambientTint.setAttribute('opacity', opacity.toFixed(3));
    }

    /**
     * Presence dots: card config `presence: [{entity, name?, color?}]` where
     * each entity's state names the room (room name, HA area id, or area
     * name - e.g. a Bermuda/ESPresense area sensor). The dot glides to that
     * room's center and hides when the person isn't on this floor.
     */
    buildPresenceLayer() {
        this._presenceDots = null;
        const items = Array.isArray(this.config.presence) ? this.config.presence : [];
        if (!items.length) return;
        const layer = document.createElementNS(this.svgNS, 'g');
        layer.classList.add('dm-presence-layer');
        layer.style.pointerEvents = 'none';
        const r = this.imgW * 0.016;
        this._presenceDots = items.filter(it => it && it.entity).map((it, idx) => {
            const el = document.createElementNS(this.svgNS, 'g');
            el.classList.add('dm-presence-dot');
            el.style.display = 'none';
            const circle = document.createElementNS(this.svgNS, 'circle');
            circle.setAttribute('r', r.toFixed(1));
            circle.setAttribute('fill', it.color || ['#f472b6', '#38bdf8', '#a3e635', '#fb923c'][idx % 4]);
            circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
            circle.setAttribute('stroke-width', (this.imgW * 0.004).toFixed(1));
            el.appendChild(circle);
            const initial = (it.name || it.entity.split('.')[1] || '?').trim().charAt(0).toUpperCase();
            const label = document.createElementNS(this.svgNS, 'text');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('font-size', (r * 1.1).toFixed(1));
            label.setAttribute('font-weight', '700');
            label.setAttribute('fill', '#ffffff');
            label.textContent = initial;
            el.appendChild(label);
            layer.appendChild(el);
            return { el, entity: it.entity, visible: false, curX: 0, curY: 0, tx: 0, ty: 0 };
        });
        this.presenceLayer = layer;
        this.mapRoot.appendChild(layer);
    }

    updatePresence(hass) {
        if (!this._presenceDots || !hass || !hass.states) return;
        const areas = hass.areas || {};
        const NOWHERE = ['', 'unknown', 'unavailable', 'not_home', 'away', 'none', 'off'];
        const byRoom = {};
        this._presenceDots.forEach(dot => {
            const st = hass.states[dot.entity];
            const s = st ? String(st.state).trim().toLowerCase() : '';
            let room = null;
            if (!NOWHERE.includes(s)) {
                room = this.rooms.find(rm => (rm.name || '').trim().toLowerCase() === s)
                    || this.rooms.find(rm => rm.area_id && String(rm.area_id).toLowerCase() === s)
                    || this.rooms.find(rm => rm.area_id && (areas[rm.area_id]?.name || '').trim().toLowerCase() === s);
            }
            if (!room) {
                dot.visible = false;
                dot.el.style.display = 'none';
                return;
            }
            (byRoom[room.id] = byRoom[room.id] || []).push({ dot, room });
        });
        for (const id in byRoom) {
            const group = byRoom[id];
            group.forEach(({ dot, room }, i) => {
                const c = MapGeometry.getPolygonCenter(room.polygon);
                const off = group.length > 1 ? this.imgW * 0.025 : 0;
                const angle = (i / group.length) * Math.PI * 2;
                dot.tx = (c[0] / 100) * this.imgW + Math.cos(angle) * off;
                dot.ty = (c[1] / 100) * this.imgH + Math.sin(angle) * off;
                if (!dot.visible) {
                    // First appearance: place directly, no glide from (0,0).
                    dot.curX = dot.tx;
                    dot.curY = dot.ty;
                    dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
                }
                dot.visible = true;
                dot.el.style.display = 'block';
            });
        }
    }

    updateRoomStyles() {
        if (!this.mapRoot) return;
        const anyFocus = !!this.focusedRoomId && !this.isSelectingRooms;
        const polygons = this.mapRoot.querySelectorAll('polygon.room-polygon');
        polygons.forEach((poly, idx) => {
            const room = this.rooms[idx];
            if (!room) return;

            const isFocused = (this.focusedRoomId === room.id);
            // Golden-angle hue spread gives distinct auto-colors per room index
            const hue = (idx * 137.5) % 360;
            const rgb = MapGeometry.hexToRgb(room.color);
            const baseColor = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : null;
            const solid = baseColor ? `rgb(${baseColor})` : `hsl(${hue}, 100%, 50%)`;
            const fillAt = (a) => baseColor ? `rgba(${baseColor}, ${a})` : `hsla(${hue}, 100%, 50%, ${a})`;

            let isOn = false;
            if (room.entity_id && this._hass) {
                const stateObj = this._hass.states[room.entity_id];
                if (stateObj && stateObj.state === 'on') isOn = true;
            }

            poly.classList.remove('dm-selected', 'dm-on');
            poly.classList.toggle('dm-dimmed', anyFocus && !isFocused);
            poly.style.removeProperty('--dm-room-glow');

            if (this.isSelectingRooms) {
                if (this.selectedRoomIds && this.selectedRoomIds.includes(room.id)) {
                    poly.setAttribute('fill', fillAt(0.8));
                    poly.setAttribute('stroke', '#10b981');
                    poly.style.setProperty('--dm-room-glow', '#10b981');
                    poly.classList.add('dm-on');
                } else {
                    poly.setAttribute('fill', 'rgba(0,0,0,0.4)');
                    poly.setAttribute('stroke', 'rgba(255,255,255,0.2)');
                }
                return;
            }

            if (isFocused) {
                // Nearly clear: the zoomed-in room should show the floorplan and
                // its shortcuts, not a colored veil.
                poly.setAttribute('fill', fillAt(0.08));
                poly.setAttribute('stroke', 'var(--dm-accent)');
                poly.classList.add('dm-selected');
            } else if (isOn) {
                poly.setAttribute('fill', fillAt(0.5));
                poly.setAttribute('stroke', solid);
                poly.style.setProperty('--dm-room-glow', solid);
                poly.classList.add('dm-on');
            } else {
                poly.setAttribute('fill', fillAt(0.18));
                poly.setAttribute('stroke', fillAt(0.7));
            }
        });

        // Dim other rooms' labels while one room has focus.
        this.mapRoot.querySelectorAll('.room-label').forEach(label => {
            label.classList.toggle('dm-dimmed', anyFocus && label.dataset.roomId !== String(this.focusedRoomId));
        });
    }

    animate(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        for (const id in this.shortcutElements) {
            const obj = this.shortcutElements[id];
            if (obj.animate) {
                obj.animate(deltaTime);
            }
        }

        if (this._presenceDots && Number.isFinite(deltaTime) && deltaTime > 0) {
            const k = 1 - Math.exp(-deltaTime * 3);
            this._presenceDots.forEach(dot => {
                if (!dot.visible) return;
                dot.curX += (dot.tx - dot.curX) * k;
                dot.curY += (dot.ty - dot.curY) * k;
                dot.el.setAttribute('transform', `translate(${dot.curX.toFixed(1)}, ${dot.curY.toFixed(1)})`);
            });
        }

        this.animationFrame = requestAnimationFrame((t) => this.animate(t));
    }

    getPolygonCenter(polygon) {
        return MapGeometry.getPolygonCenter(polygon);
    }

    isPointInPolygon(point, vs) {
        return MapGeometry.isPointInPolygon(point, vs);
    }

    getRandomPointInPolygon(polygon) {
        return MapGeometry.getRandomPointInPolygon(polygon);
    }

    showOverlay(shortcut, actions, event) {
        OverlayManager.showActionMenu(this, shortcut, actions, event);
    }

    showRoomSelectionUI() {
        OverlayManager.showRoomSelectionUI(this);
    }

    getCardSize() { return 3; }
}

if (!customElements.get('custom-svg-map')) {
    customElements.define('custom-svg-map', CustomSvgMap);
}
