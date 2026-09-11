#!/usr/bin/env python3
"""Static server + mocked /api/dynamic_map/* for browser checks of the editor and card.

Serves:
  /dynamic_map_ui/...   -> ./frontend
  /dynamic_map_data/... -> ./data
  /api/dynamic_map/*    -> canned JSON (save writes into ./data)
  /card.html, /editor.html -> test pages
"""
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
UI = os.path.join(ROOT, "frontend")

ENTITIES = [
    {"id": "light.desk_lamp", "name": "Desk lamp"},
    {"id": "vacuum.silvester", "name": "Silvester"},
    {"id": "sensor.room_temperature", "name": "Room temperature"},
]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def translate_path(self, path):
        path = path.split("?", 1)[0]
        if path.startswith("/dynamic_map_ui/"):
            return os.path.join(UI, path[len("/dynamic_map_ui/"):])
        if path.startswith("/dynamic_map_data/"):
            return os.path.join(DATA, path[len("/dynamic_map_data/"):])
        if path == "/editor.html":
            return os.path.join(UI, "editor.html")
        return os.path.join(ROOT, path.lstrip("/"))

    def do_GET(self):
        p = self.path.split("?", 1)[0]
        if p == "/api/dynamic_map/floors":
            floors = sorted({int(f.split("_floor")[1].split(".")[0]) for f in os.listdir(DATA) if f.startswith("rooms_floor")})
            return self._json({"success": True, "floors": floors, "version": "test"})
        if p == "/api/dynamic_map/registry":
            return self._json({"success": True, "areas": [{"id": "living", "name": "Living", "default_light": "light.desk_lamp"}], "floors": []})
        if p == "/api/dynamic_map/entities":
            return self._json({"success": True, "entities": ENTITIES})
        if p == "/api/dynamic_map/files":
            return self._json({"success": True, "files": [], "icons": []})
        if p.startswith("/api/dynamic_map/"):
            return self._json({"success": False, "error": "not mocked"}, 404)
        return super().do_GET()

    def do_HEAD(self):
        return super().do_HEAD()

    def do_POST(self):
        p = self.path.split("?", 1)[0]
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        if p == "/api/dynamic_map/save":
            body = json.loads(raw or b"{}")
            name = body.get("filename", "")
            if name.endswith(".json"):
                with open(os.path.join(DATA, name), "w") as f:
                    json.dump(body.get("content"), f)
            return self._json({"success": True})
        return self._json({"success": False, "error": "not mocked"}, 404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    os.chdir(ROOT)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
