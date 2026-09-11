"""Align DXF wall geometry to the SVG raster and draw the wall mask."""
import math
from ezdxf import bbox

try:
    import cv2
    import numpy as np
except ImportError:
    raise Exception("The 'Recompute' feature requires 'opencv-python-headless' and 'numpy' to be installed on your Home Assistant OS.")


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
    walls_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
    
    for entity in wall_entities:
        pts = [(p[0], p[1]) for p in entity.get_points('xy')]
        px_pts = [to_px(p[0], p[1]) for p in pts]
            
        pts_np = np.array(px_pts, np.int32).reshape((-1, 1, 2))
        if entity.closed:
            cv2.fillPoly(bg_img, [pts_np], (0,0,0))
            cv2.fillPoly(debug_img, [pts_np], (0,0,0))
            cv2.fillPoly(walls_img, [pts_np], (0,0,0))
        else:
            cv2.polylines(bg_img, [pts_np], False, (0,0,0), 6)
            cv2.polylines(debug_img, [pts_np], False, (0,0,0), 6)
            cv2.polylines(walls_img, [pts_np], False, (0,0,0), 6)

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

    return bg_img, debug_img, walls_img
