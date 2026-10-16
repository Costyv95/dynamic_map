# Theming the dynamic_map card

The card's look comes from `--dm-*` CSS custom properties declared on its
`:host` (`card/CardStyles.js`). In Home Assistant the defaults follow the HA
theme (`--primary-color`, `--card-background-color`, ...). A host page
restyles the card by setting any of them on the `custom-svg-map` element. A
rule in the host document beats the card's own `:host` values, so no card
change is needed:

```css
custom-svg-map {
  --dm-accent: var(--home-accent);
  --dm-surface: var(--home-bg);
}
```

`tests/Theme.test.js` fails if the stylesheet reads a token that is not
declared, or if a declared token is missing from this list.

## Surface and text

| Token | Default | Used for |
|---|---|---|
| `--dm-accent` | HA `--primary-color` | active chips, selected room, switches, trend line |
| `--dm-on-accent` | `#ffffff` | text and thumbs on an accent fill |
| `--dm-surface` | HA card background | behind the map |
| `--dm-text` | HA primary text | chrome text |
| `--dm-muted` | HA secondary text | captions, counts, sheet handle |
| `--dm-border` | HA divider | hairlines |

## Glass chrome (chips, buttons, outside bar, room panel, search)

| Token | Default |
|---|---|
| `--dm-glass` | card background at 72% |
| `--dm-glass-strong` | card background at 94% (search box) |
| `--dm-glass-border` | divider at 45% |
| `--dm-blur` | `blur(14px) saturate(1.4)` (the backdrop-filter) |
| `--dm-shadow` | `0 8px 28px rgba(0,0,0,.18)` |
| `--dm-hover` | grey 14%, hover only on hover-capable pointers |
| `--dm-fill` | grey 16%, resting buttons and close circles |
| `--dm-fill-strong` | grey 30%, off switches and pressed hover |

## State colours

| Token | Default |
|---|---|
| `--dm-success` | `#10b981` |
| `--dm-warning` | `#d97706` |
| `--dm-danger` | HA `--error-color` |
| `--dm-info` | `#0ea5e9` |

## Shape, type and motion

| Token | Default |
|---|---|
| `--dm-radius-pill` | `999px` |
| `--dm-radius-lg` | `18px` (panels, sheets) |
| `--dm-radius-md` | `12px` (menus, rows) |
| `--dm-radius-sm` | `8px` (menu buttons) |
| `--dm-font` | HA font family |
| `--dm-font-size` | `13px` |
| `--dm-font-size-sm` | `11px` |
| `--dm-ease` | `ease` |
| `--dm-duration` | `0.2s` |
| `--dm-tap` | `36px`, raised to `44px` under `(pointer: coarse)` |

## Floor picture

| Token | Default |
|---|---|
| `--dm-floor-filter` | `none`. A CSS filter on the floor's background PNG. On a dark host, `invert(0.9) hue-rotate(180deg)` turns a white plan dark while the room colours (drawn on top) stay as designed. |

## HUD (long-press menus, sensor gauges, room selection)

These stay dark by default so they read over any map. A light host can
point them at its own surface.

| Token | Default |
|---|---|
| `--dm-hud-bg` | `rgba(15,23,42,.92)` |
| `--dm-hud-text` | `#ffffff` |
| `--dm-hud-muted` | `#94a3b8` |
| `--dm-hud-border` | white 15% |
| `--dm-hud-fill` | white 10% |
| `--dm-hud-fill-strong` | white 20% |
| `--dm-hud-accent` | `#38bdf8` (live slider readout) |
| `--dm-hud-shadow` | `0 16px 36px rgba(0,0,0,.5)` |

## Touch

Under `(pointer: coarse)` every control grows to `--dm-tap`
(`card/TouchStyles.js`). Hover tints apply only under `(hover: hover)`. On a
narrow card (< 600px) the room panel and the long-press menu dock to the
bottom edge as sheets. One-finger drags still scroll a dashboard; pinch
zooms the map. `prefers-reduced-motion` turns transitions off.
