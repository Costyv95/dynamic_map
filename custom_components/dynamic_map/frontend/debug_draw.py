import cv2
import json
import numpy as np
import shutil
import sys
import colorsys

def get_distinct_color(index, total):
    # Generates distinct RGB colors evenly spaced across the hue spectrum
    hue = index / max(1, total)
    rgb = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
    return (int(rgb[2]*255), int(rgb[1]*255), int(rgb[0]*255)) # BGR for OpenCV

def process_debug(floor_num):
    bg_path = f'/home/costi/workspace/water/homeassistant/bg_floor{floor_num}.png'
    json_path = f'/home/costi/workspace/water/homeassistant/rooms_floor{floor_num}.json'
    
    img = cv2.imread(bg_path)
    if img is None:
        print(f"Failed to load {bg_path}")
        return
        
    h, w = img.shape[:2]
    
    # Recreate the threshold image used for splitting
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    kernel = np.ones((5,5), np.uint8)
    thresh = cv2.erode(thresh, kernel, iterations=2)
    thresh = cv2.dilate(thresh, kernel, iterations=2)
    
    # Convert thresh back to BGR so we can draw colored polygons on it
    thresh_color = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    try:
        with open(json_path) as f:
            rooms = json.load(f)
    except Exception as e:
        print(f"Failed to load json: {e}")
        return

    # Draw on both base img and raw thresh img
    overlay_img = img.copy()
    overlay_thresh = thresh_color.copy()

    for idx, r in enumerate(rooms):
        color = get_distinct_color(idx, len(rooms))
        
        pts = np.array([[int(pt[0]/100 * w), int(pt[1]/100 * h)] for pt in r['polygon']], np.int32)
        pts = pts.reshape((-1, 1, 2))
        
        # Draw on standard debug
        cv2.polylines(img, [pts], True, color, 4)
        cv2.fillPoly(overlay_img, [pts], color)
        
        # Draw on raw debug
        cv2.polylines(thresh_color, [pts], True, color, 4)
        cv2.fillPoly(overlay_thresh, [pts], color)

    # Blend overlays
    final_img = cv2.addWeighted(overlay_img, 0.4, img, 0.6, 0)
    final_thresh = cv2.addWeighted(overlay_thresh, 0.4, thresh_color, 0.6, 0)

    # Save outputs
    out_img = f'/home/costi/workspace/water/homeassistant/debug_floor{floor_num}.png'
    out_thresh = f'/home/costi/workspace/water/homeassistant/raw_debug_floor{floor_num}.png'
    
    cv2.imwrite(out_img, final_img)
    cv2.imwrite(out_thresh, final_thresh)

    # Copy to artifacts
    brain_dir = '/home/costi/.gemini/antigravity/brain/6636dbf0-e294-4d15-a462-8bcb66f2fce2'
    shutil.copy(out_img, f'{brain_dir}/debug_floor{floor_num}.png')
    shutil.copy(out_thresh, f'{brain_dir}/raw_debug_floor{floor_num}.png')
    print(f"Exported Floor {floor_num} Debugs!")

if __name__ == "__main__":
    process_debug(1)
    process_debug(2)
