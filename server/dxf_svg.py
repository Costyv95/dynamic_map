"""Background image helpers for the DXF/SVG pipeline: rasterise the SVG plan, clean it with the wall mask."""
import os
import re

try:
    import cv2
    import numpy as np
except ImportError:
    raise Exception("The 'Recompute' feature requires 'opencv-python-headless' and 'numpy' to be installed on your Home Assistant OS.")


def _prepare_svg_background(svg_path, bg_png_path):
    """Reads SVG, cleans text, extracts matrix/dimensions, and rasterizes to PNG."""
    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"File not found: {svg_path}")
        
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Remove all text elements from the SVG to ensure a clean background
    svg_content = re.sub(r'<text[^>]*>.*?</text>', '', svg_content, flags=re.DOTALL)
    
    # Remove any elements with stroke-dasharray (dotted/dashed lines)
    svg_content = re.sub(r'<([a-zA-Z0-9]+)[^>]*stroke-dasharray[^>]*>.*?</\1>|<[a-zA-Z0-9]+[^>]*stroke-dasharray[^>]*/>', '', svg_content, flags=re.DOTALL)
    
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

def _clean_background_with_mask(bg_png_path, bg_img, walls_img, img_w, img_h, debug_dir, floor_num):
    """Masks the original background image, turning everything outside the house exterior to pure white, and overlays the strict walls."""
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
    
    # Overlay strict walls as solid black
    gray_walls = cv2.cvtColor(walls_img, cv2.COLOR_BGR2GRAY)
    cleaned_bg = np.where(gray_walls[:, :, None] < 128, [0, 0, 0], cleaned_bg)
    
    cv2.imwrite(bg_png_path, cleaned_bg)
    cv2.imwrite(os.path.join(debug_dir, f"floodfill_debug_floor{floor_num}.png"), thresh)
