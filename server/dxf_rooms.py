"""Room extraction from the wall mask."""
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
