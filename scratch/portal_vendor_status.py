#!/usr/bin/env python3
"""Is Portal's vendored copy of the card current and unmodified? (#1701)

Portal vendors custom_components/dynamic_map/frontend into
programs/map/components/map/vendor/dynamic_map/ and pins the commit in
SOURCE.json. This compares both repos' origin/main through git, so neither
working tree has to be clean:

- modified: a vendored file differs from (or is absent in) the source at the
  pinned commit. Portal carries only the card subset, so source files it
  does not vendor (editor, tests) are not reported;
- behind:   dynamic_map commits since the pinned commit that touch a file
  Portal vendors.

Exit 0 when current, 1 when behind or modified, 2 when a repo can't be read.
Paths: DYNAMIC_MAP_REPO, PORTAL_REPO (default ~/workspace/<name>).
"""
import json
import os
import subprocess
import sys

SRC_PATH = "custom_components/dynamic_map/frontend"
VENDOR_PATH = "programs/map/components/map/vendor/dynamic_map"
OWN_FILES = {"SOURCE.json"}


def git(repo, *args):
    return subprocess.run(
        ["git", "-C", repo, *args], check=True, capture_output=True
    ).stdout


def tree(repo, rev, path):
    """{relative path: blob sha} of every file under path at rev."""
    out = git(repo, "ls-tree", "-r", f"{rev}:{path}").decode()
    files = {}
    for line in out.splitlines():
        meta, name = line.split("\t", 1)
        files[name] = meta.split()[2]
    return files


def status(dm_repo, portal_repo, fetch=True):
    if fetch:
        for repo in (dm_repo, portal_repo):
            subprocess.run(["git", "-C", repo, "fetch", "-q", "origin"], check=False)
    source = json.loads(git(portal_repo, "show", f"origin/main:{VENDOR_PATH}/SOURCE.json"))
    pinned = source["commit"]
    src = tree(dm_repo, pinned, source.get("path", SRC_PATH))
    vendored = {k: v for k, v in tree(portal_repo, "origin/main", VENDOR_PATH).items()
                if k not in OWN_FILES}
    modified = sorted(n for n, blob in vendored.items() if src.get(n) != blob)
    base = source.get("path", SRC_PATH)
    behind = git(dm_repo, "log", "--format=%h %s", f"{pinned}..origin/main", "--",
                 *(f"{base}/{n}" for n in vendored)).decode().splitlines()
    return pinned, modified, behind


def main():
    home = os.path.expanduser("~/workspace")
    dm_repo = os.environ.get("DYNAMIC_MAP_REPO", os.path.join(home, "dynamic_map"))
    portal_repo = os.environ.get("PORTAL_REPO", os.path.join(home, "portal-platform"))
    try:
        pinned, modified, behind = status(dm_repo, portal_repo)
    except (subprocess.CalledProcessError, OSError, ValueError, KeyError) as err:
        print(f"portal vendor: cannot read the repos ({err})")
        return 2
    print(f"portal vendor: pinned at {pinned[:7]}")
    for name in modified:
        print(f"  modified: {name}")
    for line in behind:
        print(f"  behind:   {line}")
    if not modified and not behind:
        print("  current")
        return 0
    print(f"  {len(behind)} card commit(s) behind, {len(modified)} file(s) differ:"
          " Portal needs a re-vendor (portal_dev)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
