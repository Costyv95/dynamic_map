#!/usr/bin/env python3
"""Decide whether a dynamic_map deploy needs an HA core restart.

Reads `rsync --itemize-changes` (dry run, checksum) on stdin and prints
"restart" when anything outside frontend/ would change, else "frontend".
Frontend files are served from disk under stamped URLs, so a frontend-only
deploy needs only the Lovelace resource bump, not a restart (each restart
drops HA for about a minute: the wall's Map says HA is not answering).
"""
import sys

CHANGE_MARKS = "<>ch*"  # sent, received, created, hard link, *deleting


def changed_paths(lines):
    for line in lines:
        line = line.rstrip("\n")
        if not line or line[0] not in CHANGE_MARKS:
            continue
        parts = line.split(None, 1)
        if len(parts) == 2:
            yield parts[1].strip()


def needs_restart(lines):
    # HA's own __pycache__ on the box is not in the build, so rsync deletes it.
    return any(not p.startswith("frontend/") and "__pycache__" not in p
               for p in changed_paths(lines))


if __name__ == "__main__":
    print("restart" if needs_restart(sys.stdin) else "frontend")
