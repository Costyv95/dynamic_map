/** Card stylesheet: theme tokens with HA fallbacks, glass chrome, rooms. THEME.md documents the tokens. */
import { ROOM_PANEL_STYLES } from './RoomPanelStyles.js?v=3.2.1';
import { OVERLAY_STYLES } from './OverlayStyles.js?v=3.2.1';
import { TOUCH_STYLES } from './TouchStyles.js?v=3.2.1';
import { SEARCH_STYLES } from './SearchStyles.js?v=3.2.1';

export const CARD_STYLES = `
    :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 70vh; /* Fallback for non-panel views */
        position: relative;
        /* Theme tokens. Defaults follow the HA theme; a host page (Portal)
           overrides any --dm-* on the custom-svg-map element, which beats
           these :host values. THEME.md lists the contract. */
        --dm-accent: var(--primary-color, #0ea5e9);
        --dm-on-accent: #ffffff;
        --dm-surface: var(--card-background-color, #ffffff);
        --dm-text: var(--primary-text-color, #1e293b);
        --dm-muted: var(--secondary-text-color, #64748b);
        --dm-border: var(--divider-color, #e2e8f0);
        --dm-glass: color-mix(in srgb, var(--card-background-color, #ffffff) 72%, transparent);
        --dm-glass-strong: var(--dm-glass-strong);
        --dm-glass-border: color-mix(in srgb, var(--divider-color, #94a3b8) 45%, transparent);
        --dm-blur: blur(14px) saturate(1.4);
        --dm-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        --dm-hover: rgba(127, 127, 127, 0.14);
        --dm-fill: rgba(127, 127, 127, 0.16);
        --dm-fill-strong: rgba(127, 127, 127, 0.3);
        --dm-success: #10b981;
        --dm-warning: #d97706;
        --dm-danger: var(--error-color, #ef4444);
        --dm-info: #0ea5e9;
        --dm-radius-pill: 999px;
        --dm-radius-lg: 18px;
        --dm-radius-md: 12px;
        --dm-radius-sm: 8px;
        --dm-font: var(--primary-font-family, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
        --dm-font-size: 13px;
        --dm-font-size-sm: 11px;
        --dm-ease: ease;
        --dm-duration: 0.2s;
        /* Smallest tap target; raised on touch screens below. */
        --dm-tap: 36px;
        /* Long-press menus and the room-selection bar: a dark HUD by default. */
        /* Filter on the floor itself: its picture, the colour under it, and the 'fit' room plate
           (e.g. a dark host: invert(.9) hue-rotate(180deg)). */
        --dm-floor-filter: none;
        /* Filter on decor (furniture drawings). Device icons are left alone: their colours are state. */
        --dm-object-filter: none;
        /* The floor's own colours instead of a filter: white -> paper, black -> ink (FloorTone.js). */
        --dm-floor-paper: ;
        --dm-floor-ink: ;
        --dm-hud-bg: rgba(15, 23, 42, 0.92);
        --dm-hud-text: #ffffff;
        --dm-hud-muted: #94a3b8;
        --dm-hud-border: rgba(255, 255, 255, 0.15);
        --dm-hud-fill: rgba(255, 255, 255, 0.1);
        --dm-hud-fill-strong: rgba(255, 255, 255, 0.2);
        --dm-hud-accent: #38bdf8;
        --dm-hud-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
        font-family: var(--dm-font);
    }
    @media (pointer: coarse) {
        :host { --dm-tap: 44px; }
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
        border-radius: var(--dm-radius-pill);
        box-shadow: var(--dm-shadow);
        backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
    }
    .dm-chip {
        padding: 7px 16px;
        font-size: var(--dm-font-size);
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--dm-text);
        cursor: pointer;
        border-radius: var(--dm-radius-pill);
        transition: background var(--dm-duration) var(--dm-ease), color var(--dm-duration) var(--dm-ease), transform 0.15s ease;
        user-select: none;
        text-align: center;
        white-space: nowrap;
    }
    .dm-chip:active { transform: scale(0.96); }
    .dm-chip.active {
        background: var(--dm-accent);
        color: var(--dm-on-accent);
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
        border-radius: var(--dm-radius-pill);
        cursor: pointer;
        color: var(--dm-text);
        box-shadow: var(--dm-shadow);
        backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        transition: background var(--dm-duration) var(--dm-ease), transform 0.15s ease;
        padding: 0;
    }
    .dm-icon-btn:active { transform: scale(0.94); }
    .dm-outside-bar {
        display: flex;
        align-items: stretch;
        margin: 0 auto;
        padding: 5px 4px;
        background: var(--dm-glass);
        border: 1px solid var(--dm-glass-border);
        border-radius: var(--dm-radius-lg);
        box-shadow: var(--dm-shadow);
        backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
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
        border-radius: var(--dm-radius-md);
        transition: background var(--dm-duration) var(--dm-ease);
    }
    .dm-outside-item:not(:first-child) { border-left: 1px solid var(--dm-glass-border); border-radius: 0; }
    .dm-outside-item:last-child { border-radius: 0 12px 12px 0; }
    .dm-outside-item:first-child { border-radius: 12px 0 0 12px; }
    .dm-outside-item:only-child { border-radius: var(--dm-radius-md); }
    /* Items keep their width; a bar wider than the card scrolls sideways instead of overlapping. */
    .dm-outside-item { flex: none; }
    .dm-outside-item.dm-unavailable { opacity: 0.45; }
    .dm-outside-value {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: var(--dm-font-size);
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
        border-radius: var(--dm-radius-pill);
        box-shadow: var(--dm-shadow);
        backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        color: var(--dm-text);
        font-size: var(--dm-font-size);
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
        background: var(--dm-fill);
        transition: background var(--dm-duration) var(--dm-ease);
    }
    .dm-bg-image, .dm-bg-underlay, .dm-room-plate { filter: var(--dm-floor-filter); }
    .dm-bg-image.dm-toned, .dm-bg-underlay.dm-toned, .dm-room-plate.dm-toned { filter: none; }
    .dm-decor-layer { filter: var(--dm-object-filter); }
    .dm-decor-layer.dm-toned { filter: none; }
    .room-polygon {
        cursor: pointer;
        stroke-linejoin: round;
        transition: fill 0.3s ease, stroke 0.3s ease, filter 0.3s ease, opacity 0.35s ease;
    }
    .room-polygon.dm-on { filter: drop-shadow(0 0 10px var(--dm-room-glow, transparent)); }
    .room-polygon.dm-selected { filter: drop-shadow(0 0 8px var(--dm-accent)); }
    .room-polygon.dm-dimmed { opacity: 0.4; }
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
    .dm-error { color: var(--dm-danger); padding: 20px; font-size: 14px; }
    /* Quick-action chips */
    .dm-quick-actions { position: absolute; left: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 28px); z-index: 11; }
    .dm-quick-chip {
        display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px; border-radius: var(--dm-radius-pill); cursor: pointer;
        background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); color: var(--dm-text);
        font: inherit; font-size: var(--dm-font-size); font-weight: 600; backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        transition: background var(--dm-duration) var(--dm-ease), transform 0.15s ease, color var(--dm-duration) var(--dm-ease);
    }
    .dm-quick-chip[hidden] { display: none; }
    .dm-quick-chip:active, .dm-quick-chip.dm-fired { transform: scale(0.95); }
    .dm-quick-chip.dm-on { background: var(--dm-accent); border-color: var(--dm-accent); color: var(--dm-on-accent); }
    .dm-quick-chip.dm-armed { background: var(--dm-danger); border-color: var(--dm-danger); color: var(--dm-on-accent); }
    .dm-quick-chip.dm-unavailable { opacity: 0.45; }
    .dm-render-root.dm-room-panel-open .dm-quick-actions { max-width: calc(100% - 340px); }
    .dm-temp-legend { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: var(--dm-radius-pill); background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); font-size: var(--dm-font-size-sm); font-weight: 600; color: var(--dm-muted); z-index: 10; backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur); }
    .dm-tl-bar { width: 70px; height: 8px; border-radius: 4px; }
    .dm-render-root.dm-room-panel-open .dm-temp-legend { opacity: 0; pointer-events: none; }
    .dm-alert-legend { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: var(--dm-radius-pill); background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); font-size: var(--dm-font-size-sm); font-weight: 600; color: var(--dm-muted); z-index: 10; cursor: pointer; backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur); }
    .dm-alert-legend.dm-above-temp { bottom: 50px; }
    .dm-al-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .dm-al-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.8); }
    .dm-render-root.dm-room-panel-open .dm-alert-legend { opacity: 0; pointer-events: none; }
    /* The legends toggle [hidden]; their display:flex would otherwise keep an empty pill on screen. */
    .dm-alert-legend[hidden], .dm-temp-legend[hidden] { display: none; }
    .dm-room-alert circle { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
    /* Hover only where a pointer can hover, so touch never leaves rows stuck highlighted. */
    @media (hover: hover) {
        .dm-chip:hover:not(.active) { background: var(--dm-hover); }
        .dm-icon-btn:hover { background: var(--dm-hover); }
        .dm-outside-item:hover { background: var(--dm-hover); }
        .dm-focus-pill:hover .dm-pill-x { background: var(--dm-fill-strong); }
        .room-polygon:hover:not(.dm-selected):not(.dm-on) { filter: brightness(1.2); }
        .dm-quick-chip:hover { background: var(--dm-hover); }
        .dm-search-row:hover { background: var(--dm-hover); }
        .dm-room-alert:hover circle { stroke-width: 3; }
    }
` + ROOM_PANEL_STYLES + SEARCH_STYLES + OVERLAY_STYLES + TOUCH_STYLES;
