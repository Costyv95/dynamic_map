import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scratch"))
from deploy_plan import needs_restart  # noqa: E402


def test_frontend_only_changes_need_no_restart():
    lines = [".d..t...... ./\n", ">fc.t...... frontend/custom-svg-map.js\n",
             "cd+++++++++ frontend/new/\n", "*deleting   frontend/old.js\n",
             ".f...p..... sensor.py\n", "*deleting   __pycache__/views.cpython-314.pyc\n",
             "*deleting   __pycache__/\n"]
    assert not needs_restart(lines)


def test_python_or_manifest_change_needs_restart():
    assert needs_restart([">fcst...... vacuum_schedules.py\n"])
    assert needs_restart([">f..t...... frontend/a.js\n", "*deleting   old_module.py\n"])
    assert needs_restart([">f+++++++++ manifest.json\n"])


def test_nothing_changed_needs_no_restart():
    assert not needs_restart([])
