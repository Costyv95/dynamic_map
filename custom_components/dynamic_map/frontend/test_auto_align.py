import cv2
import numpy as np

img = cv2.imread("/home/costi/workspace/water/homeassistant/bg_floor2.png", cv2.IMREAD_GRAYSCALE)
# Find all non-white pixels
coords = cv2.findNonZero((img < 250).astype(np.uint8))
x, y, w, h = cv2.boundingRect(coords)
print(f"SVG Image Content Bounds: x={x}, y={y}, w={w}, h={h}")
