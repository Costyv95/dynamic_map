import re

svg_file = "/home/costi/workspace/water/homeassistant/floor1.svg"
with open(svg_file, "r") as f:
    content = f.read()

# Find the first matrix transform on a path
matrices = re.findall(r'transform="matrix\(([^)]+)\)"', content)
print("Matrices found:", len(matrices))
if matrices:
    for i in range(min(5, len(matrices))):
        print(matrices[i])
