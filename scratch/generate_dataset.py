#!/usr/bin/env python3
"""Generate the full texture dataset for every shortcut in a dynamic_map data dir.

Reads shortcuts_floorN.json files, groups shortcuts by their `description` field
(set in the Map Editor's "Appearance" input), generates one SVG per unique
description via Claude (see generate_texture.py), and writes a preview.html
contact sheet next to the SVGs.

Shortcuts without a description get a generic subject derived from their type
("a sensor", "a light", ...) - not everything needs to look exactly like reality.

Usage:
    python3 scratch/generate_dataset.py /path/to/dynamic_map_data \
        --out ./generated_textures [--dry-run]

Auth: ANTHROPIC_API_KEY env var, or an `ant auth login` profile.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate_texture import build_prompt, extract_svg, validate  # noqa: E402

GENERIC_SUBJECTS = {
    "sensor": "a small smart-home sensor puck with a status LED",
    "light": "a simple modern light fixture with a warm glow",
    "switch": "a smart plug with a small power symbol shape",
    "vacuum": "a round robot vacuum seen from above",
    "media": "a small media speaker with a rounded grille",
    "generic": "a small rounded smart-home device",
}


STOPWORDS = {"a", "an", "the", "with", "of", "in", "on", "over", "next", "to", "and"}


def slugify(text: str) -> str:
    words = [w for w in re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
             if w not in STOPWORDS]
    slug = ""
    for w in words:
        if len(slug) + len(w) + 1 > 40:
            break
        slug = f"{slug}_{w}" if slug else w
    return slug or "device"


def collect(data_dir: Path):
    """Group every unique appearance: one artwork per shortcut description,
    plus one per state that carries its own description (the prompt combines
    shortcut + state descriptions, e.g. "a robot vacuum, parked on its dock")."""
    groups = {}

    def add(subject, user):
        key = slugify(subject)
        groups.setdefault(key, {"subject": subject, "used_by": []})
        groups[key]["used_by"].append(user)

    for f in sorted(data_dir.glob("shortcuts_floor*.json")):
        for sc in json.loads(f.read_text()):
            desc = (sc.get("description") or "").strip()
            subject = desc or GENERIC_SUBJECTS.get(sc.get("type", "generic"),
                                                   GENERIC_SUBJECTS["generic"])
            name = sc.get("name") or sc.get("entity_id") or sc.get("id")
            add(subject, name)
            for st in (sc.get("config") or {}).get("states") or []:
                st_desc = (st.get("description") or "").strip()
                if st_desc:
                    add(f"{subject}, {st_desc}", f"{name} ({st.get('name') or st_desc})")
    return groups


def write_preview(out_dir: Path, entries):
    cards = []
    for slug, subject, svg in entries:
        users = ""  # filled by caller note below
        cards.append(
            f'<div class="c"><div class="a">{svg}</div><h3>obj_{slug}</h3><p>{subject}</p></div>'
        )
    (out_dir / "preview.html").write_text(
        "<!doctype html><meta charset=utf-8><style>"
        "body{font:14px sans-serif;background:#ece7db;margin:16px}"
        ".g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}"
        ".c{background:#fff;border-radius:12px;padding:10px;text-align:center}"
        ".a svg{width:150px;height:150px}h3{margin:6px 0 2px;font-size:14px}p{margin:0;font-size:12px;opacity:.7}"
        f"</style><div class=g>{''.join(cards)}</div>",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir", help="dynamic_map_data directory (local copy is fine)")
    parser.add_argument("--out", default="./generated_textures")
    parser.add_argument("--model", default="claude-opus-4-8")
    parser.add_argument("--dry-run", action="store_true",
                        help="only print what would be generated")
    args = parser.parse_args()

    groups = collect(Path(args.data_dir))
    print(f"{len(groups)} unique appearances:")
    for slug, g in groups.items():
        print(f"  obj_{slug}  <- {', '.join(g['used_by'])}")
    if args.dry_run:
        return 0

    import anthropic
    client = anthropic.Anthropic()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for slug, g in groups.items():
        out_path = out_dir / f"obj_{slug}.svg"
        if out_path.exists():
            print(f"skip {out_path.name} (exists)")
            entries.append((slug, g["subject"], out_path.read_text()))
            continue
        with client.messages.stream(
            model=args.model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": build_prompt(g["subject"], "")}],
        ) as stream:
            response = stream.get_final_message()
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            svg = extract_svg(text)
            validate(svg)
        except ValueError as e:
            print(f"FAILED {slug}: {e}", file=sys.stderr)
            continue
        out_path.write_text(svg, encoding="utf-8")
        entries.append((slug, g["subject"], svg))
        print(f"wrote {out_path} ({len(svg)} bytes)")

    write_preview(out_dir, entries)
    print(f"preview: {out_dir}/preview.html")
    print("next: rsync the obj_*.svg files into dynamic_map_data/icons/ on the HA box")
    return 0


if __name__ == "__main__":
    sys.exit(main())
