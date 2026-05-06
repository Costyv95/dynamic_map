import re
import ezdxf

def get_svg_wall_pixel_bounds(svg_path):
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg = f.read()
        
    matrix_match = re.search(r'transform="matrix\(([^)]+)\)"', svg)
    if not matrix_match:
        return None
        
    vals = [float(v) for v in matrix_match.group(1).split()]
    sx, _, _, sy, tx, ty = vals
    matrix_str = matrix_match.group(1)
    
    # In Sweet Home 3D, walls are often grouped in a <g> with the matrix
    g_match = re.search(r'<g[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*>(.*?)</g>', svg, re.DOTALL)
    if g_match:
        paths = re.findall(r'd="M([^"]+)"', g_match.group(1))
    else:
        # If no <g>, they are just <path>s with the matrix
        paths = re.findall(r'<path[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*d="M([^"]+)"', svg)

    if not paths:
        return None

    all_x = []
    all_y = []
    for d in paths:
        nums = [float(n) for n in re.findall(r'-?\d+\.\d+', d)]
        all_x.extend(nums[0::2])
        all_y.extend(nums[1::2])
        
    min_x_svg, max_x_svg = min(all_x), max(all_x)
    min_y_svg, max_y_svg = min(all_y), max(all_y)
    
    # Convert to pixels
    px_points = [
        (min_x_svg * sx + tx, min_y_svg * sy + ty),
        (max_x_svg * sx + tx, min_y_svg * sy + ty),
        (min_x_svg * sx + tx, max_y_svg * sy + ty),
        (max_x_svg * sx + tx, max_y_svg * sy + ty),
    ]
    
    px_min_x = min(p[0] for p in px_points)
    px_max_x = max(p[0] for p in px_points)
    px_min_y = min(p[1] for p in px_points)
    px_max_y = max(p[1] for p in px_points)
    
    return px_min_x, px_max_x, px_min_y, px_max_y

print("Floor 1 SVG Wall Pixel Bounds:", get_svg_wall_pixel_bounds("/home/costi/workspace/water/homeassistant/floor1.svg"))
print("Floor 2 SVG Wall Pixel Bounds:", get_svg_wall_pixel_bounds("/home/costi/workspace/water/homeassistant/floor2.svg"))

def get_dxf_bounds(floor):
    doc = ezdxf.readfile(f"/home/costi/workspace/water/homeassistant/floor{floor}.dxf")
    msp = doc.modelspace()
    wall_xs, wall_ys = [], []
    for entity in msp.query('LWPOLYLINE'):
        if entity.dxf.layer.lower() == 'walls':
            for p in entity.get_points('xy'):
                wall_xs.append(p[0])
                wall_ys.append(p[1])
    return min(wall_xs), max(wall_xs), min(wall_ys), max(wall_ys)

b1 = get_dxf_bounds(1)
print(f"Floor 1 DXF Bounds: {b1}, Width={b1[1]-b1[0]}, Height={b1[3]-b1[2]}")
b2 = get_dxf_bounds(2)
print(f"Floor 2 DXF Bounds: {b2}, Width={b2[1]-b2[0]}, Height={b2[3]-b2[2]}")
