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
    .dm-cl-floor { font: inherit; color: var(--dm-text, inherit); background: var(--dm-fill); border: none; border-radius: var(--dm-radius-pill); padding: 3px 9px; margin: -3px -6px -3px 0; cursor: pointer; }
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
    /* Wide cards: the chores panel is a fixed column on the left; the camera frames the room beside it (RoomFocus).
       The doubled class outranks the phone-sheet rules, which also apply to the upright wall tablet. */
    .dm-render-root.dm-chores-dock .dm-room-panel.dm-room-panel {
        left: 0; top: 0; bottom: 0; right: auto; width: var(--dm-dock-w, 300px); max-height: none;
        border-radius: 0; border-width: 0 1px 0 0; background: var(--dm-surface); backdrop-filter: none; -webkit-backdrop-filter: none;
        transform: translateX(-16px);
    }
    .dm-render-root.dm-chores-dock .dm-room-panel.dm-room-panel.dm-visible { transform: translateX(0); }
    .dm-render-root.dm-chores-dock .dm-rp-handle { display: none; }
    .dm-render-root.dm-chores-dock .dm-rp-head { padding-top: 12px; }
    .dm-render-root.dm-chores-dock .dm-chores-list { flex: 1; }
    .dm-render-root.dm-chores-dock.dm-chores-dock .dm-top-ui, .dm-render-root.dm-chores-dock.dm-chores-dock .dm-quick-actions { left: calc(var(--dm-dock-w, 300px) + 14px); }
    /* Who's doing it: lower right; the legend steps up above it. */
    .dm-chores-who { position: absolute; right: 14px; bottom: 14px; z-index: 13; }
    .dm-chores-who[hidden] { display: none; }
    .dm-mode-chores .dm-chores-legend { bottom: 60px; }
    .dm-render-root.dm-has-outside .dm-chores-who { bottom: 64px; }
    .dm-render-root.dm-has-outside.dm-mode-chores .dm-chores-legend { bottom: 110px; }
    .dm-render-root.dm-narrow .dm-chores-who { right: 8px; bottom: 8px; }
    .dm-render-root.dm-narrow.dm-room-panel-open:not(.dm-chores-dock) .dm-chores-who { bottom: calc(38% + 16px); }
    .dm-render-root.dm-narrow:has(.dm-room-panel.dm-expanded) .dm-chores-who { display: none; }
    .dm-who-chip { font: inherit; border: none; }
    .dm-who-chip:not(.active) { background: transparent; }
    /* ✓ on the furniture a chore is about (ChoreObjects). */
    .dm-chore-objects { display: none; }
    .dm-mode-chores .dm-chore-objects { display: inline; }
    .dm-chore-obj { cursor: pointer; }
    .dm-chore-obj circle { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4)); transition: transform 0.15s; }
    .dm-chore-obj text { pointer-events: none; }
    .dm-chore-obj.dm-busy { cursor: default; opacity: 0.7; }
`;
