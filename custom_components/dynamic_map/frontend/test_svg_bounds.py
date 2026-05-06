import re
with open('/home/costi/workspace/water/homeassistant/floor2.svg') as f:
    svg = f.read()

matrix_match = re.search(r'transform="matrix\(([^)]+)\)"', svg)
print("Matrix:", matrix_match.group(1) if matrix_match else "None")

path_match = re.search(r'd="M([^"]+)"', svg)
if path_match:
    d = path_match.group(1)
    # Extract all numbers from the path
    nums = [float(n) for n in re.findall(r'-?\d+\.\d+', d)]
    # They are pairs of x, y
    xs = nums[0::2]
    ys = nums[1::2]
    print(f"SVG Path Bounds: min_x={min(xs)}, max_x={max(xs)}, min_y={min(ys)}, max_y={max(ys)}")
    print(f"SVG Path Width: {max(xs)-min(xs)}, Height: {max(ys)-min(ys)}")
