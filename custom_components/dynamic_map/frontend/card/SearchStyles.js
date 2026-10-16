/**
 * Search box, its result rows, and the pulse that marks a found shortcut on
 * the map. Appended to CARD_STYLES (hover rules stay in its hover block).
 */
export const SEARCH_STYLES = `
    .dm-search { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: min(420px, calc(100% - 28px)); z-index: 30; background: var(--dm-glass-strong); border: 1px solid var(--dm-glass-border); border-radius: var(--dm-radius-lg); box-shadow: var(--dm-shadow); backdrop-filter: var(--dm-blur); -webkit-backdrop-filter: var(--dm-blur); overflow: hidden; }
    .dm-search input { width: 100%; box-sizing: border-box; border: none; background: transparent; color: var(--dm-text); font: inherit; font-size: 15px; padding: 12px 16px; outline: none; }
    .dm-search-results { max-height: min(320px, 50vh); overflow-y: auto; border-top: 1px solid var(--dm-glass-border); padding: 4px; }
    .dm-search-results[hidden] { display: none; }
    .dm-search-row { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 10px; border-radius: var(--dm-radius-md); cursor: pointer; }
    .dm-search-icon { width: 22px; text-align: center; }
    .dm-search-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .dm-search-sub { color: var(--dm-muted); font-size: var(--dm-font-size-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
    .dm-search-empty { padding: 10px 14px; color: var(--dm-muted); font-size: 12px; }
    .dm-pulse { fill: none; stroke: var(--dm-accent); stroke-width: 3; transform-box: fill-box; transform-origin: center; animation: dm-pulse 1.3s ease-out 2; pointer-events: none; }
    @keyframes dm-pulse { 0% { transform: scale(0.4); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
`;
