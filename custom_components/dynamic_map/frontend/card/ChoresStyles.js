/** Chores mode (Lights | Chores switch, chore badges, chores in the room panel) — appended to ROOM_PANEL_STYLES. */
export const CHORES_STYLES = `
    .dm-mode-toggle[hidden] { display: none; }
    .dm-mode-count:not(:empty) { margin-left: 6px; padding: 0 6px; border-radius: var(--dm-radius-pill); background: var(--dm-danger); color: white; font-size: var(--dm-font-size-sm); }
    /* Chores mode: devices step back, the rooms carry the chore colours. */
    .dm-chore-badges { display: none; }
    .dm-mode-chores .dm-chore-badges { display: inline; }
    .dm-chore-badge { cursor: pointer; }
    .dm-chore-badge circle { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
    .dm-mode-chores .shortcut-group { opacity: 0.18; pointer-events: none; transition: opacity var(--dm-duration) var(--dm-ease); }
    .dm-mode-chores .dm-decor-layer .shortcut-group { opacity: 1; }
    .dm-mode-chores .dm-room-alerts, .dm-mode-chores .dm-ambient-tint,
    .dm-mode-chores .dm-alert-legend, .dm-mode-chores .dm-temp-legend { display: none; }
    /* The glow sets an inline display, so hide it by visibility. */
    .dm-mode-chores .dm-light-glow { visibility: hidden; }
    .dm-chores-legend { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: var(--dm-radius-pill); background: var(--dm-glass); border: 1px solid var(--dm-glass-border); box-shadow: var(--dm-shadow); font-size: var(--dm-font-size-sm); font-weight: 600; color: var(--dm-muted); z-index: 10; backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur); }
    .dm-chores-legend[hidden] { display: none; }
    .dm-render-root.dm-room-panel-open .dm-chores-legend { opacity: 0; pointer-events: none; }
    .dm-cl-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .dm-cl-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.8); }
    /* Chore rows in the room panel. */
    .dm-chores-list { gap: 4px; }
    .dm-chore-row { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: var(--dm-radius-md); background: var(--dm-fill); border-left: 3px solid var(--dm-success); }
    .dm-chore-row.dm-chore-overdue { border-left-color: var(--dm-danger); }
    .dm-chore-row.dm-chore-due { border-left-color: var(--dm-warning); }
    .dm-chore-main { display: flex; align-items: baseline; gap: 8px; }
    .dm-chore-title { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dm-chore-status { font-size: 12px; font-weight: 600; white-space: nowrap; color: var(--dm-muted); }
    .dm-chore-overdue .dm-chore-status { color: var(--dm-danger); }
    .dm-chore-due .dm-chore-status { color: var(--dm-warning); }
    .dm-chore-sub { font-size: 12px; color: var(--dm-muted); }
    .dm-chore-who { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
    .dm-chore-who:empty { display: none; }
    .dm-chore-done { min-height: var(--dm-tap, 32px); }
    .dm-chore-done:disabled { opacity: 0.55; cursor: default; }
    .dm-chore-done.dm-on { opacity: 1; background: var(--dm-success); color: white; }
    .dm-chore-error { font-size: 12px; color: var(--dm-danger); }
`;
