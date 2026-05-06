import os
from PIL import Image, ImageChops

def trim(im):
    # Convert to RGB to easily find the white background
    bg = Image.new("RGB", im.size, (255, 255, 255))
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        # Flatten alpha if there is any, assuming white background
        temp = Image.new("RGBA", im.size, (255, 255, 255, 255))
        temp.paste(im, mask=im)
        diff = ImageChops.difference(temp.convert("RGB"), bg)
    else:
        diff = ImageChops.difference(im.convert("RGB"), bg)
        
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

base_dir = "/home/costi/workspace/water/homeassistant"

for floor in ["1", "2"]:
    raw_path = os.path.join(base_dir, f"raw_floor{floor}.png")
    out_path = os.path.join(base_dir, f"floor{floor}.png")
    
    if os.path.exists(raw_path):
        try:
            im = Image.open(raw_path)
            cropped = trim(im)
            cropped.save(out_path)
            print(f"Successfully cropped {raw_path} and saved to {out_path}")
        except Exception as e:
            print(f"Failed to process {raw_path}: {e}")
    else:
        print(f"File not found: {raw_path}")
