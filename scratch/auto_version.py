import os
import re
import subprocess
import time

def get_auto_version():
    try:
        # Get latest commit author date (YYYYMMDDHHMMSS)
        commit_date = subprocess.check_output(
            ["git", "log", "-1", "--format=%cd", "--date=format:%Y%m%d%H%M%S"],
            text=True
        ).strip()
        # Get latest commit short hash
        commit_hash = subprocess.check_output(
            ["git", "log", "-1", "--format=%h"],
            text=True
        ).strip()
    except Exception:
        commit_date = time.strftime("%Y%m%d%H%M%S")
        commit_hash = "local"

    try:
        # Check if working directory is dirty
        is_dirty = subprocess.check_output(["git", "status", "--porcelain"], text=True).strip() != ""
    except Exception:
        is_dirty = True

    if is_dirty:
        # Append current system time to force cache-busting for uncommitted local edits
        current_time = time.strftime("%H%M%S")
        version_str = f"3.0.3-{commit_hash}-dev-{current_time}"
    else:
        version_str = f"3.0.3-{commit_hash}"
        
    return version_str

def run_auto_version():
    version_str = get_auto_version()
    print(f"=== 🔄 Auto-Versioning: Resolved Version: {version_str} ===")

    frontend_dir = "/home/costi/workspace/dynamic_map/custom_components/dynamic_map/frontend"
    init_path = "/home/costi/workspace/dynamic_map/custom_components/dynamic_map/__init__.py"

    # Regex to match any ?v= query string (e.g. ?v=3.0.3 or ?v=2.74 or ?v=3.0.3-bf7dcc3-dev-125000)
    version_regex = re.compile(r"\?v=[a-zA-Z0-9.\-_]+")

    # 1. Update all .js and .html files in the frontend folder
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith((".js", ".html")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                updated = False

                # Replace import query parameter
                new_content = version_regex.sub(f"?v={version_str}", content)
                if new_content != content:
                    content = new_content
                    updated = True

                # Replace version in console.log (e.g. Version: 3.0.3)
                log_regex = re.compile(r"\(Version:\s*[a-zA-Z0-9.\-_]+\)")
                new_content = log_regex.sub(f"(Version: {version_str})", content)
                if new_content != content:
                    content = new_content
                    updated = True

                if updated:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Busted cache in: {file_path}")

    # 2. Update __init__.py panel config URL version
    if os.path.exists(init_path):
        with open(init_path, "r", encoding="utf-8") as f:
            init_content = f.read()
        
        new_content = version_regex.sub(f"?v={version_str}", init_content)
        if new_content != init_content:
            with open(init_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Busted panel URL version in: {init_path}")

    print("=== 🎉 Auto-Versioning Completed! ===")

if __name__ == "__main__":
    run_auto_version()
