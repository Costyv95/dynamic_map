import cv2
import numpy as np
import ezdxf

floor_num = 2
img_w, img_h = 1280, 1920

svg_bg_img = cv2.imread(f"/home/costi/workspace/water/homeassistant/bg_floor{floor_num}.png")
gray = cv2.cvtColor(svg_bg_img, cv2.COLOR_BGR2GRAY)
_, svg_mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)

doc = ezdxf.readfile(f"/home/costi/workspace/water/homeassistant/floor{floor_num}.dxf")
msp = doc.modelspace()
wall_entities = []
wall_xs, wall_ys = [], []
for entity in msp.query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        wall_entities.append(entity)
        for p in entity.get_points('xy'):
            wall_xs.append(p[0])
            wall_ys.append(p[1])

min_x, max_x = min(wall_xs), max(wall_xs)
min_y, max_y = min(wall_ys), max(wall_ys)

sx, sy, tx, ty = 135.177, 135.177, 749.329, 771.564

# SVG pixel bounds (from previous script)
svg_px_min_x, svg_px_max_x, svg_px_min_y, svg_px_max_y = (103.31811700000003, 1176.623497, 200.30599800000005, 1639.265163)
svg_px_w = svg_px_max_x - svg_px_min_x
svg_px_h = svg_px_max_y - svg_px_min_y

rotations = [
    ("0 deg", lambda x, y: (x, y)),
    ("90 CW", lambda x, y: (y, -x)),
    ("90 CCW", lambda x, y: (-y, x)),
    ("180 deg", lambda x, y: (-x, -y)),
]

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
    
    if error < 5.0: # Close match
        tx_shift = svg_px_min_x - p_min_x
        ty_shift = svg_px_min_y - p_min_y
        
        # Render DXF mask
        dxf_mask = np.zeros((img_h, img_w), dtype=np.uint8)
        
        for entity in wall_entities:
            pts = [(p[0], p[1]) for p in entity.get_points('xy')]
            px_pts = []
            for px, py in pts:
                rx, ry = rot_func(px, py)
                npx = int(rx * sx + tx + tx_shift)
                npy = int(-ry * sy + ty + ty_shift)
                px_pts.append((npx, npy))
            
            pts_np = np.array(px_pts, np.int32).reshape((-1, 1, 2))
            if entity.closed:
                cv2.fillPoly(dxf_mask, [pts_np], 255)
            else:
                cv2.polylines(dxf_mask, [pts_np], False, 255, 6)
                
        overlap = cv2.bitwise_and(svg_mask, dxf_mask)
        score = cv2.countNonZero(overlap)
        print(f"Orientation {name}: Overlap Score = {score}")

