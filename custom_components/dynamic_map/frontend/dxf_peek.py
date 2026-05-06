import os
import ezdxf

def investigate_dxf(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"\n--- Investigating: {os.path.basename(file_path)} ---")
    try:
        doc = ezdxf.readfile(file_path)
    except IOError:
        print(f"Not a DXF file or a generic I/O error.")
        return
    except ezdxf.DXFStructureError:
        print(f"Invalid or corrupted DXF file.")
        return
        
    msp = doc.modelspace()
    
    # Count entities per layer
    layer_stats = {}
    for entity in msp:
        layer = entity.dxf.layer
        if layer not in layer_stats:
            layer_stats[layer] = {}
            
        entity_type = entity.dxftype()
        if entity_type not in layer_stats[layer]:
            layer_stats[layer][entity_type] = 0
            
        layer_stats[layer][entity_type] += 1

    print(f"Layers and Entities found:")
    for layer, entities in layer_stats.items():
        print(f"  Layer: '{layer}'")
        for etype, count in entities.items():
            print(f"    - {etype}: {count}")
            
    # Look for specific layers
    if "ROOM" in layer_stats or any("room" in l.lower() for l in layer_stats.keys()):
        print("\nSUCCESS: Found a room-related layer! MagicPlan exported semantic rooms!")
    else:
        print("\nWARNING: No explicit 'ROOM' layer found. We might have to reconstruct polygons from walls.")

base_dir = "/home/costi/workspace/water/homeassistant"
investigate_dxf(os.path.join(base_dir, "floor1.dxf"))
investigate_dxf(os.path.join(base_dir, "floor2.dxf"))
