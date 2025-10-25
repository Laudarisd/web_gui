# 7AI-CE Floorplan Visualizer

A web-based application for uploading floorplan images, receiving AI analysis results, and visualizing detected objects.

## 🚀 Quick Start (EASIEST METHOD)

### Windows Users:

**Just double-click:** `START.bat`

That's it! Everything starts automatically.

### All Platforms:

```bash
python start.py
```

The browser will open automatically at `http://localhost:5000`

---

## 📖 Alternative Methods

### Option 1: Manual Proxy Server

1. **Install dependencies:**

   ```bash
   pip install flask flask-cors requests
   ```
2. **Start the proxy server:**

   ```bash
   python proxy_server.py
   ```
3. **Open in browser:**

   ```
   http://localhost:5000
   ```

### Option 2: Python Client (Command Line)

```bash
python test_client_image_mode.py
```

Files will be saved to `received_zip/` folder automatically.

## 📁 Files

- `index.html` - Web interface with visualization
- `proxy_server.py` - Local CORS proxy server
- `test_client_image_mode.py` - Python command-line client

## 🎨 Features

### Web Interface

- ✅ Beautiful light olive theme
- ✅ Drag-and-drop image upload
- ✅ Real-time progress tracking
- ✅ ZIP file extraction and viewing
- ✅ JSON data visualization
- ✅ Object detection overlay on images
- ✅ Download and save results

### Visualization

- Bounding boxes for detected objects
- Color-coded class labels
- Detection statistics
- Adjustable overlay opacity
- Save visualization as image

## 🔧 Troubleshooting

### CORS Error in Browser

**Problem:** Browser blocks cross-origin requests

**Solution 1 - Use Proxy Server:**

```bash
python proxy_server.py
# Then open http://localhost:5000
```

**Solution 2 - Use Python Client:**

```bash
python test_client_image_mode.py
```

### Dependencies Not Found

```bash
pip install flask flask-cors requests
```

## 📦 How It Works

1. **Upload** - Select floorplan image and fill in project details
2. **Send** - Data is sent to remote AI server (via proxy to bypass CORS)
3. **Receive** - Server processes image and returns ZIP with results
4. **Extract** - View all files in the ZIP (JSON, images, etc.)
5. **Visualize** - Overlay detection results on original image

## 🌐 Server Configuration

Remote server: `http://61.97.0.0:0000/receive_data`

To change server URL, edit:

- `proxy_server.py`: Line 19 (REMOTE_SERVER_URL)
- `test_client_image_mode.py`: Line 7 (REMOTE_SERVER_URL)

## 💡 Tips

- Use **proxy server** for web interface (best experience)
- Use **Python client** for automation and batch processing
- **Load local ZIP** if you already have results downloaded
- **Adjust opacity** slider for better visualization

## 🐛 Known Issues

- Direct browser connection blocked by CORS (use proxy)
- Large images may take time to process (up to 2 minutes)

---

Made with ❤️ for AI-CE Floorplan Analysis
