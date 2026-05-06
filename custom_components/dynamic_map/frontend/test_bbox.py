import ezdxf
from ezdxf import bbox
doc = ezdxf.readfile("/home/costi/workspace/water/homeassistant/floor1.dxf")
msp = doc.modelspace()
for entity in msp.query('INSERT[layer=="doors"]'):
    box = bbox.extents([entity])
    print(f"Door box: {box.extmin} to {box.extmax}")
