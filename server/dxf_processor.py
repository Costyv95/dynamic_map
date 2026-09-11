import os
import json
import re
import shutil
import math
import itertools
import ezdxf
from ezdxf import bbox  # noqa: F401

from dxf_svg import _prepare_svg_background, _clean_background_with_mask
from dxf_align import _align_dxf_to_svg, _draw_geometry_mask
from dxf_rooms import get_color, _extract_rooms_from_mask  # noqa: F401

try:
    import cv2
    import numpy as np
except ImportError:
    raise Exception("The 'Recompute' feature requires 'opencv-python-headless' and 'numpy' to be installed on your Home Assistant OS.")

def _extract_wall_entities(msp):
    """Extracts LWPOLYLINE entities from the 'Walls' layer."""
    wall_entities = []
    wall_xs, wall_ys = [], []
    for entity in msp.query('LWPOLYLINE'):
        if entity.dxf.layer.lower() != 'walls':
            continue
        wall_entities.append(entity)
        for p in entity.get_points('xy'):
            wall_xs.append(p[0])
            wall_ys.append(p[1])
    return wall_entities, wall_xs, wall_ys

def process_dxf(base_dir, floor_num, svg_filename=None, dxf_filename=None):
    final_dxf_path = os.path.join(base_dir, f"floor{floor_num}.dxf")
    final_svg_path = os.path.join(base_dir, f"floor{floor_num}.svg")
    bg_png_path = os.path.join(base_dir, f"bg_floor{floor_num}.png")
    
    if dxf_filename:
        source_dxf = os.path.join(base_dir, dxf_filename)
        if os.path.exists(source_dxf) and source_dxf != final_dxf_path:
            shutil.copy2(source_dxf, final_dxf_path)
            
    if svg_filename:
        source_svg = os.path.join(base_dir, svg_filename)
        if os.path.exists(source_svg) and source_svg != final_svg_path:
            shutil.copy2(source_svg, final_svg_path)
            
    if not os.path.exists(final_dxf_path) or not os.path.exists(final_svg_path):
        print(f"Missing DXF or SVG for Floor {floor_num}.")
        return

    print(f"\n{'='*40}")
    print(f"Processing Floor {floor_num} ({final_dxf_path})...")
    
    debug_dir = os.path.join(base_dir, "debug")
    os.makedirs(debug_dir, exist_ok=True)
    
    # 1. Prepare SVG & Rasterize Background
    img_w, img_h, sx, sy, tx, ty, svg_bg_img, svg_px_bounds = _prepare_svg_background(final_svg_path, bg_png_path)
    print(f"SVG Dimensions: {img_w}x{img_h}")
    print(f"SVG Matrix: sx={sx}, sy={sy}, tx={tx}, ty={ty}")

    # 2. Extract Walls from DXF
    doc = ezdxf.readfile(final_dxf_path)
    wall_entities, wall_xs, wall_ys = _extract_wall_entities(doc.modelspace())
    
    # 3. Align DXF to SVG Background
    try:
        best_rot_func, tx_shift, ty_shift = _align_dxf_to_svg(
            wall_entities, wall_xs, wall_ys, svg_bg_img, svg_px_bounds, 
            sx, sy, tx, ty, img_w, img_h
        )
    except ValueError as e:
        print(f"Alignment Error: {e}")
        return

    # 4. Draw Mathematical Mask (Walls + Doors/Windows)
    bg_img, debug_img, walls_img = _draw_geometry_mask(
        doc.modelspace(), wall_entities, best_rot_func, 
        sx, sy, tx, ty, tx_shift, ty_shift, img_w, img_h, svg_bg_img
    )
    
    cv2.imwrite(os.path.join(debug_dir, f"raw_debug_floor{floor_num}.png"), debug_img)
    cv2.imwrite(os.path.join(debug_dir, f"cv2_mask_floor{floor_num}.png"), bg_img)
    cv2.imwrite(os.path.join(debug_dir, f"walls_only_mask_floor{floor_num}.png"), walls_img)

    # 5. Extract Final Rooms from Mask
    rooms, final_debug_img, valid_px_polygons = _extract_rooms_from_mask(bg_img, debug_img, img_w, img_h)

    # 6. Clean Background with Mask
    _clean_background_with_mask(bg_png_path, bg_img, walls_img, img_w, img_h, debug_dir, floor_num)

    json_path = os.path.join(base_dir, f"rooms_floor{floor_num}.json")
    with open(json_path, 'w') as f:
        json.dump(rooms, f, indent=2)
        
    debug_path = os.path.join(debug_dir, f"debug_floor{floor_num}.png")
    cv2.imwrite(debug_path, final_debug_img)
    
    print(f"Exported {len(rooms)} strictly orthogonal rooms to JSON and Debug Images.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Process DXF and SVG files to generate map JSON.")
    parser.add_argument("--base_dir", type=str, default=os.path.dirname(os.path.abspath(__file__)),
                        help="Base directory containing the SVG and DXF files.")
    parser.add_argument("--floor", type=int, action="append",
                        help="Floor numbers to process (can specify multiple times). If not provided, defaults to 1 and 2.")
    args = parser.parse_args()

    floors = args.floor if args.floor else [1, 2]
    
    for floor in floors:
        process_dxf(args.base_dir, floor)
