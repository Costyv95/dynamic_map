import ezdxf

doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor1.dxf")
xs, ys = [], []
for entity in doc.modelspace().query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        for p in entity.get_points('xy'):
            xs.append(p[0]); ys.append(p[1])
if xs: print("Floor 1 Walls:", max(xs)-min(xs), max(ys)-min(ys))

doc2 = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor2.dxf")
xs2, ys2 = [], []
for entity in doc2.modelspace().query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        for p in entity.get_points('xy'):
            xs2.append(p[0]); ys2.append(p[1])
if xs2: print("Floor 2 Walls:", max(xs2)-min(xs2), max(ys2)-min(ys2))
