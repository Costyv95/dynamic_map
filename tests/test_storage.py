"""Unit tests for custom_components/dynamic_map/storage.py.

storage.py is HA-free by design; we load it directly by path so importing it
does not trigger the integration's __init__.py (which needs Home Assistant).
Run with: python -m pytest tests/
"""
import importlib.util
import os

import pytest

STORAGE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "storage.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_storage", STORAGE_PATH)
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class TestIsAllowedDataFilename:
    @pytest.mark.parametrize("name", [
        "rooms_floor1.json",
        "shortcuts_floor2.json",
        "config_floor10.json",
        "bg_floor3.png",
        "outside.json",
    ])
    def test_accepts_managed_files(self, name):
        assert storage.is_allowed_data_filename(name)

    @pytest.mark.parametrize("name", [
        None,
        "",
        "../rooms_floor1.json",
        "rooms_floor1.json.bak",
        "secrets.yaml",
        "rooms_floor.json",          # missing number
        "bg_floor1.jpg",             # wrong extension
        "evil.png",
        "rooms_floor1.png",          # wrong pairing
        "shortcuts_floor2.json/",
        "a/rooms_floor1.json",
        "outside.json.bak",
        "outside_floor1.json",
    ])
    def test_rejects_everything_else(self, name):
        assert not storage.is_allowed_data_filename(name)


class TestFloorFilenames:
    def test_lists_all_four_files(self):
        names = storage.floor_filenames(7)
        assert names == [
            "rooms_floor7.json",
            "shortcuts_floor7.json",
            "config_floor7.json",
            "bg_floor7.png",
        ]


class TestDiscoverFloors:
    def test_missing_dir_returns_empty(self, tmp_path):
        assert storage.discover_floors(str(tmp_path / "nope")) == []

    def test_discovers_sorted_floor_numbers(self, tmp_path):
        for name in ["rooms_floor2.json", "bg_floor1.png", "shortcuts_floor2.json",
                     "config_floor10.json", "floor1.dxf", "notes.txt"]:
            (tmp_path / name).touch()
        assert storage.discover_floors(str(tmp_path)) == [1, 2, 10]

    def test_ignores_unrelated_files(self, tmp_path):
        (tmp_path / "floor3.svg").touch()
        (tmp_path / "background_floor4.png").touch()
        assert storage.discover_floors(str(tmp_path)) == []


class TestListSourceFiles:
    def test_lists_dxf_and_svg_only(self, tmp_path):
        for name in ["floor1.dxf", "floor2.svg", "bg_floor1.png", "readme.md"]:
            (tmp_path / name).touch()
        assert storage.list_source_files(str(tmp_path)) == ["floor1.dxf", "floor2.svg"]


class TestListIcons:
    def test_missing_icons_dir(self, tmp_path):
        assert storage.list_icons(str(tmp_path), "/dynamic_map_data") == []

    def test_lists_supported_extensions_as_urls(self, tmp_path):
        icons = tmp_path / "icons"
        icons.mkdir()
        for name in ["lamp.png", "tv.svg", "vac.webp", "notes.txt"]:
            (icons / name).touch()
        result = storage.list_icons(str(tmp_path), "/dynamic_map_data")
        assert result == [
            "/dynamic_map_data/icons/lamp.png",
            "/dynamic_map_data/icons/tv.svg",
            "/dynamic_map_data/icons/vac.webp",
        ]


class TestValidateSaveContent:
    def test_rooms_and_shortcuts_must_be_lists_of_objects(self):
        assert storage.validate_save_content("rooms_floor1.json", [{"id": "r1"}])
        assert storage.validate_save_content("shortcuts_floor1.json", [])
        assert not storage.validate_save_content("rooms_floor1.json", {"id": "r1"})
        assert not storage.validate_save_content("rooms_floor1.json", ["not-a-dict"])
        assert not storage.validate_save_content("shortcuts_floor1.json", "[]")

    def test_config_must_be_object(self):
        assert storage.validate_save_content("config_floor1.json", {"rotation_mode": "auto"})
        assert not storage.validate_save_content("config_floor1.json", [])

    def test_unknown_prefix_rejected(self):
        assert not storage.validate_save_content("bg_floor1.png", {})

    def test_outside_must_be_list_of_objects(self):
        assert storage.validate_save_content("outside.json", [{"entity_id": "sensor.x"}])
        assert storage.validate_save_content("outside.json", [])
        assert not storage.validate_save_content("outside.json", {"entity_id": "sensor.x"})
        assert not storage.validate_save_content("outside.json", ["sensor.x"])
