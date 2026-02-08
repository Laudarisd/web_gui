// ============================================================================
// viz.js
// Visualization module for JSON floorplan annotation data over images
// Handles zooming, dragging, drawing bounding boxes, polygons, and labels.
// ============================================================================

// -----------------------------
// Global variables
// -----------------------------
let zoom = 1;                        // Current zoom level for the viewer
let isDragging = false;              // Drag state flag
let startX = 0;                      // Mouse start X position for drag
let startY = 0;                      // Mouse start Y position for drag
let initialScrollLeft = 0;           // Scroll offset before drag (X)
let initialScrollTop = 0;            // Scroll offset before drag (Y)
let originalWidth = 0;               // Image natural width
let originalHeight = 0;              // Image natural height
let classMap = {};                   // Map of class name → list of objects
let currentObjs = [];                // Currently visualized objects

// -----------------------------
// Core DOM elements
// -----------------------------
const viewer = document.getElementById("viewer");          // Scrollable image viewer
const zoomContainer = document.getElementById("zoomContainer"); // Container for image & overlay
const img = document.getElementById("mainImage");          // Base floorplan image
const canvas = document.getElementById("mainCanvas");      // Annotation drawing layer

// Set viewer scroll and positioning
viewer.style.overflow = 'scroll';
zoomContainer.style.position = '';

// -----------------------------
// Viewer interaction listeners
// -----------------------------
viewer.addEventListener("wheel", handleZoom);              // Zoom in/out with scroll wheel
viewer.addEventListener("mousedown", startDrag);           // Begin drag
viewer.addEventListener("mousemove", drag);                // Move image while dragging
viewer.addEventListener("mouseup", endDrag);               // End drag
viewer.addEventListener("mouseleave", endDrag);            // Stop drag when mouse leaves

// -----------------------------
// UI toggles for annotation visibility
// -----------------------------
let showAnnotationText = true;                             // Toggle to show/hide labels
const toggleTextBtn = document.getElementById("toggleTextBtn");
if (toggleTextBtn) {
  toggleTextBtn.addEventListener("click", () => {
    showAnnotationText = !showAnnotationText;
    toggleTextBtn.textContent = showAnnotationText ? "Hide Annotation Text" : "Show Annotation Text";
    updateView();                                          // Redraw when toggled
  });
}

let showKeyPoints = true;                                  // Toggle for showing corner keypoints
const toggleKeyPointsBtn = document.getElementById("toggleKeyPointsBtn");
if (toggleKeyPointsBtn) {
  toggleKeyPointsBtn.addEventListener("click", () => {
    showKeyPoints = !showKeyPoints;
    toggleKeyPointsBtn.textContent = showKeyPoints ? "Hide Key Points" : "Show Key Points";
    updateView();                                          // Redraw when toggled
  });
}

// ============================================================================
// INTERACTION FUNCTIONS: ZOOM & DRAG
// ============================================================================

function handleZoom(e) {
  e.preventDefault();
  const rect = viewer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const oldZoom = zoom;

  // Prevent zooming out smaller than the viewer area
  const minZoom = Math.min(
    viewer.clientWidth / originalWidth,
    viewer.clientHeight / originalHeight
  );
  zoom *= (1 - Math.sign(e.deltaY) * 0.1);
  zoom = Math.max(minZoom, Math.min(zoom, 5));             // Clamp zoom range

  if (zoom === oldZoom) return;

  // Adjust scroll position to keep mouse position stable during zoom
  const offsetX = mouseX + viewer.scrollLeft;
  const offsetY = mouseY + viewer.scrollTop;
  const fractionX = offsetX / (originalWidth * oldZoom);
  const fractionY = offsetY / (originalHeight * oldZoom);

  updateView();

  viewer.scrollLeft = fractionX * (originalWidth * zoom) - mouseX;
  viewer.scrollTop = fractionY * (originalHeight * zoom) - mouseY;
}

function startDrag(e) {
  if (e.button !== 0) return;                              // Left mouse only
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialScrollLeft = viewer.scrollLeft;
  initialScrollTop = viewer.scrollTop;
  viewer.style.cursor = "grabbing";
}

function drag(e) {
  if (!isDragging || (e.buttons & 1) === 0) {
    endDrag();
    return;
  }
  // Move scroll position based on mouse delta
  viewer.scrollLeft = initialScrollLeft - (e.clientX - startX);
  viewer.scrollTop = initialScrollTop - (e.clientY - startY);
}

function endDrag() {
  isDragging = false;
  viewer.style.cursor = "grab";
}

// ============================================================================
// CLASS DETERMINATION HELPER
// Determines the category of each object for color grouping
// ============================================================================
function getClass(o) {
  if (o.class_name) return o.class_name;
  if (o.symbol_polygon) return 'Symbol';
  if (o.polygon) return 'Wall';
  if (o.size_polygon || o.detail_polygon) return 'Text';
  return 'Unknown';
}

// ============================================================================
// MAIN VISUALIZATION FUNCTION
// Handles JSON scaling, color assignment, and viewer update
// ============================================================================
function visualizeOnMain() {
  const isCropJson = currentFileName.toLowerCase().includes('crop');
  let objs = selectedJson.data?.objects || selectedJson.objects || [];
  currentObjs = objs;
  
  console.log(`\n🎯 Visualizing: ${currentFileName}`);
  console.log(`🔍 Is Crop JSON: ${isCropJson}`);
  console.log(`📦 Objects: ${objs.length}`);
  
  // Step 1: Convert coordinates from crop JSON to original image space
  if (!isCropJson && scaleInfo.extracted) {
    console.log(`🔧 Converting coordinates from crop to original scale`);
    console.log(`   Crop: ${scaleInfo.cropWidth}×${scaleInfo.cropHeight}`);
    console.log(`   Original: ${scaleInfo.originalWidth}×${scaleInfo.originalHeight}`);
    console.log(`   Offset: (${scaleInfo.cropXMin}, ${scaleInfo.cropYMin})`);
    
    const scaleX = scaleInfo.scaleX;
    const scaleY = scaleInfo.scaleY;
    const offsetX = scaleInfo.cropXMin || 0;
    const offsetY = scaleInfo.cropYMin || 0;
    
    // Convert each object geometry
    objs = objs.map(o => {
      const converted = { ...o };
      
      if (o.bbox) {
        converted.bbox = {
          xmin: o.bbox.xmin * scaleX + offsetX,
          ymin: o.bbox.ymin * scaleY + offsetY,
          xmax: o.bbox.xmax * scaleX + offsetX,
          ymax: o.bbox.ymax * scaleY + offsetY
        };
      }
      
      // Scale all polygon-based coordinates
      if (o.polygon) {
        converted.polygon = {};
        Object.keys(o.polygon).forEach(key => {
          converted.polygon[key] = [
            o.polygon[key][0] * scaleX + offsetX,
            o.polygon[key][1] * scaleY + offsetY
          ];
        });
      }
      
      if (o.symbol_polygon) {
        converted.symbol_polygon = {};
        Object.keys(o.symbol_polygon).forEach(key => {
          converted.symbol_polygon[key] = [
            o.symbol_polygon[key][0] * scaleX + offsetX,
            o.symbol_polygon[key][1] * scaleY + offsetY
          ];
        });
      }
      
      if (o.size_polygon) {
        converted.size_polygon = {};
        Object.keys(o.size_polygon).forEach(key => {
          converted.size_polygon[key] = [
            o.size_polygon[key][0] * scaleX + offsetX,
            o.size_polygon[key][1] * scaleY + offsetY
          ];
        });
      }
      
      if (o.detail_polygon) {
        converted.detail_polygon = {};
        Object.keys(o.detail_polygon).forEach(key => {
          converted.detail_polygon[key] = [
            o.detail_polygon[key][0] * scaleX + offsetX,
            o.detail_polygon[key][1] * scaleY + offsetY
          ];
        });
      }
      
      return converted;
    });
    
    console.log(`✅ Converted ${objs.length} objects to original scale`);
  } else if (isCropJson) {
    console.log(`✅ Crop JSON - using as-is`);
  }

  // Step 2: Assign a unique color per detected class
  classMap = {};
  const classColors = {};
  objs.forEach((o) => {
    const cls = getClass(o);
    if (!classMap[cls]) {
      classMap[cls] = [];
      classColors[cls] = randomColor();
    }
    o._class = cls;
    o._color = classColors[cls];
    classMap[cls].push(o);
  });

  // Step 3: Build checkboxes for toggling annotation layers
  const controls = document.getElementById("annotationControls");
  controls.innerHTML = "";
  Object.keys(classMap).sort().forEach(cls => {
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = true;
    check.id = `class-toggle-${cls.replace(/\s/g, "-")}`;
    check.addEventListener("change", updateView);
    label.appendChild(check);
    label.append(` ${cls} (${classMap[cls].length})`);
    controls.appendChild(label);
  });
  
  // Step 4: Load the original image and auto-fit to viewer
  img.src = uploadedImgDataUrl;
  img.onload = () => {
    originalWidth = img.naturalWidth;
    originalHeight = img.naturalHeight;

    // Fit image proportionally inside viewer window
    const minZoom = Math.min(
      viewer.clientWidth / originalWidth,
      viewer.clientHeight / originalHeight
    );
    zoom = minZoom;

    updateView();

    // Center the image in the viewer
    viewer.scrollLeft = Math.max(0, (originalWidth * zoom - viewer.clientWidth) / 2);
    viewer.scrollTop = Math.max(0, (originalHeight * zoom - viewer.clientHeight) / 2);
  };
}

// ============================================================================
// VIEW UPDATING & DRAWING
// ============================================================================
function updateView() {
  if (!originalWidth) return;

  // Adjust image and canvas size based on current zoom
  const displayWidth = originalWidth * zoom;
  const displayHeight = originalHeight * zoom;

  img.style.width = `${displayWidth}px`;
  img.style.height = `${displayHeight}px`;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  drawAnnotations(); // Redraw annotations after resizing
}

// ============================================================================
// DRAWING ANNOTATIONS
// ============================================================================
function drawAnnotations() {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);         // Clear previous drawings

  // Base drawing style constants
  const FONT_SIZE = 20 * zoom;
  const BORDER_WIDTH = 3 * zoom;
  const LABEL_PADDING = 8 * zoom;
  const LABEL_HEIGHT = 28 * zoom;
  const FILL_OPACITY = 0.25;
  const OCR_FONT_SIZE = 16 * zoom;
  const OCR_LINE_WIDTH = 2 * zoom;

  // Iterate over each class layer
  Object.keys(classMap).forEach(cls => {
    const toggleId = `class-toggle-${cls.replace(/\s/g, "-")}`;
    const toggle = document.getElementById(toggleId);
    if (!toggle || !toggle.checked) return;

    // Draw each object of this class
    classMap[cls].forEach((o, idx) => {
      const scaledO = scaleObject(o, zoom);
      const color = o._color;
      const rgbaColor = hslToRgba(color, FILL_OPACITY);
      let label = `${cls}`;
      if (o.size) label += `: ${o.size}`;
      if (o.detail) label += `: ${o.detail}`;

      // Bounding boxes
      if (scaledO.bbox) {
        const x1 = scaledO.bbox.xmin;
        const y1 = scaledO.bbox.ymin;
        const x2 = scaledO.bbox.xmax;
        const y2 = scaledO.bbox.ymax;

        ctx.fillStyle = rgbaColor;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeStyle = color;
        ctx.lineWidth = BORDER_WIDTH;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw text label
        if (showAnnotationText) {
          ctx.font = `bold ${FONT_SIZE}px Arial`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = color;
          ctx.fillRect(x1, y1 - LABEL_HEIGHT - (3 * zoom), textWidth + LABEL_PADDING * 2, LABEL_HEIGHT);
          ctx.fillStyle = "white";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x1 + LABEL_PADDING, y1 - LABEL_HEIGHT / 2 - (3 * zoom));
        }

        // Draw red corner keypoints
        if (showKeyPoints) {
          const corners = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]];
          corners.forEach(c => {
            ctx.beginPath();
            ctx.arc(c[0], c[1], 5 * zoom, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
          });
        }

      // Polygon walls
      } else if (scaledO.polygon) {
        const pts = Object.values(scaledO.polygon);
        drawPolygon(ctx, pts, color, rgbaColor, label, FONT_SIZE, BORDER_WIDTH, LABEL_PADDING, LABEL_HEIGHT);

      // Symbol polygons (doors/windows/icons)
      } else if (scaledO.symbol_polygon) {
        if (scaledO.bbox) {
          const x1 = scaledO.bbox.xmin;
          const y1 = scaledO.bbox.ymin;
          const x2 = scaledO.bbox.xmax;
          const y2 = scaledO.bbox.ymax;

          ctx.fillStyle = rgbaColor;
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.strokeStyle = color;
          ctx.lineWidth = BORDER_WIDTH;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          if (showAnnotationText) {
            ctx.font = `bold ${FONT_SIZE}px Arial`;
            const symbolLabel = `${cls}`;
            const textWidth = ctx.measureText(symbolLabel).width;
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1 - LABEL_HEIGHT - (3 * zoom), textWidth + LABEL_PADDING * 2, LABEL_HEIGHT);
            ctx.fillStyle = "white";
            ctx.textBaseline = "middle";
            ctx.fillText(symbolLabel, x1 + LABEL_PADDING, y1 - LABEL_HEIGHT / 2 - (3 * zoom));
          }

          // Draw symbol corners
          if (showKeyPoints) {
            const corners = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]];
            corners.forEach(c => {
              ctx.beginPath();
              ctx.arc(c[0], c[1], 5 * zoom, 0, 2 * Math.PI);
              ctx.fillStyle = 'red';
              ctx.fill();
            });
          }
        }

        // Size and detail polygons for OCR or text regions
        if (scaledO.size_polygon) {
          const sizePts = Object.values(scaledO.size_polygon);
          drawOCRPolygon(ctx, sizePts, "#00BFFF", o.size || "", OCR_FONT_SIZE, OCR_LINE_WIDTH);
        }
        if (scaledO.detail_polygon) {
          const detailPts = Object.values(scaledO.detail_polygon);
          drawOCRPolygon(ctx, detailPts, "#FF4500", o.detail || "", OCR_FONT_SIZE, OCR_LINE_WIDTH);
        }
      }
    });
  });

  console.log(`✅ Drew objects at zoom ${zoom.toFixed(2)}\n`);
}

// ============================================================================
// HELPER DRAWING FUNCTIONS
// ============================================================================
function scaleObject(o, z) {
  const s = { ...o };
  if (s.bbox) {
    s.bbox = {
      xmin: s.bbox.xmin * z,
      ymin: s.bbox.ymin * z,
      xmax: s.bbox.xmax * z,
      ymax: s.bbox.ymax * z
    };
  }
  ["polygon", "symbol_polygon", "size_polygon", "detail_polygon"].forEach(key => {
    if (s[key]) {
      s[key] = {};
      Object.keys(o[key]).forEach(k => {
        s[key][k] = [o[key][k][0] * z, o[key][k][1] * z];
      });
    }
  });
  return s;
}

// Draw filled polygon and its label/keypoints
function drawPolygon(ctx, pts, color, rgbaColor, label, fontSize, borderWidth, labelPadding, labelHeight) {
  if (pts.length === 0) return;
  
  // Fill polygon
  ctx.fillStyle = rgbaColor;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.fill();
  
  // Stroke border
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  
  // Draw text label
  if (showAnnotationText) {
    ctx.font = `bold ${fontSize}px Arial`;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(pts[0][0], pts[0][1] - labelHeight - (3 * zoom), textWidth + labelPadding * 2, labelHeight);
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.fillText(label, pts[0][0] + labelPadding, pts[0][1] - labelHeight/2 - (3 * zoom));
  }

  // Red dots at keypoints
  if (showKeyPoints) {
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5 * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    });
  }
}

// Draw semi-transparent OCR text regions
function drawOCRPolygon(ctx, pts, color, text, fontSize, lineWidth) {
  if (pts.length === 0) return;
  
  // Fill with translucent color
  ctx.fillStyle = color + "40";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.fill();
  
  // Draw polygon border
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Centered text inside region
  if (showAnnotationText && text) {
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const centerX = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const centerY = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3 * zoom;
    ctx.strokeText(text, centerX, centerY);
    ctx.fillText(text, centerX, centerY);
    ctx.textAlign = "start";
  }

  // Draw corner dots
  if (showKeyPoints) {
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5 * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    });
  }
}

// ============================================================================
// AUTO VISUALIZATION — populate previews from zip
// ============================================================================
async function autoVisualizeAll() {
  document.getElementById("visualizationSection").style.display = "block";
  
  if (uploadedImgDataUrl && selectedJson) {
    visualizeOnMain();
  }
  
  let vizIndex = 1;
  for (const fileName of zipFiles) {
    if ((fileName.endsWith('.png') || fileName.endsWith('.jpg')) && vizIndex <= 5) {
      try {
        const blob = await currentZip.files[fileName].async("blob");
        const url = URL.createObjectURL(blob);
        
        document.getElementById(`vizImg${vizIndex}`).src = url;
        document.getElementById(`vizLabel${vizIndex}`).textContent = fileName;
        document.getElementById(`viz${vizIndex}`).style.display = "block";
        
        vizIndex++;
      } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
      }
    }
  }
}

// ============================================================================
// COLOR UTILITIES — Generate class colors and convert to RGBA
// ============================================================================
function randomColor() {
  return `hsl(${Math.random()*360},70%,50%)`;
}

function hslToRgba(hslColor, alpha) {
  const hue = parseInt(hslColor.match(/\d+/)[0]);
  const sat = 70;
  const light = 50;
  
  const c = (1 - Math.abs(2 * light/100 - 1)) * sat/100;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light/100 - c/2;
  
  let r, g, b;
  if (hue >= 0 && hue < 60) {
    [r, g, b] = [c, x, 0];
  } else if (hue >= 60 && hue < 120) {
    [r, g, b] = [x, c, 0];
  } else if (hue >= 120 && hue < 180) {
    [r, g, b] = [0, c, x];
  } else if (hue >= 180 && hue < 240) {
    [r, g, b] = [0, x, c];
  } else if (hue >= 240 && hue < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
