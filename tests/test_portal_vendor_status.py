"""scratch/portal_vendor_status.py flags a stale or edited Portal vendor copy (#1701)."""
import importlib.util
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "portal_vendor_status", os.path.join(ROOT, "scratch", "portal_vendor_status.py"))
pvs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pvs)


def run(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True,
                          capture_output=True, text=True).stdout.strip()


def commit(repo, files, msg):
    for name, text in files.items():
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    run(repo, "add", "-A")
    run(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", msg)
    run(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    return run(repo, "rev-parse", "HEAD")


def repos(tmp_path):
    dm, portal = tmp_path / "dm", tmp_path / "portal"
    for repo in (dm, portal):
        repo.mkdir()
        run(repo, "init", "-q")
    src = pvs.SRC_PATH
    pinned = commit(dm, {f"{src}/card/a.js": "a1", f"{src}/editor/e.js": "e1"}, "base")
    vendor = pvs.VENDOR_PATH
    commit(portal, {f"{vendor}/card/a.js": "a1",
                    f"{vendor}/SOURCE.json": json.dumps({"commit": pinned})}, "vendor")
    return dm, portal, pinned


def test_current_copy_reports_nothing(tmp_path):
    dm, portal, pinned = repos(tmp_path)
    commit(dm, {f"{pvs.SRC_PATH}/editor/e.js": "e2"}, "editor only")
    assert pvs.status(str(dm), str(portal), fetch=False) == (pinned, [], [])


def test_card_commit_after_pin_is_behind(tmp_path):
    dm, portal, _ = repos(tmp_path)
    commit(dm, {f"{pvs.SRC_PATH}/card/a.js": "a2"}, "card fix")
    _, modified, behind = pvs.status(str(dm), str(portal), fetch=False)
    assert modified == [] and [b.split(" ", 1)[1] for b in behind] == ["card fix"]


def test_edited_vendor_file_is_modified(tmp_path):
    dm, portal, _ = repos(tmp_path)
    commit(portal, {f"{pvs.VENDOR_PATH}/card/a.js": "patched in portal"}, "local edit")
    _, modified, behind = pvs.status(str(dm), str(portal), fetch=False)
    assert modified == ["card/a.js"] and behind == []
