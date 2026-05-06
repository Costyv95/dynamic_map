import ezdxf

doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor1.dxf")
msp = doc.modelspace()
for entity in msp.query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        pts = list(entity.get_points('xy'))
        print("Floor 1 DXF Polyline:", pts[:3])
        break
