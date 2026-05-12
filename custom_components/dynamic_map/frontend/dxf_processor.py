import os
import json
import re
import shutil
import math
import itertools
import ezdxf
from ezdxf import bbox

try:
    import cv2
    import numpy as np
except ImportError:
    raise Exception("The 'Recompute' feature requires 'opencv-python-headless' and 'numpy' to be installed on your Home Assistant OS.")

def get_color(idx, total):
    import colorsys
    hue = idx / max(1, total)
    rgb = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
    return (int(rgb[2]*255), int(rgb[1]*255), int(rgb[0]*255))

def _prepare_svg_background(svg_path, bg_png_path):
    """Reads SVG, cleans text, extracts matrix/dimensions, and rasterizes to PNG."""
    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"File not found: {svg_path}")
        
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Remove all text elements from the SVG to ensure a clean background
    svg_content = re.sub(r'<text[^>]*>.*?</text>', '', svg_content, flags=re.DOTALL)
    
    clean_svg_path = svg_path.replace('.svg', '_clean.svg')
    with open(clean_svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)

    w_match = re.search(r'<svg[^>]*width="(\d+)"', svg_content)
    h_match = re.search(r'<svg[^>]*height="(\d+)"', svg_content)
    img_w = int(w_match.group(1)) if w_match else 1280
    img_h = int(h_match.group(1)) if h_match else 1920
    
    matrix_match = re.search(r'transform="matrix\(([^)]+)\)"', svg_content)
    if matrix_match:
        vals = [float(v) for v in matrix_match.group(1).split()]
        sx, _, _, sy, tx, ty = vals
        matrix_str = matrix_match.group(1)
    else:
        sx, sy, tx, ty = 1, 1, 0, 0
        matrix_str = "1 0 0 1 0 0"

    # Extract precise Pixel Bounding Box of walls from SVG
    g_match = re.search(r'<g[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*>(.*?)</g>', svg_content, re.DOTALL)
    if g_match:
        paths = re.findall(r'd="M([^"]+)"', g_match.group(1))
    else:
        paths = re.findall(r'<path[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*d="M([^"]+)"', svg_content)

    svg_px_bounds = None
    if paths:
        all_x, all_y = [], []
        for d in paths:
            nums = [float(n) for n in re.findall(r'-?\d+\.\d+', d)]
            all_x.extend(nums[0::2])
            all_y.extend(nums[1::2])
        svg_px_points = [
            (min(all_x) * sx + tx, min(all_y) * sy + ty),
            (max(all_x) * sx + tx, min(all_y) * sy + ty),
            (min(all_x) * sx + tx, max(all_y) * sy + ty),
            (max(all_x) * sx + tx, max(all_y) * sy + ty),
        ]
        svg_px_bounds = {
            'min_x': min(p[0] for p in svg_px_points),
            'max_x': max(p[0] for p in svg_px_points),
            'min_y': min(p[1] for p in svg_px_points),
            'max_y': max(p[1] for p in svg_px_points),
        }
    else:
        svg_px_bounds = {'min_x': 0, 'max_x': img_w, 'min_y': 0, 'max_y': img_h}

    try:
        import cairosvg
        print(f"Rasterizing {clean_svg_path} to {bg_png_path}...")
        cairosvg.svg2png(url=clean_svg_path, write_to=bg_png_path, scale=1.0)
    except ImportError:
        raise Exception("The 'Recompute' feature requires 'cairosvg' to be installed on your Home Assistant OS. Please install it manually, or run Recompute locally.")
    finally:
        if os.path.exists(clean_svg_path):
            os.remove(clean_svg_path)

    svg_bg_img = cv2.imread(bg_png_path)
    if svg_bg_img is None:
        svg_bg_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255

    return img_w, img_h, sx, sy, tx, ty, svg_bg_img, svg_px_bounds

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

def _align_dxf_to_svg(wall_entities, wall_xs, wall_ys, svg_bg_img, svg_px_bounds, sx, sy, tx, ty, img_w, img_h):
    """Finds the best rotation and translation to align DXF walls to SVG bounds."""
    if not wall_xs:
        raise ValueError("No walls found in DXF!")

    min_x, max_x = min(wall_xs), max(wall_xs)
    min_y, max_y = min(wall_ys), max(wall_ys)

    svg_px_min_x = svg_px_bounds['min_x']
    svg_px_max_x = svg_px_bounds['max_x']
    svg_px_min_y = svg_px_bounds['min_y']
    svg_px_max_y = svg_px_bounds['max_y']
    svg_px_w = svg_px_max_x - svg_px_min_x
    svg_px_h = svg_px_max_y - svg_px_min_y

    rotations = [
        ("0 deg", lambda x, y: (x, y)),
        ("90 CW", lambda x, y: (y, -x)),
        ("90 CCW", lambda x, y: (-y, x)),
        ("180 deg", lambda x, y: (-x, -y)),
    ]
    
    candidate_rotations = []
    min_error = float('inf')
    
    for name, rot_func in rotations:
        px_points = []
        for x, y in [(min_x, min_y), (max_x, min_y), (min_x, max_y), (max_x, max_y)]:
            rx, ry = rot_func(x, y)
            px = rx * sx + tx
            py = -ry * sy + ty
            px_points.append((px, py))
            
        p_min_x = min(p[0] for p in px_points)
        p_max_x = max(p[0] for p in px_points)
        p_min_y = min(p[1] for p in px_points)
        p_max_y = max(p[1] for p in px_points)
        
        p_w = p_max_x - p_min_x
        p_h = p_max_y - p_min_y
        
        error = abs(p_w - svg_px_w) + abs(p_h - svg_px_h)
        tx_s = svg_px_min_x - p_min_x
        ty_s = svg_px_min_y - p_min_y
        
        if error < min_error - 1.0:
            min_error = error
            candidate_rotations = [(name, rot_func, tx_s, ty_s)]
        elif error < min_error + 1.0:
            candidate_rotations.append((name, rot_func, tx_s, ty_s))

    gray = cv2.cvtColor(svg_bg_img, cv2.COLOR_BGR2GRAY)
    _, svg_wall_mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)

    best_rot_name = None
    best_rot_func = None
    tx_shift = 0
    ty_shift = 0
    max_score = -1

    for name, rot_func, tx_s, ty_s in candidate_rotations:
        dxf_mask = np.zeros((img_h, img_w), dtype=np.uint8)
        for entity in wall_entities:
            pts = [(p[0], p[1]) for p in entity.get_points('xy')]
            px_pts = []
            for px, py in pts:
                rx, ry = rot_func(px, py)
                npx = int(rx * sx + tx + tx_s)
                npy = int(-ry * sy + ty + ty_s)
                px_pts.append((npx, npy))
            pts_np = np.array(px_pts, np.int32).reshape((-1, 1, 2))
            if entity.closed:
                cv2.fillPoly(dxf_mask, [pts_np], 255)
            else:
                cv2.polylines(dxf_mask, [pts_np], False, 255, 6)
                
        overlap = cv2.bitwise_and(svg_wall_mask, dxf_mask)
        score = cv2.countNonZero(overlap)
        
        if score > max_score:
            max_score = score
            best_rot_name = name
            best_rot_func = rot_func
            tx_shift = tx_s
            ty_shift = ty_s

    print(f"Detected DXF Orientation: {best_rot_name}")
    print(f"Detected Camera Pan Offset: tx_shift={tx_shift:.2f}, ty_shift={ty_shift:.2f}")
    
    return best_rot_func, tx_shift, ty_shift

def _draw_geometry_mask(msp, wall_entities, best_rot_func, sx, sy, tx, ty, tx_shift, ty_shift, img_w, img_h, svg_bg_img):
    """Draws walls and plugs doors/windows to create a closed geometry mask."""
    def to_px(x, y):
        rx, ry = best_rot_func(x, y)
        px = rx * sx + tx + tx_shift
        py = -ry * sy + ty + ty_shift
        return (int(px), int(py))

    def _get_dist(p1, p2):
        return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
        
    bg_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
    debug_img = svg_bg_img.copy()
    
    for entity in wall_entities:
        pts = [(p[0], p[1]) for p in entity.get_points('xy')]
        px_pts = [to_px(p[0], p[1]) for p in pts]
            
        pts_np = np.array(px_pts, np.int32).reshape((-1, 1, 2))
        if entity.closed:
            cv2.fillPoly(bg_img, [pts_np], (0,0,0))
            cv2.fillPoly(debug_img, [pts_np], (0,0,0))
        else:
            cv2.polylines(bg_img, [pts_np], False, (0,0,0), 6)
            cv2.polylines(debug_img, [pts_np], False, (0,0,0), 6)

    plug_layers = ['doors', 'windows']
    for entity in msp.query('INSERT'):
        if entity.dxf.layer.lower() in plug_layers:
            b = bbox.extents([entity])
            if b.extmin and b.extmax:
                if entity.dxf.layer.lower() == 'windows':
                    pt1_w = to_px(b.extmin[0], b.extmin[1])
                    pt2_w = to_px(b.extmax[0], b.extmax[1])
                    cv2.rectangle(bg_img, pt1_w, pt2_w, (0,0,0), -1)
                    cv2.rectangle(debug_img, pt1_w, pt2_w, (0,0,0), -1)
                else:
                    entities = list(entity.virtual_entities())
                    v_entity_index = 0
                    while v_entity_index < len(entities):
                        v_entity = entities[v_entity_index]
                        if v_entity.dxftype() in ['LWPOLYLINE']:
                            all_pts = []
                            while v_entity_index < len(entities) and entities[v_entity_index].dxftype() in ['LWPOLYLINE']:
                                current_v_entity = entities[v_entity_index]
                                for p in current_v_entity.get_points('xy'):
                                    all_pts.append(to_px(p[0], p[1]))
                                v_entity_index += 1
                            v_entity_index -= 1
                            
                            if len(all_pts) > 0:
                                min_x = min(p[0] for p in all_pts)
                                max_x = max(p[0] for p in all_pts)
                                min_y = min(p[1] for p in all_pts)
                                max_y = max(p[1] for p in all_pts)
                                
                                bb_corners = [(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)]
                                corner_candidates = []
                                for bc in bb_corners:
                                    min_dist = float('inf')
                                    best_pt = None
                                    for p in all_pts:
                                        d = _get_dist(bc, p)
                                        if d < min_dist:
                                            min_dist = d
                                            best_pt = p
                                    if min_dist < 20: 
                                        corner_candidates.append(best_pt)
                                
                                unique_corners = []
                                for cp in corner_candidates:
                                    if cp not in unique_corners:
                                        unique_corners.append(cp)
                                        
                                if len(unique_corners) == 3:
                                    c1, c2, c3 = unique_corners
                                    edges = [(c1, c2), (c2, c3), (c3, c1)]
                                    best_edge = None
                                    max_min_dist = -1
                                    
                                    for edge in edges:
                                        mid_pt = ((edge[0][0] + edge[1][0]) // 2, (edge[0][1] + edge[1][1]) // 2)
                                        min_d_to_all = float('inf')
                                        for p in all_pts:
                                            d = _get_dist(mid_pt, p)
                                            if d < min_d_to_all:
                                                min_d_to_all = d
                                        if min_d_to_all > max_min_dist:
                                            max_min_dist = min_d_to_all
                                            best_edge = edge
                                            
                                    if best_edge:
                                        cv2.line(bg_img, best_edge[0], best_edge[1], (0, 0, 0), 4)
                                        cv2.line(debug_img, best_edge[0], best_edge[1], (0, 0, 255), 4)

                        elif v_entity.dxftype() == 'LINE':
                            pt1_box = to_px(v_entity.dxf.start.x, v_entity.dxf.start.y)
                            pt2_box = to_px(v_entity.dxf.end.x, v_entity.dxf.end.y)
                            cv2.line(bg_img, pt1_box, pt2_box, (0, 0, 0), 4)
                            cv2.line(debug_img, pt1_box, pt2_box, (0, 0, 255), 4)
                        v_entity_index += 1

    return bg_img, debug_img

def _extract_rooms_from_mask(bg_img, debug_img, img_w, img_h):
    """Extracts orthogonal room polygons from the geometry mask."""
    gray = cv2.cvtColor(bg_img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    
    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.erode(thresh, kernel, iterations=1)
    thresh = cv2.dilate(thresh, kernel, iterations=1)

    contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    
    rooms = []
    min_area = (img_w * img_h) * 0.005
    max_area = (img_w * img_h) * 0.9

    valid_contours = []
    if hierarchy is not None:
        for i, contour in enumerate(contours):
            if hierarchy[0][i][3] != -1: 
                continue
                
            area = cv2.contourArea(contour)
            if not (min_area < area < max_area): continue
            x, y, w, h = cv2.boundingRect(contour)
            if w == 0 or h == 0: continue
            ratio = w / h
            if ratio > 5.0 or ratio < 0.2: continue
            extent = area / (w * h)
            if extent < 0.5: continue
            valid_contours.append(contour)
    
    valid_px_polygons = []
    for room_idx, contour in enumerate(valid_contours):
        color = get_color(room_idx, len(valid_contours))
        epsilon = 0.001 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        polygon_pct = []
        for point in approx:
            px, py = point[0]
            polygon_pct.append([
                round((px / img_w) * 100, 2),
                round((py / img_h) * 100, 2)
            ])

        clean_px = []
        for p in polygon_pct:
            clean_px.append([int(p[0] * img_w / 100), int(p[1] * img_h / 100)])
        clean_approx = np.array(clean_px, np.int32).reshape((-1, 1, 2))
        valid_px_polygons.append(clean_approx)
        
        rooms.append({
            "id": f"room_{room_idx}",
            "name": f"Room {room_idx + 1}",
            "polygon": polygon_pct
        })
        
        overlay = debug_img.copy()
        cv2.fillPoly(overlay, [clean_approx], color)
        debug_img = cv2.addWeighted(overlay, 0.4, debug_img, 0.6, 0)
        cv2.polylines(debug_img, [clean_approx], True, color, 4)
        for point in polygon_pct:
            px, py = point
            cv2.circle(debug_img, (int(px * img_w / 100), int(py * img_h / 100)), 5, (0, 255, 255), -1)
            
    return rooms, debug_img, valid_px_polygons

def _clean_background_with_mask(bg_png_path, bg_img, img_w, img_h):
    """Masks the original background image, turning everything outside the house exterior to pure white."""
    original_bg = cv2.imread(bg_png_path)
    if original_bg is None:
        return
        
    gray = cv2.cvtColor(bg_img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    
    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.erode(thresh, kernel, iterations=1)
    thresh = cv2.dilate(thresh, kernel, iterations=1)
    
    mask = np.zeros((img_h + 2, img_w + 2), dtype=np.uint8)
    corners = [(0,0), (img_w-1, 0), (0, img_h-1), (img_w-1, img_h-1)]
    for pt in corners:
        if thresh[pt[1], pt[0]] == 255:
            cv2.floodFill(thresh, mask, pt, 128)
            
    white_bg = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
    cleaned_bg = np.where(thresh[:, :, None] == 128, white_bg, original_bg)
    
    cv2.imwrite(bg_png_path, cleaned_bg)

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
    bg_img, debug_img = _draw_geometry_mask(
        doc.modelspace(), wall_entities, best_rot_func, 
        sx, sy, tx, ty, tx_shift, ty_shift, img_w, img_h, svg_bg_img
    )
    
    cv2.imwrite(os.path.join(debug_dir, f"raw_debug_floor{floor_num}.png"), debug_img)
    cv2.imwrite(os.path.join(debug_dir, f"cv2_mask_floor{floor_num}.png"), bg_img)

    # 5. Extract Final Rooms from Mask
    rooms, final_debug_img, valid_px_polygons = _extract_rooms_from_mask(bg_img, debug_img, img_w, img_h)

    # 6. Clean Background with Mask
    _clean_background_with_mask(bg_png_path, bg_img, img_w, img_h)

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
