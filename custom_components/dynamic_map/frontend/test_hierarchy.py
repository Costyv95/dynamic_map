import cv2
import numpy as np
bg_img = cv2.imread('/home/costi/workspace/water/homeassistant/cv2_mask_floor2.png')
gray = cv2.cvtColor(bg_img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
kernel = np.ones((3,3), np.uint8)
thresh = cv2.erode(thresh, kernel, iterations=1)
thresh = cv2.dilate(thresh, kernel, iterations=1)

contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
print("Found:", len(contours))
valid = []
for i, c in enumerate(contours):
    area = cv2.contourArea(c)
    if area > (thresh.shape[0]*thresh.shape[1])*0.005 and area < (thresh.shape[0]*thresh.shape[1])*0.9:
        print(f"Contour {i}: Area={area}, Hierarchy={hierarchy[0][i]}")
        valid.append(c)

print("Valid:", len(valid))
