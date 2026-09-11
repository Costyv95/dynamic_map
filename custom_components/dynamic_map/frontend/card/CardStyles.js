/** Card stylesheet: theme tokens with HA fallbacks, glass chrome, rooms. */
import { ROOM_PANEL_STYLES } from './RoomPanelStyles.js?v=3.2.1';

export const CARD_STYLES = `
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
    /* Quick-action chips */
    .dm-quick-actions { position: absolute; left: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 28px); z-index: 11; }
    .dm-quick-chip {
        display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
        background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); color: var(--dm-text);
        font: inherit; font-size: 13px; font-weight: 600; backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4);
        transition: background 0.2s ease, transform 0.15s ease, color 0.2s ease;
    }
    .dm-quick-chip:hover { background: rgba(127, 127, 127, 0.14); }
    .dm-quick-chip:active, .dm-quick-chip.dm-fired { transform: scale(0.95); }
    .dm-quick-chip.dm-on { background: var(--dm-accent); border-color: var(--dm-accent); color: #fff; }
    .dm-quick-chip.dm-armed { background: var(--error-color, #ef4444); border-color: var(--error-color, #ef4444); color: #fff; }
    .dm-quick-chip.dm-unavailable { opacity: 0.45; }
    .dm-render-root.dm-room-panel-open .dm-quick-actions { max-width: calc(100% - 340px); }
    .dm-temp-legend { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); font-size: 11px; font-weight: 600; color: var(--dm-muted); z-index: 10; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .dm-tl-bar { width: 70px; height: 8px; border-radius: 4px; }
    .dm-render-root.dm-room-panel-open .dm-temp-legend { opacity: 0; pointer-events: none; }
    .dm-alert-legend { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: 999px; background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); font-size: 11px; font-weight: 600; color: var(--dm-muted); z-index: 10; cursor: pointer; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .dm-alert-legend.dm-above-temp { bottom: 50px; }
    .dm-al-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .dm-al-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.8); }
    .dm-render-root.dm-room-panel-open .dm-alert-legend { opacity: 0; pointer-events: none; }
    .dm-room-alert circle { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
    /* Search */
    .dm-search { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: min(420px, calc(100% - 28px)); z-index: 30; background: color-mix(in srgb, var(--card-background-color, #ffffff) 94%, transparent); border: 1px solid var(--dm-glass-border); border-radius: 18px; box-shadow: var(--dm-shadow); backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); overflow: hidden; }
    .dm-search input { width: 100%; box-sizing: border-box; border: none; background: transparent; color: var(--dm-text); font: inherit; font-size: 15px; padding: 12px 16px; outline: none; }
    .dm-search-results { max-height: min(320px, 50vh); overflow-y: auto; border-top: 1px solid var(--dm-glass-border); padding: 4px; }
    .dm-search-results[hidden] { display: none; }
    .dm-search-row { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 10px; border-radius: 10px; cursor: pointer; }
    .dm-search-row:hover { background: rgba(127,127,127,0.14); }
    .dm-search-icon { width: 22px; text-align: center; }
    .dm-search-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .dm-search-sub { color: var(--dm-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
    .dm-search-empty { padding: 10px 14px; color: var(--dm-muted); font-size: 12px; }
    .dm-pulse { fill: none; stroke: var(--dm-accent); stroke-width: 3; transform-box: fill-box; transform-origin: center; animation: dm-pulse 1.3s ease-out 2; pointer-events: none; }
    @keyframes dm-pulse { 0% { transform: scale(0.4); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
    .dm-room-alert:hover circle { stroke-width: 3; }
    .dm-rp-attention { padding: 6px 6px 0; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid var(--dm-glass-border); padding-bottom: 6px; }
    .dm-rp-subhead { padding: 4px 8px 2px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dm-muted); }
    .dm-rp-alert .dm-rp-value { font-weight: 600; }
    .dm-rp-alert-open .dm-rp-value { color: #d97706; }
    .dm-rp-alert-danger .dm-rp-value { color: #dc2626; }
    .dm-rp-alert-unavailable { opacity: 0.75; }
` + ROOM_PANEL_STYLES;
