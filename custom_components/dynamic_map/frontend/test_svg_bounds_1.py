import re
with open('/home/costi/workspace/water/homeassistant/floor1.svg') as f:
    svg = f.read()

path_match = re.search(r'd="M([^"]+)"', svg)
if path_match:
    d = path_match.group(1)
    nums = [float(n) for n in re.findall(r'-?\d+\.\d+', d)]
    xs = nums[0::2]
    ys = nums[1::2]
    print(f"SVG Path Width: {max(xs)-min(xs)}, Height: {max(ys)-min(ys)}")
