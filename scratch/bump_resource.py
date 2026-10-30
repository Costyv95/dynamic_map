#!/usr/bin/env python3
"""Point the card's Lovelace resource at a new ?v= stamp over HA's websocket.

Usage: bump_resource.py VERSION
Uses ha_agent's HAWS client (HA_AGENT_SCRIPTS, default
~/workspace/ha_agent/scripts/ha). Exits non-zero on any failure so deploy.sh
can fall back to the file edit + restart.
"""
import os
import sys

CARD = "/dynamic_map_ui/custom-svg-map.js"


def main(version):
    sys.path.insert(0, os.path.expanduser(
        os.environ.get("HA_AGENT_SCRIPTS", "~/workspace/ha_agent/scripts/ha")))
    from ha_ws import HAWS

    with HAWS() as ha:
        items = [r for r in ha.result({"type": "lovelace/resources"}) if r["url"].startswith(CARD)]
        if not items:
            sys.exit(f"{CARD} not in Lovelace resources")
        for r in items:
            ha.result({"type": "lovelace/resources/update", "resource_id": r["id"],
                       "res_type": r["type"], "url": f"{CARD}?v={version}"})
    print(f"Lovelace resource updated to {version} (no restart)")


if __name__ == "__main__":
    main(sys.argv[1])
