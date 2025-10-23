// viz.js
let zoom = 1;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialScrollLeft = 0;
let initialScrollTop = 0;
let originalWidth = 0;
let originalHeight = 0;
let classMap = {};
let currentObjs = [];
let connectionData = null;

const viewer = document.getElementById("viewer");
const zoomContainer = document.getElementById("zoomContainer");
const img = document.getElementById("mainImage");
const canvas = document.getElementById("mainCanvas");

viewer.style.overflow = 'scroll';
zoomContainer.style.position = '';

viewer.addEventListener("wheel", handleZoom);
viewer.addEventListener("mousedown", startDrag);
viewer.addEventListener("mousemove", drag);
viewer.addEventListener("mouseup", endDrag);
viewer.addEventListener("mouseleave", endDrag);

let showAnnotationText = true;
const toggleTextBtn = document.getElementById("toggleTextBtn");
if (toggleTextBtn) {
  toggleTextBtn.addEventListener("click", () => {
    showAnnotationText = !showAnnotationText;
    toggleTextBtn.textContent = showAnnotationText ? "Hide Annotation Text" : "Show Annotation Text";
    updateView();
  });
}

let showKeyPoints = true;
const toggleKeyPointsBtn = document.getElementById("toggleKeyPointsBtn");
if (toggleKeyPointsBtn) {
  toggleKeyPointsBtn.addEventListener("click", () => {
    showKeyPoints = !showKeyPoints;
    toggleKeyPointsBtn.textContent = showKeyPoints ? "Hide Key Points" : "Show Key Points";
    updateView();
  });
}

function handleZoom(e) {
  e.preventDefault();
  const rect = viewer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const oldZoom = zoom;

  // Prevent zoom out smaller than viewer
  const minZoom = Math.min(
    viewer.clientWidth / originalWidth,
    viewer.clientHeight / originalHeight
  );
  zoom *= (1 - Math.sign(e.deltaY) * 0.1);
  zoom = Math.max(minZoom, Math.min(zoom, 5));

  if (zoom === oldZoom) return;

  const offsetX = mouseX + viewer.scrollLeft;
  const offsetY = mouseY + viewer.scrollTop;
  const fractionX = offsetX / (originalWidth * oldZoom);
  const fractionY = offsetY / (originalHeight * oldZoom);

  updateView();

  viewer.scrollLeft = fractionX * (originalWidth * zoom) - mouseX;
  viewer.scrollTop = fractionY * (originalHeight * zoom) - mouseY;
}

function startDrag(e) {
  if (e.button !== 0) return;
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
  viewer.scrollLeft = initialScrollLeft - (e.clientX - startX);
  viewer.scrollTop = initialScrollTop - (e.clientY - startY);
}

function endDrag() {
  isDragging = false;
  viewer.style.cursor = "grab";
}

function getClass(o) {
  if (o.class_name) return o.class_name;
  if (o.symbol_polygon) return 'Symbol';
  if (o.polygon) return 'Wall';
  if (o.size_polygon || o.detail_polygon) return 'Text';
  return 'Unknown';
}

// ============================================================================
// VISUALIZATION
// ============================================================================
async function visualizeOnMain() {
  const isCropJson = currentFileName.toLowerCase().includes('crop');
  let objs = selectedJson.data?.objects || selectedJson.objects || [];
  currentObjs = objs;
  
  console.log(`\n🎯 Visualizing: ${currentFileName}`);
  console.log(`🔍 Is Crop JSON: ${isCropJson}`);
  console.log(`📦 Objects: ${objs.length}`);
  
  // Step 1: Convert non-crop JSON coordinates to original image scale
  if (!isCropJson && scaleInfo.extracted) {
    console.log(`🔧 Converting coordinates from crop to original scale`);
    console.log(`   Crop: ${scaleInfo.cropWidth}×${scaleInfo.cropHeight}`);
    console.log(`   Original: ${scaleInfo.originalWidth}×${scaleInfo.originalHeight}`);
    console.log(`   Offset: (${scaleInfo.cropXMin}, ${scaleInfo.cropYMin})`);
    
    const scaleX = scaleInfo.scaleX;
    const scaleY = scaleInfo.scaleY;
    const offsetX = scaleInfo.cropXMin || 0;
    const offsetY = scaleInfo.cropYMin || 0;
    
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

  // Load connection data if available
  connectionData = null;
  const connectionFile = currentFileName.replace('.json', '_raw_connection.json');
  if (zipFiles.includes(connectionFile)) {
    try {
      const content = await currentZip.files[connectionFile].async("string");
      connectionData = JSON.parse(content);
      console.log(`✅ Loaded connection data: ${connectionData.connection.length} junctions`);
    } catch (e) {
      console.error("❌ Error loading connection data:", e);
    }
  }

  // Assign a unique color per class
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
  
  // Step 2: Display original image
  img.src = uploadedImgDataUrl;
  img.onload = () => {
  originalWidth = img.naturalWidth;
  originalHeight = img.naturalHeight;

  // Fit image to viewer
  const minZoom = Math.min(
    viewer.clientWidth / originalWidth,
    viewer.clientHeight / originalHeight
  );
  zoom = minZoom;

  updateView();

  // Center image
  viewer.scrollLeft = Math.max(0, (originalWidth * zoom - viewer.clientWidth) / 2);
  viewer.scrollTop = Math.max(0, (originalHeight * zoom - viewer.clientHeight) / 2);
  };
}

function updateView() {
  if (!originalWidth) return;

  const displayWidth = originalWidth * zoom;
  const displayHeight = originalHeight * zoom;

  img.style.width = `${displayWidth}px`;
  img.style.height = `${displayHeight}px`;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  drawAnnotations();
}

function drawAnnotations() {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const FONT_SIZE = 20 * zoom;
  const BORDER_WIDTH = 3 * zoom;
  const LABEL_PADDING = 8 * zoom;
  const LABEL_HEIGHT = 28 * zoom;
  const FILL_OPACITY = 0.25;
  const OCR_FONT_SIZE = 16 * zoom;
  const OCR_LINE_WIDTH = 2 * zoom;

  Object.keys(classMap).forEach(cls => {
    const toggleId = `class-toggle-${cls.replace(/\s/g, "-")}`;
    const toggle = document.getElementById(toggleId);
    if (!toggle || !toggle.checked) return;

    classMap[cls].forEach((o, idx) => {
      const scaledO = scaleObject(o, zoom);
      const color = o._color;
      const rgbaColor = hslToRgba(color, FILL_OPACITY);
      // Annotation tetx: Only class namse, size, detail
      let label = `${cls}`;
      if (o.size) label += `: ${o.size}`;
      if (o.detail) label += `: ${o.detail}`;

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
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = color;
          ctx.fillRect(x1, y1 - LABEL_HEIGHT - (3 * zoom), textWidth + LABEL_PADDING * 2, LABEL_HEIGHT);
          ctx.fillStyle = "white";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x1 + LABEL_PADDING, y1 - LABEL_HEIGHT / 2 - (3 * zoom));
        }
        if (showKeyPoints) {
          const corners = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]];
          corners.forEach(c => {
            ctx.beginPath();
            ctx.arc(c[0], c[1], 5 * zoom, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
          });
        }
      } else if (scaledO.polygon) {
        const pts = Object.values(scaledO.polygon);
        drawPolygon(ctx, pts, color, rgbaColor, label, FONT_SIZE, BORDER_WIDTH, LABEL_PADDING, LABEL_HEIGHT);
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
            // Add label for symbol
            ctx.font = `bold ${FONT_SIZE}px Arial`;
            const symbolLabel = `${cls}`;
            const textWidth = ctx.measureText(symbolLabel).width;
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1 - LABEL_HEIGHT - (3 * zoom), textWidth + LABEL_PADDING * 2, LABEL_HEIGHT);
            ctx.fillStyle = "white";
            ctx.textBaseline = "middle";
            ctx.fillText(symbolLabel, x1 + LABEL_PADDING, y1 - LABEL_HEIGHT / 2 - (3 * zoom));
          }
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

  if (showKeyPoints && connectionData) {
    connectionData.connection.forEach(j => {
      const [jx, jy] = j.center_point;
      const sx = jx * zoom;
      const sy = jy * zoom;
      ctx.beginPath();
      ctx.arc(sx, sy, 5 * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = 'blue';
      ctx.fill();
      if (showAnnotationText) {
        ctx.font = `bold ${FONT_SIZE}px Arial`;
        ctx.fillStyle = 'blue';
        ctx.textBaseline = "middle";
        ctx.fillText(j.type, sx + 10 * zoom, sy);
      }
    });
  }

  console.log(`✅ Drew objects at zoom ${zoom.toFixed(2)}\n`);
}

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

function drawPolygon(ctx, pts, color, rgbaColor, label, fontSize, borderWidth, labelPadding, labelHeight) {
  if (pts.length === 0) return;
  
  // Fill
  ctx.fillStyle = rgbaColor;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  
  if (showAnnotationText) {
    // Label
    ctx.font = `bold ${fontSize}px Arial`;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(pts[0][0], pts[0][1] - labelHeight - (3 * zoom), textWidth + labelPadding * 2, labelHeight);
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.fillText(label, pts[0][0] + labelPadding, pts[0][1] - labelHeight/2 - (3 * zoom));
  }
  if (showKeyPoints) {
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5 * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    });
  }
}

function drawOCRPolygon(ctx, pts, color, text, fontSize, lineWidth) {
  if (pts.length === 0) return;
  
  // Semi-transparent fill
  ctx.fillStyle = color + "40";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Text centered
  if (showAnnotationText && text) {
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const centerX = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const centerY = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    
    // White outline
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3 * zoom;
    ctx.strokeText(text, centerX, centerY);
    ctx.fillText(text, centerX, centerY);
    
    ctx.textAlign = "start";
  }
  if (showKeyPoints) {
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5 * zoom, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    });
  }
}

async function autoVisualizeAll() {
  document.getElementById("visualizationSection").style.display = "block";
  
  if (uploadedImgDataUrl && selectedJson) {
    await visualizeOnMain();
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