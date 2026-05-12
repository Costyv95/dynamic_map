from flask import Flask, request, jsonify
import dxf_processor
import os

app = Flask(__name__)

@app.route('/process', methods=['POST'])
def process():
    data = request.json or {}
    floor_num = data.get('floor', 1)
    svg_file = data.get('svg_file')
    dxf_file = data.get('dxf_file')
    
    # In the Docker container, the samba share is mounted to /data
    base_dir = '/data'
    
    if not os.path.exists(base_dir):
        return jsonify({"success": False, "error": f"Base directory {base_dir} not found. Is the Samba share mounted?"}), 500
        
    try:
        dxf_processor.process_dxf(base_dir=base_dir, floor_num=floor_num, svg_filename=svg_file, dxf_filename=dxf_file)
        return jsonify({"success": True, "message": f"Floor {floor_num} processed successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    # Run explicitly on 0.0.0.0 to allow external connections
    app.run(host='0.0.0.0', port=5000)
