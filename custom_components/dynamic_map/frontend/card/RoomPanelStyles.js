/** Room panel (glass sheet listing the area's devices) — appended to CARD_STYLES. */
export const ROOM_PANEL_STYLES = `
    /* Room panel: opens with a room's zoom, lists the area's devices. */
    .dm-room-panel {
        position: absolute; right: 14px; bottom: 14px; width: min(300px, calc(100% - 28px)); max-height: min(60%, 420px);
        display: flex; flex-direction: column; background: var(--dm-glass); border: 1px solid var(--dm-glass-border);
        border-radius: 18px; box-shadow: var(--dm-shadow); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4);
        color: var(--dm-text); font-size: 13px; z-index: 12; opacity: 0; pointer-events: none; transform: translateY(12px);
        transition: opacity 0.25s ease, transform 0.25s ease; overflow: hidden;
    }
    .dm-room-panel.dm-visible { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .dm-rp-head { display: flex; align-items: center; gap: 8px; padding: 10px 10px 8px 16px; border-bottom: 1px solid var(--dm-glass-border); }
    .dm-rp-title { font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dm-rp-count { font-size: 11px; color: var(--dm-muted); }
    .dm-rp-close { width: 28px; height: 28px; border: none; border-radius: 50%; background: rgba(127,127,127,0.16); color: inherit; cursor: pointer; font-size: 12px; }
    .dm-rp-list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
    .dm-rp-empty { padding: 14px 16px; color: var(--dm-muted); font-size: 12px; line-height: 1.4; }
    .dm-rp-row { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 4px 8px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
    .dm-rp-row:hover { background: rgba(127,127,127,0.12); }
    .dm-rp-icon { width: 22px; text-align: center; font-size: 15px; }
    .dm-rp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dm-rp-value { color: var(--dm-muted); font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 12px; }
    .dm-rp-row.dm-on .dm-rp-value { color: var(--dm-accent); font-weight: 600; }
    .dm-rp-row.dm-rp-unavailable { opacity: 0.55; }
    .dm-rp-trend { display: flex; align-items: center; gap: 10px; padding: 6px 16px 4px; color: var(--dm-accent); border-bottom: 1px solid var(--dm-glass-border); }
    .dm-rp-trend svg { flex: 1; height: 26px; min-width: 0; }
    .dm-rp-trend-label { font-size: 11px; font-weight: 600; color: var(--dm-muted); white-space: nowrap; }
    .dm-rp-scenes { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px 4px; }
    .dm-rp-scene { min-height: 30px; padding: 4px 12px; border: 1px solid var(--dm-glass-border); border-radius: 999px; background: rgba(127,127,127,0.12); color: inherit; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; transition: background 0.2s, transform 0.15s; }
    .dm-rp-scene:hover { background: rgba(127,127,127,0.22); }
    .dm-rp-scene.dm-fired { background: var(--dm-accent); color: #fff; transform: scale(0.96); }
    .dm-rp-row.dm-rp-dim { flex-wrap: wrap; }
    .dm-rp-slider { flex: 0 0 calc(100% - 34px); order: 10; margin: 0 4px 4px 30px; height: 22px; accent-color: var(--dm-accent); cursor: pointer; min-width: 0; }
    .dm-rp-alloff { min-height: 26px; padding: 2px 10px; border: 1px solid var(--dm-glass-border); border-radius: 999px; background: rgba(127,127,127,0.12); color: inherit; cursor: pointer; font: inherit; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .dm-rp-alloff:hover { background: rgba(127,127,127,0.22); }
    .dm-rp-row.dm-rp-unavailable .dm-rp-value { font-style: italic; }
    .dm-rp-switch { width: 34px; height: 20px; border-radius: 10px; background: rgba(127,127,127,0.35); position: relative; flex: none; transition: background 0.2s; }
    .dm-rp-row.dm-on .dm-rp-switch { background: var(--dm-accent); }
    .dm-rp-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.2s; }
    .dm-rp-row.dm-on .dm-rp-thumb { left: 16px; }
    .dm-rp-btn { min-height: 28px; padding: 2px 10px; border: 1px solid var(--dm-glass-border); border-radius: 999px; background: rgba(127,127,127,0.12); color: inherit; cursor: pointer; font-size: 12px; font-weight: 600; }
    .dm-rp-stepper { display: flex; gap: 4px; }
    .dm-rp-stepper button { width: 28px; height: 28px; border: 1px solid var(--dm-glass-border); border-radius: 50%; background: rgba(127,127,127,0.12); color: inherit; cursor: pointer; font-size: 14px; }
    .dm-render-root.dm-has-outside .dm-room-panel { bottom: 64px; }
    .dm-render-root.dm-room-panel-open .dm-focus-pill { opacity: 0; pointer-events: none; }
`;
