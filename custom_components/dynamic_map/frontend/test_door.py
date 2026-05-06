import ezdxf
doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor2.dxf")
msp = doc.modelspace()
doors = list(msp.query('INSERT[layer=="doors"]'))
if doors:
    door = doors[0]
    print(f"Door 0:")
    for v_ent in door.virtual_entities():
        print(f"  - {v_ent.dxftype()}")
        if v_ent.dxftype() == 'ARC':
            print(f"    Arc start: {v_ent.start_point}, end: {v_ent.end_point}")
