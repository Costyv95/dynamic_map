/** Vacuum schedules sheet (overlay/vacuumSchedules.js); rides on the room-select sheet look. */
export const SCHEDULE_STYLES = `
    .dm-sched { width: min(420px, calc(100% - 16px)); max-height: calc(100% - 40px); overflow-y: auto; gap: 10px; }
    .dm-sc-head { justify-content: space-between; align-items: center; }
    .dm-sc-x { padding: 4px 10px; }
    .dm-sc-list, .dm-sc-form { display: flex; flex-direction: column; gap: 8px; }
    .dm-sc-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--dm-radius-sm); background: var(--dm-hud-fill); border: 1px solid var(--dm-hud-border); }
    .dm-sc-text { flex: 1; min-width: 0; cursor: pointer; }
    .dm-sc-when { font-weight: 700; font-size: 14px; }
    .dm-sc-what, .dm-sc-label, .dm-sc-empty { color: var(--dm-hud-muted); font-size: 12px; overflow-wrap: anywhere; }
    .dm-sc-empty { text-align: center; padding: 8px; }
    .dm-sc-del { padding: 6px 10px; }
    .dm-sc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .dm-sc-chip { padding: 6px 10px; border-radius: var(--dm-radius-pill); font: inherit; font-size: 13px; cursor: pointer; color: var(--dm-hud-text); background: var(--dm-hud-fill); border: 1px solid var(--dm-hud-border); }
    .dm-sc-chip[aria-pressed="true"] { background: var(--dm-info); border-color: var(--dm-info); color: #ffffff; }
    .dm-sc-status { color: var(--dm-danger); font-size: 12px; }
    .dm-sc-status:empty { display: none; }
    .dm-sched input.dm-rs-select { box-sizing: border-box; width: 100%; }
`;
