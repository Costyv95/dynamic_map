import cv2

img = cv2.imread("/home/costi/workspace/water/homeassistant/cv2_mask_floor1.png", cv2.IMREAD_GRAYSCALE)
print(f"Mask size: {img.shape}")
_, thresh = cv2.threshold(img, 240, 255, cv2.THRESH_BINARY)

contours, hierarchy = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
print(f"Total contours: {len(contours)}")

h, w = img.shape
min_area = (w * h) * 0.015
max_area = (w * h) * 0.9

for i, cnt in enumerate(contours):
    area = cv2.contourArea(cnt)
    if min_area < area < max_area:
        print(f"Contour {i}: Area {area} (min {min_area}, max {max_area})")

