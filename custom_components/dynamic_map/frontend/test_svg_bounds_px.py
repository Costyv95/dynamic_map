import re

def get_svg_wall_pixel_bounds(svg_path):
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg = f.read()
        
    matrix_match = re.search(r'transform="matrix\(([^)]+)\)"', svg)
    if not matrix_match:
        return None
        
    vals = [float(v) for v in matrix_match.group(1).split()]
    sx, _, _, sy, tx, ty = vals
    matrix_str = matrix_match.group(1)
    
    # Find all paths that use this exact matrix
    # Sweet Home 3D usually puts the matrix on the <path> or a parent <g>
    # Actually, let's just find all d="..." that immediately follow this matrix, or are in the same block.
    # To be safe, let's find all d="..." inside the file, but only the first few which are the walls.
    # Actually, Sweet Home 3D SVG has walls as the first elements.
    paths = re.findall(r'transform="matrix\(' + re.escape(matrix_str) + r'\)"\s+d="M([^"]+)"', svg)
    if not paths:
        # Maybe matrix is on a parent <g>
        g_match = re.search(r'<g[^>]*transform="matrix\(' + re.escape(matrix_str) + r'\)"[^>]*>(.*?)</g>', svg, re.DOTALL)
        if g_match:
            paths = re.findall(r'd="M([^"]+)"', g_match.group(1))
            
    if not paths:
        # Fallback: just take the first 2 paths which are usually the wall fills and outlines
        paths = re.findall(r'd="M([^"]+)"', svg)[:2]

    all_x = []
    all_y = []
    for d in paths:
        nums = [float(n) for n in re.findall(r'-?\d+\.\d+', d)]
        all_x.extend(nums[0::2])
        all_y.extend(nums[1::2])
        
    min_x_svg, max_x_svg = min(all_x), max(all_x)
    min_y_svg, max_y_svg = min(all_y), max(all_y)
    
    # Convert to pixels
    px_min_x = min_x_svg * sx + tx
    px_max_x = max_x_svg * sx + tx
    px_min_y = min_y_svg * sy + ty
    px_max_y = max_y_svg * sy + ty
    
    # Handle negative scale just in case
    if px_min_x > px_max_x: px_min_x, px_max_x = px_max_x, px_min_x
    if px_min_y > px_max_y: px_min_y, px_max_y = px_max_y, px_min_y
        
    return px_min_x, px_max_x, px_min_y, px_max_y

print("Floor 1:", get_svg_wall_pixel_bounds("/home/costi/workspace/water/homeassistant/floor1.svg"))
print("Floor 2:", get_svg_wall_pixel_bounds("/home/costi/workspace/water/homeassistant/floor2.svg"))
