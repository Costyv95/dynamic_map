import ezdxf

doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor1.dxf")
msp = doc.modelspace()
for entity in msp.query('INSERT'):
    for v_entity in entity.virtual_entities():
        if v_entity.dxftype() == 'LWPOLYLINE':
            pts = list(v_entity.get_points('xy'))
            print("DXF Polyline:", pts[:3])
            break
    break
