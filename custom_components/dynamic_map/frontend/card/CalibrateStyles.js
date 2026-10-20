/** Calibrate positions (#1354): the guided panel, its button and the spot rings. Same glass as the search box. */
export const CALIBRATE_STYLES = `
    .dm-calib-btn.active { background: var(--dm-accent); color: var(--dm-on-accent); }
    :host(.dm-calibrating) .dm-quick-actions, :host(.dm-calibrating) .dm-temp-legend, :host(.dm-calibrating) .dm-alert-legend,
    :host(.dm-calibrating) .dm-room-panel, :host(.dm-calibrating) .dm-focus-pill { display: none !important; }
    .dm-calib {
        position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 40;
        width: min(460px, calc(100% - 20px)); box-sizing: border-box; padding: 12px 14px;
        display: flex; flex-direction: column; gap: 10px;
        background: var(--dm-glass-strong); border: 1px solid var(--dm-glass-border); border-radius: var(--dm-radius-lg);
        box-shadow: var(--dm-shadow); backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        color: var(--dm-text); font-family: var(--dm-font); font-size: 14px;
    }
    .dm-calib-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .dm-calib-title { font-weight: 700; font-size: 15px; }
    .dm-calib-done { min-height: var(--dm-tap, 36px); padding: 0 18px; border: 0; border-radius: var(--dm-radius-pill); background: var(--dm-accent); color: var(--dm-on-accent); font: inherit; font-weight: 600; cursor: pointer; }
    .dm-calib-who { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .dm-calib-label { color: var(--dm-muted); font-size: 12px; margin-right: 2px; }
    .dm-calib-chip { min-height: var(--dm-tap, 34px); padding: 0 14px; border-radius: var(--dm-radius-pill); border: 1px solid var(--dm-border); background: var(--dm-surface); color: var(--dm-text); font: inherit; font-size: 13px; cursor: pointer; }
    .dm-calib-chip.active { background: var(--dm-accent); border-color: var(--dm-accent); color: var(--dm-on-accent); font-weight: 600; }
    .dm-calib-chip:disabled { opacity: 0.6; cursor: default; }
    .dm-calib-step { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: var(--dm-radius-md); background: var(--dm-fill); }
    .dm-calib-num { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--dm-accent); color: var(--dm-on-accent); font-weight: 700; }
    .dm-calib-num.busy { background: var(--dm-warning); }
    .dm-calib-num.ok { background: var(--dm-success); }
    .dm-calib-words { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .dm-calib-headline { font-weight: 700; font-size: 15px; }
    .dm-calib-detail { color: var(--dm-muted); font-size: 13px; line-height: 1.35; }
    .dm-calib-bar { height: 6px; border-radius: var(--dm-radius-pill); background: var(--dm-fill-strong); overflow: hidden; margin-top: 4px; }
    .dm-calib-fill { height: 100%; background: var(--dm-warning); transition: width 1s linear; }
    .dm-calib-rooms { display: flex; gap: 5px; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; }
    .dm-calib-rooms::-webkit-scrollbar { display: none; }
    .dm-calib-room { flex: none; min-height: 30px; padding: 0 11px; border: 0; cursor: pointer; font-family: inherit; white-space: nowrap; border-radius: var(--dm-radius-pill); background: var(--dm-fill); color: var(--dm-muted); font-size: 12px; font-weight: 600; }
    .dm-calib-room.some { color: var(--dm-warning); }
    .dm-calib-room.ok { color: var(--dm-success); }
    .dm-calib-room.here { outline: 2px solid var(--dm-accent); outline-offset: -2px; color: var(--dm-text); }
    .dm-calib-layer .dm-calib-spot { fill: color-mix(in srgb, var(--dm-info) 18%, transparent); stroke: var(--dm-info); stroke-width: 3; cursor: pointer; }
    .dm-calib-layer .dm-calib-spot.doomed { fill: color-mix(in srgb, var(--dm-danger) 30%, transparent); stroke: var(--dm-danger); }
    .dm-calib-layer .dm-calib-pending { fill: color-mix(in srgb, var(--dm-warning) 35%, transparent); stroke: var(--dm-warning); stroke-width: 3; animation: dm-calib-pulse 1s ease-in-out infinite alternate; }
    @keyframes dm-calib-pulse { from { opacity: 0.45; } to { opacity: 1; } }
`;
