# AI-CE Floorplan Visualizer Launcher
# -----------------------------------
# This script starts a local Flask proxy server and opens the web GUI in your browser.
# Usage: python -m waitress --host=0.0.0.0 --port=5000 start:app

import subprocess
import time
import webbrowser
import os
import sys

# Step 1: Dependency check and install

def check_dependencies():
    """
    Ensure required Python packages are installed.
    Installs any missing packages automatically.
    """
    required = ['flask', 'flask_cors', 'requests']
    missing = []
    for package in required:
        try:
            __import__(package)
        except ImportError:
            missing.append(package.replace('_', '-'))
    if missing:
        print("Installing missing dependencies:", ', '.join(missing))
        subprocess.check_call([sys.executable, '-m', 'pip', 'install'] + missing)
        print("All dependencies installed!\n")
    return True

# ---- Flask app and endpoints at module level ----

from flask import Flask, request, Response, send_from_directory
from flask_cors import CORS
import requests as req

app = Flask(__name__)
CORS(app)

#REMOTE_SERVER_URL = ""
ZIP_SAVE_DIR = 'zip_file'
os.makedirs(ZIP_SAVE_DIR, exist_ok=True)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html') # link to index.html

@app.route('/proxy/receive_data', methods=['POST', 'OPTIONS'])
def proxy_receive_data():
    if request.method == 'OPTIONS':
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    try:
        print("Proxy: Forwarding request to remote server...")
        files = {}
        data = {}

        # Get remote IP and port from form data (sent by frontend settings)
        remote_ip = request.form.get("remote_ip")
        remote_port = request.form.get("remote_port")
        remote_url = f"http://{remote_ip}:{remote_port}/receive_data"
        print(f"Using remote URL: {remote_url}")

        # Handle image upload
        if 'images' in request.files:
            image_file = request.files['images']
            files['images'] = (image_file.filename, image_file.stream, image_file.content_type)
            print("Image received:", image_file.filename)
        # Handle form data
        for key in request.form:
            if key not in ["remote_ip", "remote_port"]:
                data[key] = request.form[key]
                print(f"Form field: {key} = {request.form[key]}")
        print("Sending to remote server...")
        response = req.post(remote_url, files=files, data=data, timeout=120)
        print("Response Status:", response.status_code)
        print("Content-Length:", len(response.content), "bytes")
        proxy_response = Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get('Content-Type', 'application/octet-stream')
        )
        proxy_response.headers['Access-Control-Allow-Origin'] = '*'
        return proxy_response
    except Exception as e:
        print("Proxy error:", str(e))
        return Response(f"Proxy error: {str(e)}", status=500,
                        headers={'Access-Control-Allow-Origin': '*'})

@app.route('/upload_zip', methods=['POST'])
def upload_zip():
    if 'zip' not in request.files:
        return 'No ZIP file uploaded', 400
    zip_file = request.files['zip']
    save_path = os.path.join(ZIP_SAVE_DIR, zip_file.filename)
    zip_file.save(save_path)
    print(f"ZIP file saved to {save_path}")
    return f"ZIP file saved to {save_path}", 200

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ---- Launcher logic ----

def start_server():
    """
    Start the Flask proxy server and open the browser to the web GUI.
    """
    print("\n" + "="*60)
    print("AI-CE Floorplan Visualizer - Launcher")
    print("="*60 + "\n")

    # Ensure dependencies
    check_dependencies()

    print("Starting proxy server at: http://localhost:5000")
    print("Browser will open in 3 seconds...")
    print("Press Ctrl+C to stop the server.")
    print("\n" + "="*60 + "\n")

    # Open browser after short delay (in background)
    import threading
    def open_browser_delayed():
        time.sleep(3)
        print("Opening browser...")
        webbrowser.open('http://localhost:5000')
    browser_thread = threading.Thread(target=open_browser_delayed)
    browser_thread.daemon = True
    browser_thread.start()

    print("Server starting...\n")
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == '__main__':
    start_server()