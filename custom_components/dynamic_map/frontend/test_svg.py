import re

def get_svg_info(svg_path):
    with open(svg_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    w_match = re.search(r'<svg[^>]*width="(\d+)"', content)
    h_match = re.search(r'<svg[^>]*height="(\d+)"', content)
    w = int(w_match.group(1)) if w_match else 2000
    h = int(h_match.group(1)) if h_match else 2000
    
    # Find the first matrix transform which typically corresponds to the main floor layer
    matrix_match = re.search(r'transform="matrix\(([^)]+)\)"', content)
    if matrix_match:
        vals = [float(v) for v in matrix_match.group(1).split()]
        sx, _, _, sy, tx, ty = vals
    else:
        sx, sy, tx, ty = 1, 1, 0, 0
        
    return w, h, sx, sy, tx, ty

print("Floor 1:", get_svg_info("/home/costi/workspace/water/homeassistant/floor1.svg"))
print("Floor 2:", get_svg_info("/home/costi/workspace/water/homeassistant/floor2.svg"))
