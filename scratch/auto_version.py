#!/usr/bin/env python3
"""Stamp cache-busting ?v= version strings into a (build copy of the) frontend.

Usage: auto_version.py [frontend_dir]

Intended to run against a temporary build directory during deploy so the
repository sources keep clean, release-versioned import specifiers.
The resolved version string is written to scratch/current_version.txt for
deploy.sh to reuse (Lovelace resource URL update).
"""
import json
import os
import re
import subprocess
import sys
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_FRONTEND = os.path.join(REPO_ROOT, "custom_components", "dynamic_map", "frontend")
MANIFEST_PATH = os.path.join(REPO_ROOT, "custom_components", "dynamic_map", "manifest.json")
VERSION_FILE = os.path.join(REPO_ROOT, "scratch", "current_version.txt")

VERSION_QUERY_RE = re.compile(r"\?v=[a-zA-Z0-9.\-_]+")
VERSION_LOG_RE = re.compile(r"\(Version:\s*[a-zA-Z0-9.\-_]+\)")


def base_version():
    try:
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            return json.load(f)["version"]
    except (OSError, KeyError, ValueError):
        return "0.0.0"


def get_auto_version():
    version = base_version()
    try:
        commit_hash = subprocess.check_output(
            ["git", "log", "-1", "--format=%h"], text=True, cwd=REPO_ROOT
        ).strip()
        is_dirty = subprocess.check_output(
            ["git", "status", "--porcelain"], text=True, cwd=REPO_ROOT
        ).strip() != ""
    except Exception:
        commit_hash = "local"
        is_dirty = True

    if is_dirty:
        # Append current time to force cache-busting for uncommitted local edits
        return f"{version}-{commit_hash}-dev-{time.strftime('%H%M%S')}"
    return f"{version}-{commit_hash}"


def stamp_frontend(frontend_dir, version_str):
    stamped = 0
    for root, dirs, files in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "tests")]
        for file in files:
            if not file.endswith((".js", ".html")):
                continue
            file_path = os.path.join(root, file)
            with open(file_path, encoding="utf-8") as f:
                content = f.read()

            new_content = VERSION_QUERY_RE.sub(f"?v={version_str}", content)
            new_content = VERSION_LOG_RE.sub(f"(Version: {version_str})", new_content)

            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                stamped += 1
    return stamped


def main():
    frontend_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FRONTEND
    version_str = get_auto_version()
    print(f"=== Auto-Versioning: {version_str} ===")

    count = stamp_frontend(frontend_dir, version_str)
    print(f"Stamped {count} file(s) under {frontend_dir}")

    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        f.write(version_str)
    print(f"Saved version to {VERSION_FILE}")


if __name__ == "__main__":
    main()
