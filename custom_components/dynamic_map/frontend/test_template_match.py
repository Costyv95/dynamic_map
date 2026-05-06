import cv2
import numpy as np
import ezdxf

# Load SVG Image
svg_img = cv2.imread("/home/costi/workspace/water/homeassistant/bg_floor2.png", cv2.IMREAD_GRAYSCALE)
_, svg_mask = cv2.threshold(svg_img, 240, 255, cv2.THRESH_BINARY_INV)

# Load DXF
doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor2.dxf")
msp = doc.modelspace()
wall_xs, wall_ys = [], []
for entity in msp.query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        for p in entity.get_points('xy'):
            wall_xs.append(p[0])
            wall_ys.append(p[1])

min_x, max_x = min(wall_xs), max(wall_xs)
min_y, max_y = min(wall_ys), max(wall_ys)

sx = sy = 135.177

# Rotate DXF 90 CW
rot_xs = [y for y in wall_ys]
rot_ys = [-x for x in wall_xs]
r_min_x, r_max_x = min(rot_xs), max(rot_xs)
r_min_y, r_max_y = min(rot_ys), max(rot_ys)

# DXF pixel size
dxf_px_w = int((r_max_x - r_min_x) * sx)
dxf_px_h = int((r_max_y - r_min_y) * sy)

# Draw DXF template
pad = 20
template = np.zeros((dxf_px_h + 2*pad, dxf_px_w + 2*pad), dtype=np.uint8)

def to_template_px(x, y):
    rx, ry = y, -x
    px = int((rx - r_min_x) * sx) + pad
    py = int(-(ry - r_max_y) * sy) + pad # SVG Y is down
    return (px, py)

for entity in msp.query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        pts = [(p[0], p[1]) for p in entity.get_points('xy')]
        px_pts = [to_template_px(p[0], p[1]) for p in pts]
        pts_np = np.array(px_pts, np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(template, [pts_np], 255)
        if not entity.closed:
            cv2.polylines(template, [pts_np], False, 255, 6)

res = cv2.matchTemplate(svg_mask, template, cv2.TM_CCOEFF_NORMED)
min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

print(f"Match correlation: {max_val}")
print(f"Match location: {max_loc}")

# The location in svg_mask is the top-left of the template
# So to_px should map r_min_x, r_max_y to max_loc[0] - pad, max_loc[1] - pad
tx = max_loc[0] - pad - int(r_min_x * sx)
ty = max_loc[1] - pad + int(r_max_y * sy)
print(f"Calculated tx: {tx}, ty: {ty}")

# Verify mapping
print(f"Mapping r_min_x, r_max_y -> {int(r_min_x * sx + tx)}, {int(-r_max_y * sy + ty)}")

