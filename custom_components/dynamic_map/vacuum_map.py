"""Trim, pad and re-calibrate a robot vacuum's map image.

The Roborock integration renders its map on a canvas much larger than the
explored area, so most of the PNG is transparent. Cards that scale the
image to their width then show a small map floating in empty space. These
helpers cut the image down to what is drawn, pad it back out to a chosen
aspect ratio so it fills a landscape card, and move the calibration
reference points into the new image's coordinates.

No Home Assistant imports: everything here is plain geometry plus Pillow.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

_LOGGER = logging.getLogger(__name__)

ALPHA_FLOOR = 8
"""Pixels this transparent or more count as empty canvas."""


@dataclass(frozen=True)
class Box:
    """A pixel rectangle: left/top inclusive, right/bottom exclusive."""

    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top

    def as_tuple(self) -> tuple[int, int, int, int]:
        return (self.left, self.top, self.right, self.bottom)


@dataclass(frozen=True)
class Reference:
    """One calibration reference: a vacuum point and its pixel in the image."""

    vacuum_x: int
    vacuum_y: int
    map_x: float
    map_y: float

    def shifted(self, box: Box) -> Reference:
        """The same reference expressed in a cropped image's coordinates."""
        return Reference(
            self.vacuum_x, self.vacuum_y, self.map_x - box.left, self.map_y - box.top
        )

    def as_point(self) -> dict:
        """The shape the Xiaomi vacuum map card expects."""
        return {
            "vacuum": {"x": self.vacuum_x, "y": self.vacuum_y},
            "map": {"x": round(self.map_x, 1), "y": round(self.map_y, 1)},
        }


def content_box(png: bytes) -> Box | None:
    """The box around everything drawn in `png`, or None if it is all empty."""
    from PIL import Image

    with Image.open(io.BytesIO(png)) as img:
        image = img.convert("RGBA")
    alpha = image.getchannel("A").point(lambda a: 255 if a >= ALPHA_FLOOR else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        return None
    return Box(*bounds)


def pad_box(box: Box, size: tuple[int, int], aspect: float | None, margin: float) -> Box:
    """Grow `box` by `margin` and out to `aspect`, staying inside `size`.

    The box is centred on its content while it can be; against an edge of
    the canvas it grows the other way instead, so nothing drawn is cut off.
    """
    width, height = size
    pad_x = round(box.width * margin)
    pad_y = round(box.height * margin)
    left, top = box.left - pad_x, box.top - pad_y
    right, bottom = box.right + pad_x, box.bottom + pad_y
    if aspect:
        want_w = max(right - left, round((bottom - top) * aspect))
        want_h = max(bottom - top, round(want_w / aspect))
        left, right = _centre(left, right, want_w, width)
        top, bottom = _centre(top, bottom, want_h, height)
    return Box(max(0, left), max(0, top), min(width, right), min(height, bottom))


def _centre(low: int, high: int, want: int, limit: int) -> tuple[int, int]:
    """Widen [low, high) to `want`, centred, then slide inside [0, limit)."""
    grow = want - (high - low)
    low -= grow // 2
    high = low + want
    if low < 0:
        low, high = 0, min(limit, want)
    if high > limit:
        high, low = limit, max(0, limit - want)
    return low, high


def crop_png(png: bytes, box: Box) -> bytes:
    """`png` cropped to `box`, still a PNG with its transparency intact."""
    from PIL import Image

    with Image.open(io.BytesIO(png)) as img:
        cropped = img.convert("RGBA").crop(box.as_tuple())
    out = io.BytesIO()
    cropped.save(out, format="PNG")
    return out.getvalue()


def fit(png: bytes, references: list[Reference], aspect: float | None = 1.5,
        margin: float = 0.02) -> tuple[bytes, list[Reference], Box | None]:
    """Trim the empty canvas off `png` and move the references with it.

    Returns the new image, the references in its coordinates, and the box
    that was cut out (None when the image was left alone).
    """
    try:
        found = content_box(png)
    except Exception as err:  # pragma: no cover - Pillow decode failures
        _LOGGER.debug("Could not read the vacuum map image: %s", err)
        return png, references, None
    if found is None or found.width < 2 or found.height < 2:
        return png, references, None
    from PIL import Image

    with Image.open(io.BytesIO(png)) as img:
        size = img.size
    box = pad_box(found, size, aspect, margin)
    if box.width >= size[0] and box.height >= size[1]:
        return png, references, None
    return crop_png(png, box), [r.shifted(box) for r in references], box


def calibration_points(references: list[Reference]) -> list[dict]:
    """The card's `calibration_points` list for these references."""
    return [r.as_point() for r in references]
