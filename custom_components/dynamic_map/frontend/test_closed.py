import ezdxf
doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor2.dxf")
msp = doc.modelspace()
for entity in msp.query('LWPOLYLINE'):
    if entity.dxf.layer.lower() == 'walls':
        print(f"Points: {len(list(entity.vertices()))}, Closed: {entity.closed}")
