/**
 * Touch screens (wall tablet, phone): every control grows to the --dm-tap
 * target (44px under a coarse pointer), and the long-press menu becomes a
 * bottom sheet on narrow cards. Desktop layout is untouched. Appended to
 * CARD_STYLES.
 */
export const TOUCH_STYLES = `
    .dm-render-root { -webkit-tap-highlight-color: transparent; }
    /* One finger still scrolls a dashboard; the card owns two-finger pinch (and pans once zoomed). */
    .dm-render-root > div > svg { touch-action: pan-x pan-y; }
    @media (pointer: coarse) {
        .dm-chip { min-height: var(--dm-tap); display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; font-size: 14px; }
        .dm-icon-btn { width: var(--dm-tap); height: var(--dm-tap); }
        .dm-outside-item { min-height: var(--dm-tap); min-width: var(--dm-tap); }
        .dm-focus-pill { min-height: var(--dm-tap); box-sizing: border-box; }
        .dm-focus-pill .dm-pill-x { width: 32px; height: 32px; }
        .dm-quick-chip { min-height: var(--dm-tap); padding: 0 16px; font-size: 14px; }
        .dm-search input { font-size: 16px; padding: 14px 16px; }
        .dm-search-row { min-height: var(--dm-tap); }
        .dm-rp-close { width: var(--dm-tap); height: var(--dm-tap); }
        .dm-rp-row { min-height: var(--dm-tap); font-size: 14px; }
        .dm-rp-scene, .dm-rp-btn, .dm-rp-alloff { min-height: var(--dm-tap); padding: 0 16px; font-size: var(--dm-font-size); }
        .dm-rp-stepper { gap: 8px; }
        .dm-rp-stepper button { width: var(--dm-tap); height: var(--dm-tap); font-size: 18px; }
        .dm-rp-switch { width: 46px; height: 28px; }
        .dm-rp-thumb { width: 24px; height: 24px; }
        .dm-rp-row.dm-on .dm-rp-thumb { left: 20px; }
        .dm-rp-slider { height: 32px; }
        .dm-rp-handle { width: 56px; height: 6px; margin-top: 10px; }
        .dm-ov-btn, .dm-ov-toggle, .dm-rs-btn, .dm-rs-select { min-height: var(--dm-tap); }
        .dm-ov-switch { width: 46px; height: 28px; }
        .dm-ov-switch .dm-ov-thumb { width: 24px; height: 24px; }
        .dm-ov-switch.dm-on .dm-ov-thumb { left: 20px; }
        .dm-ov-range { height: 32px; }
    }
    /* Narrow cards: floor chips and the round buttons share one row; the outside bar takes the next. */
    .dm-render-root.dm-narrow .dm-top-ui { top: 8px; left: 8px; right: 8px; gap: 6px; }
    .dm-render-root.dm-narrow .dm-chip { padding: 0 12px; }
    .dm-render-root.dm-narrow .dm-outside-bar { flex-basis: 100%; }
    /* Narrow cards: the long-press menu docks to the bottom edge like the room panel. */
    .dm-render-root.dm-narrow .dm-overlay.dm-sheet {
        left: 8px !important; right: 8px; top: auto !important; bottom: 8px; transform: none !important;
        max-width: none; width: auto; max-height: 60%; overflow-y: auto;
        border-radius: var(--dm-radius-lg); animation: dm-sheet-in 0.22s var(--dm-ease);
    }
    .dm-render-root.dm-narrow .dm-overlay.dm-sheet.dm-visual {
        left: 50% !important; right: auto; transform: translateX(-50%) !important; animation: none;
    }
    @keyframes dm-sheet-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
        .dm-render-root * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
    }
`;
