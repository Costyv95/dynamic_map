"""Unit tests for custom_components/dynamic_map/texture_gen.py.

texture_gen.py is HA-free by design; we load it directly by path so importing
it does not trigger the integration's __init__.py (which needs Home Assistant).
Run with: python -m pytest tests/
"""
import importlib.util
import os

import pytest

MODULE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components", "dynamic_map", "texture_gen.py",
)
spec = importlib.util.spec_from_file_location("dynamic_map_texture_gen", MODULE_PATH)
texture_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(texture_gen)

GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="20" fill="#123456"/></svg>'


class TestExtractSvg:
    def test_extracts_from_chatter(self):
        text = f"Here you go!\n{GOOD_SVG}\nEnjoy."
        assert texture_gen.extract_svg(text) == GOOD_SVG

    def test_raises_without_svg(self):
        with pytest.raises(ValueError):
            texture_gen.extract_svg("no vector art here")


class TestValidateSvg:
    def test_accepts_recipe_conformant(self):
        texture_gen.validate_svg(GOOD_SVG)

    @pytest.mark.parametrize("bad", [
        '<svg><text>hi</text></svg>',
        '<svg><image href="http://evil"/></svg>',
        '<svg><script>alert(1)</script></svg>',
        '<svg><a href="x">y</a></svg>',
        '<svg><circle r="1">',  # malformed XML
    ])
    def test_rejects_forbidden_or_malformed(self, bad):
        with pytest.raises(ValueError):
            texture_gen.validate_svg(bad)


class TestFilename:
    def test_derives_from_description(self):
        name = texture_gen.texture_filename("a pink flamingo-shaped table lamp")
        assert name == "obj_pink_flamingo_shaped_table_lamp.svg"

    def test_accepts_valid_override(self):
        assert texture_gen.texture_filename("x", "obj_custom_1.svg") == "obj_custom_1.svg"

    @pytest.mark.parametrize("bad", [
        "../../etc/passwd",
        "obj_a/../b.svg",
        "obj_UPPER.svg",
        "plain.svg",
        "obj_x.png",
        "obj_.svg",
    ])
    def test_rejects_unsafe_overrides(self, bad):
        with pytest.raises(ValueError):
            texture_gen.texture_filename("x", bad)


class TestPromptAndBody:
    def test_prompt_embeds_subject_and_recipe(self):
        prompt = texture_gen.build_prompt("a red barn")
        assert "a red barn" in prompt
        assert 'viewBox="0 0 128 128"' in prompt
        assert "TILE" not in prompt

    def test_tileable_prompt_relaxes_shadow_rules(self):
        prompt = texture_gen.build_prompt("an LED strip", tileable=True)
        assert "TILE seamlessly" in prompt

    def test_request_body_shape(self):
        body = texture_gen.build_request_body("a red barn", None)
        assert body["model"] == texture_gen.DEFAULT_TEXTURE_MODEL
        assert body["thinking"] == {"type": "adaptive"}
        assert body["messages"][0]["role"] == "user"

    def test_decor_style_swaps_in_the_plan_recipe(self):
        prompt = texture_gen.build_prompt("an outdoor couch", style="decor")
        assert "top-down orthographic plan view" in prompt
        assert "an outdoor couch" in prompt
        # badge-recipe rules must not leak into decor
        assert "Ground shadow" not in prompt
        assert "saturated but slightly muted" not in prompt

    def test_default_style_is_the_badge_recipe(self):
        assert texture_gen.style_recipe() == texture_gen.STYLE_RECIPE
        assert texture_gen.style_recipe("decor") == texture_gen.DECOR_RECIPE
        prompt = texture_gen.build_prompt("a red barn")
        assert "top-down orthographic" not in prompt

    def test_decor_style_flows_into_request_body(self):
        body = texture_gen.build_request_body("a bench", None, style="decor")
        assert "plan view" in body["messages"][0]["content"]

    def test_response_text_concatenates_text_blocks(self):
        body = {"content": [
            {"type": "thinking", "thinking": "hmm"},
            {"type": "text", "text": "<svg"},
            {"type": "text", "text": "></svg>"},
        ]}
        assert texture_gen.response_text(body) == "<svg></svg>"
