#!/usr/bin/env python3
"""Generate a Dynamic Map object texture (SVG) with Claude.

Every texture follows the style recipe in docs/textures.md so the whole set
stays visually consistent. One artwork per object is enough — the card derives
on/off/unavailable looks automatically.

Usage:
    python3 scratch/generate_texture.py "flamingo lamp" \
        --detail "a pink flamingo-shaped table lamp, warm bulb glow inside the body"

Auth: ANTHROPIC_API_KEY env var, or an `ant auth login` profile (the zero-arg
client resolves both).
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

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

FORBIDDEN = re.compile(r"<\s*(text|image|script|foreignObject)\b|href\s*=", re.IGNORECASE)


def build_prompt(name: str, detail: str) -> str:
    return f"""You are the texture artist for a smart-home floorplan map. Draw a single
SVG artwork of: {name}.
{f"Details: {detail}" if detail else ""}

It must look like the real object (recognizable at 40px and crisp at 200px) and
follow this style recipe exactly, so it matches the rest of the texture set:

{STYLE_RECIPE}

Reply with ONLY the complete <svg>...</svg> markup - no explanation, no code fence."""


def extract_svg(text: str) -> str:
    match = re.search(r"<svg\b.*?</svg>", text, re.DOTALL | re.IGNORECASE)
    if not match:
        raise ValueError("no <svg> element found in the response")
    return match.group(0)


def validate(svg: str) -> None:
    if FORBIDDEN.search(svg):
        raise ValueError("SVG violates the technical rules (text/image/script/external refs)")
    ET.fromstring(svg)  # raises on malformed XML
    if 'viewBox="0 0 128 128"' not in svg.replace("'", '"'):
        print("warning: viewBox is not 0 0 128 128", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help='object name, e.g. "flamingo lamp"')
    parser.add_argument("--detail", default="", help="extra description for the artist")
    parser.add_argument("--out", default="./generated_textures", help="output directory")
    parser.add_argument("--model", default="claude-opus-4-8")
    args = parser.parse_args()

    import anthropic
    client = anthropic.Anthropic()
    with client.messages.stream(
        model=args.model,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": build_prompt(args.name, args.detail)}],
    ) as stream:
        response = stream.get_final_message()

    if response.stop_reason == "max_tokens":
        print("error: response truncated (max_tokens) - retry", file=sys.stderr)
        return 1

    text = next((b.text for b in response.content if b.type == "text"), "")
    svg = extract_svg(text)
    validate(svg)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "_", args.name.lower()).strip("_")
    out_path = out_dir / f"obj_{slug}.svg"
    out_path.write_text(svg, encoding="utf-8")
    print(f"wrote {out_path} ({len(svg)} bytes)")
    print("next: copy it into dynamic_map_data/icons/ on the HA box")
    return 0


if __name__ == "__main__":
    sys.exit(main())
