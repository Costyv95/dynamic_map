import cv2
import numpy as np

img = cv2.imread("/home/costi/workspace/water/homeassistant/cv2_mask_floor1.png", cv2.IMREAD_GRAYSCALE)
_, thresh = cv2.threshold(img, 240, 255, cv2.THRESH_BINARY)
contours, hierarchy = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for i, cnt in enumerate(contours):
    area = cv2.contourArea(cnt)
    print(f"C{i}: {area}")
    cv2.drawContours(out, [cnt], -1, (0, 0, 255), 5)
    
cv2.imwrite("/home/costi/workspace/water/homeassistant/test_contours_drawn.png", out)
