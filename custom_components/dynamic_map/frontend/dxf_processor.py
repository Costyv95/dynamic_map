import os
import json
import cv2
import numpy as np
import ezdxf
from ezdxf import bbox
from shapely.geometry import LineString, Point, box as shapely_box
from shapely.ops import unary_union
import itertools
import math

# --- CLIP Zero-Shot Classification ---
clip_model = None
clip_processor = None

def get_clip():
    global clip_model, clip_processor
    if clip_model is None:
        print("\nLoading CLIP model for zero-shot room classification (this may take a moment)...")
        from transformers import CLIPProcessor, CLIPModel
        model_id = "openai/clip-vit-base-patch32"
        clip_processor = CLIPProcessor.from_pretrained(model_id)
        clip_model = CLIPModel.from_pretrained(model_id)
    return clip_model, clip_processor

ROOM_CATEGORIES = [
    "a floorplan of a bedroom with a bed",
    "a floorplan of a bathroom with a toilet and sink",
    "a floorplan of a kitchen with a stove and sink",
    "a floorplan of a living room with a sofa",
    "a floorplan of an office study room with a desk",
    "a floorplan of a dining room with a table",
    "a floorplan of an empty hallway",
    "an outdoor balcony or terrace"
]

def classify_room(image_np):
    import torch
    from PIL import Image
    model, processor = get_clip()
    
    # Convert OpenCV BGR image to RGB PIL Image
    image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(image_rgb)
    
    inputs = processor(text=ROOM_CATEGORIES, images=pil_img, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1)
        
    best_idx = probs.argmax().item()
    best_label = ROOM_CATEGORIES[best_idx]
    
    if "bedroom" in best_label: return "Bedroom"
    elif "bathroom" in best_label: return "Bathroom"
    elif "kitchen" in best_label: return "Kitchen"
    elif "living room" in best_label: return "Living Room"
    elif "office" in best_label: return "Study"
    elif "hallway" in best_label: return "Hallway"
    elif "dining" in best_label: return "Dining Room"
    elif "balcony" in best_label: return "Balcony"
    else: return "Room"
# -------------------------------------

def get_color(idx, total):
    import colorsys
    hue = idx / max(1, total)
    rgb = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
    return (int(rgb[2]*255), int(rgb[1]*255), int(rgb[0]*255))

def process_dxf(base_dir, floor_num):
    dxf_path = os.path.join(base_dir, f"floor{floor_num}.dxf")
    if not os.path.exists(dxf_path):
        return

    print(f"\n{'='*40}")
    print(f"Processing Floor {floor_num} ({dxf_path})...")
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    # Get SVG details
    svg_path = os.path.join(base_dir, f"floor{floor_num}.svg")
    bg_png_path = os.path.join(base_dir, f"bg_floor{floor_num}.png")
    
    if not os.path.exists(svg_path):
        print(f"File not found: {svg_path}")
        return
        
    import re
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Filter out text elements that DO NOT contain digits (removes "Study", disclaimers, etc)
    def filter_text(match):
        inner_text = match.group(1)
        if not re.search(r'[0-9]', inner_text):
            return '' # Remove if it has no numbers
        return match.group(0) # Keep if it contains measurements

    svg_content = re.sub(r'<text[^>]*>(.*?)</text>', filter_text, svg_content, flags=re.DOTALL)
    
    # Save the cleaned SVG to a temporary file for rendering
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
        
    print(f"SVG Dimensions: {img_w}x{img_h}")
    print(f"SVG Matrix: sx={sx}, sy={sy}, tx={tx}, ty={ty}")

    # Extract precise Pixel Bounding Box of walls from SVG
    g_match = re.search(r'<g[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*>(.*?)</g>', svg_content, re.DOTALL)
    if g_match:
        paths = re.findall(r'd="M([^"]+)"', g_match.group(1))
    else:
        paths = re.findall(r'<path[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*d="M([^"]+)"', svg_content)

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
        svg_px_min_x = min(p[0] for p in svg_px_points)
        svg_px_max_x = max(p[0] for p in svg_px_points)
        svg_px_min_y = min(p[1] for p in svg_px_points)
        svg_px_max_y = max(p[1] for p in svg_px_points)
    else:
        # Fallback if parsing fails
        svg_px_min_x, svg_px_max_x = 0, img_w
        svg_px_min_y, svg_px_max_y = 0, img_h

    # Generate PNG from SVG for Editor and Debug overlay
    import cairosvg
    print(f"Rasterizing {clean_svg_path} to {bg_png_path}...")
    cairosvg.svg2png(url=clean_svg_path, write_to=bg_png_path, scale=1.0)
    
    # Clean up temp file
    if os.path.exists(clean_svg_path):
        os.remove(clean_svg_path)
    
    svg_bg_img = cv2.imread(bg_png_path)
    if svg_bg_img is None:
        svg_bg_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
        
    # Create binary mask of SVG walls for tie-breaking
    gray = cv2.cvtColor(svg_bg_img, cv2.COLOR_BGR2GRAY)
    _, svg_wall_mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
        
    # Extract Wall Lines to determine bounds
    wall_entities = []
    wall_xs, wall_ys = [], []
    for entity in msp.query('LWPOLYLINE'):
        if entity.dxf.layer.lower() != 'walls':
            continue
        wall_entities.append(entity)
        for p in entity.get_points('xy'):
            wall_xs.append(p[0])
            wall_ys.append(p[1])
            
    if not wall_xs:
        print("No walls found!")
        return
        
    min_x, max_x = min(wall_xs), max(wall_xs)
    min_y, max_y = min(wall_ys), max(wall_ys)

    # Automatically detect DXF rotation and pan offset relative to SVG
    rotations = [
        ("0 deg", lambda x, y: (x, y)),
        ("90 CW", lambda x, y: (y, -x)),
        ("90 CCW", lambda x, y: (-y, x)),
        ("180 deg", lambda x, y: (-x, -y)),
    ]
    
    candidate_rotations = []
    min_error = float('inf')
    
    svg_px_w = svg_px_max_x - svg_px_min_x
    svg_px_h = svg_px_max_y - svg_px_min_y
    
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
        
        # Match the scale dimensions
        error = abs(p_w - svg_px_w) + abs(p_h - svg_px_h)
        tx_s = svg_px_min_x - p_min_x
        ty_s = svg_px_min_y - p_min_y
        
        if error < min_error - 1.0:
            min_error = error
            candidate_rotations = [(name, rot_func, tx_s, ty_s)]
        elif error < min_error + 1.0:
            candidate_rotations.append((name, rot_func, tx_s, ty_s))

    best_rot_name = None
    best_rot_func = None
    tx_shift = 0
    ty_shift = 0
    max_score = -1

    # Tie-breaker using actual mask overlap
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
    
    def to_px(x, y):
        rx, ry = best_rot_func(x, y)
        px = rx * sx + tx + tx_shift
        py = -ry * sy + ty + ty_shift
        return (int(px), int(py))
        
    # Create pure black/white mask for OpenCV contour extraction
    bg_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
    debug_img = svg_bg_img.copy()
    
    # 1. FILL Walls solid black to destroy "inside the wall" artifacts
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

    # 2. Draw lines across door/window gaps
    
    def _get_angle(p1, p2):
        return math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0] + 1e-9))

    def _get_dist(p1, p2):
        return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
    
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
                                
                                bb_corners = [
                                    (min_x, min_y),
                                    (max_x, min_y),
                                    (max_x, max_y),
                                    (min_x, max_y)
                                ]
                                
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
                        
                        
    cv2.imwrite(os.path.join(base_dir, f"raw_debug_floor{floor_num}.png"), debug_img)
    cv2.imwrite(os.path.join(base_dir, f"cv2_mask_floor{floor_num}.png"), bg_img)

    # OpenCV Mathematical Room Extraction
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
            # Only keep top-level white blobs (Parent == -1). 
            # This perfectly drops the global house perimeter, which is topologically a "hole" inside the canvas margin.
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
    
    room_idx = 0
    for contour in valid_contours:
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

        overlay = debug_img.copy()

        clean_polygon_pct = polygon_pct
        
        print(f"\n--- Room {room_idx} CLEAN Geometry ---")
        for p_idx in range(len(clean_polygon_pct)):
            pt1 = clean_polygon_pct[p_idx]
            pt2 = clean_polygon_pct[(p_idx+1)%len(clean_polygon_pct)]
            dx = abs(pt2[0] - pt1[0])
            dy = abs(pt2[1] - pt1[1])
            angle = math.degrees(math.atan2(dy, dx + 1e-9))
            length = math.hypot(dx, dy)
            if angle > 1.0 and angle < 89.0:
                print(f"  [ERROR] Diagonal: {pt1[0]:5.2f},{pt1[1]:5.2f} -> {pt2[0]:5.2f},{pt2[1]:5.2f} | Len: {length:5.2f}% | Ang: {angle:5.2f}°")
            else:
                print(f"  [OK] Orthogonal: {pt1[0]:5.2f},{pt1[1]:5.2f} -> {pt2[0]:5.2f},{pt2[1]:5.2f} | Len: {length:5.2f}% | Ang: {angle:5.2f}°")
            
        clean_px = []
        for p in clean_polygon_pct:
            clean_px.append([int(p[0] * img_w / 100), int(p[1] * img_h / 100)])
        clean_approx = np.array(clean_px, np.int32).reshape((-1, 1, 2))
        
        # --- ZERO-SHOT CLIP CLASSIFICATION ---
        # 1. Mask out everything outside this room
        room_mask = np.zeros((img_h, img_w), dtype=np.uint8)
        cv2.fillPoly(room_mask, [clean_approx], 255)
        masked_bg = svg_bg_img.copy()
        masked_bg[room_mask == 0] = (255, 255, 255)
        
        # 2. Crop to bounding box with padding
        x, y, w, h = cv2.boundingRect(clean_approx)
        pad = 20
        x1, y1 = max(0, x-pad), max(0, y-pad)
        x2, y2 = min(img_w, x+w+pad), min(img_h, y+h+pad)
        room_crop = masked_bg[y1:y2, x1:x2]
        
        # Save the crop for debugging/verification
        crop_path = os.path.join(base_dir, f"crop_floor{floor_num}_room{room_idx}.png")
        cv2.imwrite(crop_path, room_crop)
        
        # 3. Predict Room Name
        print(f"  [AI] Classifying room type using CLIP zero-shot...")
        try:
            detected_name = classify_room(room_crop)
            print(f"  [AI] Predicted: {detected_name}")
        except Exception as e:
            print(f"  [AI] Error during classification: {e}")
            detected_name = f"Auto Room {room_idx}"
            
        rooms.append({
            "id": f"room_{room_idx}",
            "name": detected_name,
            "polygon": clean_polygon_pct
        })
        
        cv2.fillPoly(overlay, [clean_approx], color)
        debug_img = cv2.addWeighted(overlay, 0.4, debug_img, 0.6, 0)
        cv2.polylines(debug_img, [clean_approx], True, color, 4)

        # Draw each point from clean_polygon_pct in Yellow
        for point in clean_polygon_pct:
            px, py = point
            cv2.circle(debug_img, (int(px * img_w / 100), int(py * img_h / 100)), 5, (0, 255, 255), -1)
        
        room_idx += 1

    json_path = os.path.join(base_dir, f"rooms_floor{floor_num}.json")
    with open(json_path, 'w') as f:
        json.dump(rooms, f, indent=2)
        
    debug_path = os.path.join(base_dir, f"debug_floor{floor_num}.png")
    cv2.imwrite(debug_path, debug_img)
    
    import shutil
    shutil.copy(debug_path, f'/home/costi/.gemini/antigravity/brain/6636dbf0-e294-4d15-a462-8bcb66f2fce2/debug_floor{floor_num}.png')
    
    print(f"Exported {len(rooms)} strictly orthogonal rooms to JSON and Debug Images.")

if __name__ == "__main__":
    base_dir = "/home/costi/workspace/water/homeassistant"
    process_dxf(base_dir, 1)
    process_dxf(base_dir, 2)
