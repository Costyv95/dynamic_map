import ezdxf
doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor2.dxf")
for entity in doc.modelspace().query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        pts = list(entity.vertices())
        print(f"Wall Polyline has {len(pts)} points, closed: {entity.closed}")
