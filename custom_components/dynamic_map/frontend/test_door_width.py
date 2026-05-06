import cv2
import numpy as np
import math

img = cv2.imread('/home/costi/workspace/water/homeassistant/bg_floor2.png')

# Let's find one door manually or just replicate the dxf_processor logic to get p1, p2
import ezdxf
from ezdxf import bbox
def to_px(x, y):
    sx, sy = 135.177, 135.177
    tx, ty = 749.329, 771.564
    px = x * sx + tx
    py = -y * sy + ty
    return (int(px), int(py))

doc = ezdxf.readfile('/home/costi/workspace/water/homeassistant/floor2.dxf')
msp = doc.modelspace()
def _get_dist(p1, p2): return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)

for entity in msp.query('INSERT'):
    if entity.dxf.layer.lower() == 'doors':
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
                                min_dist = d; best_pt = p
                        if min_dist < 20: corner_candidates.append(best_pt)
                    unique_corners = []
                    for cp in corner_candidates:
                        if cp not in unique_corners: unique_corners.append(cp)
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
                                if d < min_d_to_all: min_d_to_all = d
                            if min_d_to_all > max_min_dist:
                                max_min_dist = min_d_to_all; best_edge = edge
                        if best_edge:
                            print(f"Found door gap: {best_edge}")
                            # Test fill
                            p1, p2 = np.array(best_edge[0], float), np.array(best_edge[1], float)
                            v = p2 - p1
                            L = np.linalg.norm(v)
                            if L > 0:
                                dir = v / L
                                perp = np.array([-dir[1], dir[0]])
                                p1_safe = p1 - dir * 10
                                p2_safe = p2 + dir * 10
                                def find_edges(start_pt):
                                    edges = []
                                    for step_dir in [perp, -perp]:
                                        curr = start_pt.copy()
                                        last_black = curr.copy()
                                        for _ in range(50):
                                            curr += step_dir
                                            cx, cy = int(round(curr[0])), int(round(curr[1]))
                                            if cx < 0 or cx >= img.shape[1] or cy < 0 or cy >= img.shape[0]: break
                                            if np.mean(img[cy, cx]) < 200: last_black = np.array([cx, cy])
                                            else: break
                                        edges.append(last_black)
                                    return edges[0], edges[1]
                                w1_a, w1_b = find_edges(p1_safe)
                                w2_a, w2_b = find_edges(p2_safe)
                                width1 = np.linalg.norm(w1_a - w1_b)
                                width2 = np.linalg.norm(w2_a - w2_b)
                                wall_width = (width1 + width2) / 2
                                print(f"Wall widths: {width1}, {width2} -> avg {wall_width}")
                                c1 = (w1_a + w1_b) / 2
                                c2 = (w2_a + w2_b) / 2
                                thickness = max(2, int(round(wall_width)))
                                pt1 = (int(round(c1[0])), int(round(c1[1])))
                                pt2 = (int(round(c2[0])), int(round(c2[1])))
                                cv2.line(img, pt1, pt2, (0, 0, 255), thickness) # Draw red to see
            v_entity_index += 1

cv2.imwrite('/home/costi/workspace/water/homeassistant/test_door_result.png', img)
