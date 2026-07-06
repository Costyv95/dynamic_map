import os

from flask import Flask, jsonify, request

import dxf_processor

app = Flask(__name__)

# In the Docker container, the HA /config share is mounted to /data by default,
# so map data lives at /data/dynamic_map_data. Override via env for other setups.
BASE_DIR = os.environ.get("DYNAMIC_MAP_DATA_DIR", "/data/dynamic_map_data")
PORT = int(os.environ.get("DYNAMIC_MAP_PORT", "5000"))


@app.route('/process', methods=['POST'])
def process():
    data = request.json or {}
    floor_num = data.get('floor', 1)
    svg_file = data.get('svg_file')
    dxf_file = data.get('dxf_file')

    if not os.path.exists(BASE_DIR):
        return jsonify({
            "success": False,
            "error": f"Base directory {BASE_DIR} not found. Is the HA config share mounted?",
        }), 500

    try:
        dxf_processor.process_dxf(base_dir=BASE_DIR, floor_num=floor_num, svg_filename=svg_file, dxf_filename=dxf_file)
        return jsonify({"success": True, "message": f"Floor {floor_num} processed successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})


if __name__ == '__main__':
    # Run explicitly on 0.0.0.0 to allow external connections
    app.run(host='0.0.0.0', port=PORT)
