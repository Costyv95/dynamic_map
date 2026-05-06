import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import os

def render_dxf(floor_num):
    file_path = f"/home/costi/workspace/water/homeassistant/floor{floor_num}.dxf"
    if not os.path.exists(file_path):
        return
        
    doc = ezdxf.readfile(file_path)
    msp = doc.modelspace()

    # Setup matplotlib figure
    fig = plt.figure(figsize=(10, 10))
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(doc)
    out = MatplotlibBackend(ax)
    
    # Render all entities
    Frontend(ctx, out).draw_layout(msp, finalize=True)
    
    output_path = f"/home/costi/.gemini/antigravity/brain/6636dbf0-e294-4d15-a462-8bcb66f2fce2/raw_dxf_floor{floor_num}.png"
    fig.savefig(output_path, dpi=300)
    plt.close(fig)
    print(f"Generated raw render: {output_path}")

if __name__ == "__main__":
    render_dxf(1)
    render_dxf(2)
