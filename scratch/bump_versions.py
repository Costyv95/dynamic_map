import os
import re

def bump_versions():
    frontend_dir = "/home/costi/workspace/dynamic_map/custom_components/dynamic_map/frontend"
    manifest_path = "/home/costi/workspace/dynamic_map/custom_components/dynamic_map/manifest.json"
    init_path = "/home/costi/workspace/dynamic_map/custom_components/dynamic_map/__init__.py"

    print("=== 🔄 Bumping versions and busting cache ===")

    # 1. Update all .js and .html files in the frontend folder
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith((".js", ".html")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                updated = False

                # Replace import query parameter
                if "?v=2.74" in content:
                    content = content.replace("?v=2.74", "?v=3.0.3")
                    updated = True

                # Replace version in console.log
                if "(Version: 2.74)" in content:
                    content = content.replace("(Version: 2.74)", "(Version: 3.0.3)")
                    updated = True

                if updated:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Bumped imports/logs in: {file_path}")

    # 2. Update __init__.py panel config URL version
    if os.path.exists(init_path):
        with open(init_path, "r", encoding="utf-8") as f:
            init_content = f.read()
        
        if "editor.html?v=2.74" in init_content:
            init_content = init_content.replace("editor.html?v=2.74", "editor.html?v=3.0.3")
            with open(init_path, "w", encoding="utf-8") as f:
                f.write(init_content)
            print(f"Bumped panel URL version in: {init_path}")

    # 3. Update manifest.json version
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_content = f.read()
        
        if '"version": "2.7.4"' in manifest_content:
            manifest_content = manifest_content.replace('"version": "2.7.4"', '"version": "3.0.3"')
            with open(manifest_path, "w", encoding="utf-8") as f:
                f.write(manifest_content)
            print(f"Bumped integration version in: {manifest_path}")

    print("=== 🎉 Version Bumping Completed! ===")

if __name__ == "__main__":
    bump_versions()
