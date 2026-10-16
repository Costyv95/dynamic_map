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

## Floor picture and decor

| Token | Default |
|---|---|
| `--dm-floor-paper` | unset. With `--dm-floor-ink`, the floor's own colours for a host that is not white: the card recolours the floor picture once (on a canvas, kept for the page) and draws the floor colour, the `fit` plate and grey walls in the same scale. White becomes paper, black becomes ink, and the greys blend between them; saturated colours (a coloured wall) stay as drawn. A hex or `rgb()` colour, e.g. `#0c111b`. Prefer this to a filter: nothing is repainted per frame and the result is designed rather than inverted. Toned surfaces ignore `--dm-floor-filter`. |
| `--dm-floor-ink` | unset. What black becomes on the floor (walls and furniture lines), e.g. `#7d879a`. The same tone recolours decor pictures (SVG greys are rewritten, raster decor goes through the canvas), so a toned decor layer ignores `--dm-object-filter`. Floors are kept for the page and the other floors are prepared while the card is idle, so a floor switch draws from memory. |
| `--dm-floor-filter` | `none`. A CSS filter on the floor itself: the background PNG, the floor colour under it, and in `fit` mode the room plate (which is drawn in the floor colour). Kept for hosts that want a filter; a dark host should set the paper and ink above instead. |
| `--dm-object-filter` | `none`. A CSS filter on decor shortcuts (furniture and other drawings marked `decor`). On a dark host, e.g. `brightness(0.75)`, or `invert(0.85) hue-rotate(180deg)` for line drawings. Device icons are not filtered: their colours and state images carry meaning. |
| `--dm-room-label` | unset. Room name colour. Unset, it is dark slate on the floor, in the floor tone when one is set (so it reads on a dark host too). |
| `--dm-room-label-halo` | unset. The thin outline behind room names that keeps them legible over furniture. Unset, the floor colour (toned). |

Furniture, doors and windows are vector drawings (`shared/Furniture.js`) in greys, so the floor tone maps them like the walls; no picture is toned for them.

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
narrow card (under 600px wide, or an upright card under 900px such as the wall tablet) the room panel and the long-press menu dock to the
bottom edge as sheets. One-finger drags still scroll a dashboard; pinch
zooms the map. `prefers-reduced-motion` turns transitions off.
