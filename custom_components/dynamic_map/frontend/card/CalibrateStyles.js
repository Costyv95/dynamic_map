/** Calibrate positions (#1354): the panel, its button and the spot rings. Same glass as the search box. */
export const CALIBRATE_STYLES = `
    .dm-calib-btn.active { background: var(--dm-accent); color: var(--dm-on-accent); }
    .dm-calib {
        position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 30;
        width: min(420px, calc(100% - 28px)); box-sizing: border-box; padding: 12px 14px;
        display: flex; flex-direction: column; gap: 8px;
        background: var(--dm-glass-strong); border: 1px solid var(--dm-glass-border); border-radius: var(--dm-radius-lg);
        box-shadow: var(--dm-shadow); backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur);
        color: var(--dm-text); font-family: var(--dm-font); font-size: 14px;
    }
    .dm-calib-title { font-weight: 700; }
    .dm-calib-row { display: flex; gap: 8px; }
    .dm-calib-row select { flex: 1; min-height: 40px; padding: 0 10px; border-radius: var(--dm-radius-md); border: 1px solid var(--dm-border); background: var(--dm-surface); color: var(--dm-text); font: inherit; }
    .dm-calib-done { min-height: 40px; padding: 0 18px; border: 0; border-radius: var(--dm-radius-md); background: var(--dm-accent); color: var(--dm-on-accent); font: inherit; font-weight: 600; cursor: pointer; }
    .dm-calib-msg { color: var(--dm-muted); }
    .dm-calib-layer .dm-calib-spot { fill: color-mix(in srgb, var(--dm-info) 18%, transparent); stroke: var(--dm-info); stroke-width: 3; cursor: pointer; }
    .dm-calib-layer .dm-calib-spot.doomed { fill: color-mix(in srgb, var(--dm-danger) 30%, transparent); stroke: var(--dm-danger); }
    .dm-calib-layer .dm-calib-pending { fill: color-mix(in srgb, var(--dm-warning) 35%, transparent); stroke: var(--dm-warning); stroke-width: 3; animation: dm-calib-pulse 1s ease-in-out infinite alternate; }
    @keyframes dm-calib-pulse { from { opacity: 0.45; } to { opacity: 1; } }
`;
