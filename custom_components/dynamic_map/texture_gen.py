"""Texture generation helpers: prompt building and SVG validation.

Pure logic (no Home Assistant imports) shared by the generate_texture HTTP
view; kept separate so the backend test-suite can exercise it directly.
The style recipe mirrors docs/textures.md - one artwork per object, the card
derives state looks automatically.
"""
import re
import xml.etree.ElementTree as ET

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_TEXTURE_MODEL = "claude-opus-4-8"

STYLE_RECIPE = """\
1. Canvas: viewBox="0 0 128 128", subject centered, ~8px breathing room on all
   sides. Transparent background - no backdrop rectangle.
2. Form language: flat illustration built from simple rounded shapes (ellipses,
   rounded rects, smooth paths). No photorealism, no 3D perspective - a
   straight-on or slight three-quarter view.
3. Color: 2-4 flat fills in saturated but slightly muted mid-tones. Shadow
   tones are the base color mixed toward #1e293b (never pure black); highlight
   tones mixed toward white.
4. Lighting: single key light from the top-left. One subtle linear gradient or
   a lighter overlay shape on upper-left surfaces; darker tone on lower-right.
5. Outline: thin rgba(30, 41, 59, 0.35) stroke, stroke-width="2",
   stroke-linejoin="round" on the main silhouette only.
6. Ground shadow: small ellipse under the object, fill="rgba(15, 23, 42, 0.18)",
   roughly 60% of the object's width.
7. Technical: pure vector - no <text>, no <image>, no external references, no
   scripts, no CSS classes. Inline attributes only. Keep it under ~4 KB."""

TILEABLE_ADDENDUM = """\
This texture must TILE seamlessly when repeated horizontally: elements spaced so
the pattern continues across the left/right canvas edges, full-bleed body, NO
ground shadow, and no outline on the cut edges (rules 1 and 6 do not apply)."""

# Decor scenery (furniture, plants, stairs) is drawn in the architectural
# floor-plan language of the magicplan backgrounds, so a generated table sits
# next to scanned furniture without looking pasted on.
DECOR_RECIPE = """\
1. Canvas: viewBox="0 0 128 128", subject centered, ~6px breathing room.
   Transparent background - no backdrop rectangle.
2. View: STRICT top-down orthographic plan view, the way an architect draws
   furniture on a floor plan. Never a side or three-quarter view.
3. Form language: minimal plan symbol - clean geometric outlines (rects with
   slightly rounded corners, circles, simple arcs). Suggest the object with as
   few shapes as possible: a couch is its seat outline plus back/armrest
   lines; a plant is a circle with a few leaf arcs inside.
4. Color: fill "#ffffff" (or "#f8fafc" for secondary surfaces) with ONE
   optional very muted accent at most (e.g. "#e2e8f0", or a desaturated green
   "#d3e3d3" for plant foliage). No saturated colors, no gradients.
5. Outline: every shape stroked "#0f172a", stroke-width="1.5",
   stroke-linejoin="round". Interior detail lines the same color at
   stroke-width="1".
6. No lighting, no shadows, no ground ellipse - plan symbols are flat.
7. Technical: pure vector - no <text>, no <image>, no external references, no
   scripts, no CSS classes. Inline attributes only. Keep it under ~3 KB."""


def style_recipe(style: str = "badge") -> str:
    """The drawing recipe for a texture style: 'badge' (default) or 'decor'."""
    return DECOR_RECIPE if style == "decor" else STYLE_RECIPE

FORBIDDEN = re.compile(
    r"<\s*(text|image|script|foreignObject)\b|href\s*=", re.IGNORECASE
)

FILENAME_RE = re.compile(r"obj_[a-z0-9_]{1,64}\.svg")

STOPWORDS = {"a", "an", "the", "with", "of", "in", "on", "over", "next", "to", "and"}


def slugify(text: str) -> str:
    """Word-boundary slug, capped at 40 chars, stopwords dropped."""
    words = [
        w
        for w in re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
        if w not in STOPWORDS
    ]
    slug = ""
    for w in words:
        if len(slug) + len(w) + 1 > 40:
            break
        slug = f"{slug}_{w}" if slug else w
    return slug or "device"


def build_prompt(subject: str, tileable: bool = False, style: str = "badge") -> str:
    recipe = style_recipe(style) + ("\n\n" + TILEABLE_ADDENDUM if tileable else "")
    return f"""You are the texture artist for a smart-home floorplan map. Draw a single
SVG artwork of: {subject}.

It must look like the real object (recognizable at 40px and crisp at 200px) and
follow this style recipe exactly, so it matches the rest of the texture set:

{recipe}

Reply with ONLY the complete <svg>...</svg> markup - no explanation, no code fence."""


def extract_svg(text: str) -> str:
    match = re.search(r"<svg\b.*?</svg>", text, re.DOTALL | re.IGNORECASE)
    if not match:
        raise ValueError("no <svg> element found in the model response")
    return match.group(0)


def validate_svg(svg: str) -> None:
    """Raise ValueError unless the SVG honors the technical recipe rules."""
    if FORBIDDEN.search(svg):
        raise ValueError(
            "SVG violates the technical rules (text/image/script/external refs)"
        )
    try:
        ET.fromstring(svg)
    except ET.ParseError as err:
        raise ValueError(f"malformed SVG: {err}") from err
    if len(svg) > 16384:
        raise ValueError("SVG too large")


def texture_filename(description: str, requested: str | None = None) -> str:
    """Safe icons/ filename for a texture (raises ValueError on bad input)."""
    if requested:
        if not FILENAME_RE.fullmatch(requested):
            raise ValueError("filename must match obj_<snake_name>.svg")
        return requested
    return f"obj_{slugify(description)}.svg"


def build_request_body(
    subject: str, model: str, tileable: bool = False, style: str = "badge"
) -> dict:
    return {
        "model": model or DEFAULT_TEXTURE_MODEL,
        "max_tokens": 16000,
        "thinking": {"type": "adaptive"},
        "messages": [
            {"role": "user", "content": build_prompt(subject, tileable, style)}
        ],
    }


def response_text(body: dict) -> str:
    """Concatenated text blocks of an Anthropic Messages API response."""
    return "".join(
        block.get("text", "")
        for block in body.get("content", [])
        if block.get("type") == "text"
    )
