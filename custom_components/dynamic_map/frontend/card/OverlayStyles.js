/**
 * Long-press menus, sensor gauges and the room-selection bar. They share a
 * HUD look driven by the --dm-hud-* tokens (dark by default) so a host can
 * restyle them without touching the builders. Appended to CARD_STYLES.
 */
export const OVERLAY_STYLES = `
    .dm-overlay {
        background: var(--dm-hud-bg); color: var(--dm-hud-text);
        border: 1px solid var(--dm-hud-border); border-radius: var(--dm-radius-md);
        box-shadow: var(--dm-hud-shadow); backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        font-family: var(--dm-font); font-size: var(--dm-font-size); z-index: 1000;
    }
    .dm-overlay.dm-gauges { display: flex; gap: 20px; align-items: center; justify-content: center; padding: 16px 20px; border-radius: var(--dm-radius-lg); }
    .dm-ov-label { font-size: 12px; font-weight: 700; }
    .dm-ov-caption { font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--dm-hud-muted); }
    .dm-ov-value { font-weight: 700; color: var(--dm-hud-text); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .dm-ov-value.dm-big { font-size: 18px; }
    .dm-ov-value.dm-live { font-size: 15px; color: var(--dm-hud-accent); }
    .dm-ov-range { width: 100%; margin: 0; accent-color: var(--dm-hud-accent); cursor: pointer; }
    .dm-ov-warmth { accent-color: #f8fafc; border-radius: 999px; background: linear-gradient(to right, #ff9f43, #ffe2b8, #f8fafc, #cfe2ff); }
    .dm-ov-toggle { display: flex; justify-content: space-between; align-items: center; gap: 15px; padding: 6px 4px; }
    .dm-ov-toggle > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .dm-ov-switch { width: 36px; height: 20px; flex: none; border-radius: var(--dm-radius-pill); position: relative; cursor: pointer; background: var(--dm-hud-fill-strong); transition: background var(--dm-duration) var(--dm-ease); }
    .dm-ov-switch.dm-on { background: var(--dm-success); }
    .dm-ov-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; transition: left var(--dm-duration) var(--dm-ease); }
    .dm-ov-switch.dm-on .dm-ov-thumb { left: 18px; }
    .dm-ov-btn {
        display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px;
        background: var(--dm-hud-fill); color: var(--dm-hud-text); border: 1px solid var(--dm-hud-border);
        border-radius: var(--dm-radius-sm); cursor: pointer; font: inherit; font-size: var(--dm-font-size);
        transition: background var(--dm-duration) var(--dm-ease), transform 0.15s var(--dm-ease);
    }
    .dm-ov-btn:active { transform: scale(0.97); }
    .dm-ov-btn > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dm-ov-btn.dm-on-btn { color: var(--dm-success); border-color: color-mix(in srgb, var(--dm-success) 40%, transparent); }
    .dm-ov-btn.dm-off-btn { color: var(--dm-danger); border-color: color-mix(in srgb, var(--dm-danger) 40%, transparent); }
    .dm-ov-btn.dm-rooms-btn { color: var(--dm-info); border-color: color-mix(in srgb, var(--dm-info) 40%, transparent); }
    .dm-ov-info { display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 6px 10px; border-radius: var(--dm-radius-sm); background: var(--dm-hud-fill); border: 1px solid var(--dm-hud-border); box-sizing: border-box; }
    .dm-ov-bar-cap { display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--dm-hud-muted); }
    .dm-ov-track { width: 100%; border-radius: var(--dm-radius-pill); background: var(--dm-hud-fill-strong); overflow: hidden; }
    .dm-ov-armed { outline: 1px solid color-mix(in srgb, var(--dm-danger) 60%, transparent); border-radius: 6px; }
    .dm-ov-gauge-ring { stroke: var(--dm-hud-fill); }
    .dm-ov-divider { width: 1px; height: 80px; background: var(--dm-hud-fill); }
    .dm-room-select {
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1001;
        display: flex; flex-direction: column; gap: 15px; padding: 15px; width: max-content; max-width: calc(100% - 16px); box-sizing: border-box;
        background: var(--dm-hud-bg); color: var(--dm-hud-text); border: 1px solid var(--dm-hud-border); border-radius: var(--dm-radius-md);
        box-shadow: var(--dm-hud-shadow); backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur); font-family: var(--dm-font);
    }
    .dm-render-root.dm-narrow .dm-room-select { left: 8px; right: 8px; bottom: 8px; transform: none; width: auto; max-width: none; border-radius: var(--dm-radius-lg); }
    .dm-rs-title { text-align: center; font-weight: 700; font-size: 14px; }
    .dm-rs-row { display: flex; gap: 10px; justify-content: center; }
    .dm-rs-select { flex: 1; background: var(--dm-hud-fill); color: var(--dm-hud-text); border: 1px solid var(--dm-hud-border); border-radius: var(--dm-radius-sm); padding: 8px; font: inherit; }
    .dm-rs-select option { color: #111827; }
    .dm-rs-btn { padding: 10px; border-radius: var(--dm-radius-sm); cursor: pointer; font: inherit; font-weight: 600; color: var(--dm-hud-text); background: var(--dm-hud-fill); border: 1px solid var(--dm-hud-border); }
    .dm-rs-cancel { flex: 1; }
    .dm-rs-start { flex: 2; font-weight: 700; border: none; background: var(--dm-hud-fill-strong); transition: background var(--dm-duration) var(--dm-ease); }
    .dm-rs-start.dm-ready { background: var(--dm-success); color: #ffffff; }
    @media (hover: hover) {
        .dm-ov-btn:hover, .dm-rs-btn:hover { background: var(--dm-hud-fill-strong); }
        .dm-rs-start.dm-ready:hover { background: color-mix(in srgb, var(--dm-success) 85%, #000); }
    }
`;
