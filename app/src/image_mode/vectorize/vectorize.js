// ============================================================================
// vectorize.js  (CAD-style Vectorization)
// ============================================================================
// Algorithm for converting annotation data to CAD-style vector representation
//
// FEATURES:
//   - Converts image coordinates to CAD canvas space
//   - Renders object boxes without image background
//   - High-precision coordinate display
//   - Supports scale/zoom for CAD operations
// ============================================================================

(() => {
  "use strict";

  // Window-backed state for vectorization
  window.vectorZoom = typeof window.vectorZoom === "number" ? window.vectorZoom : 1;
  window.vectorPanX = typeof window.vectorPanX === "number" ? window.vectorPanX : 0;
  window.vectorPanY = typeof window.vectorPanY === "number" ? window.vectorPanY : 0;

  function getVectorZoom() {
    return typeof window.vectorZoom === "number" ? window.vectorZoom : 1;
  }
  function setVectorZoom(z) {
    window.vectorZoom = z;
  }

  const vectorCanvas = document.getElementById("vectorCanvas");
  const vectorContainer = document.getElementById("vectorContainer");

  if (!vectorCanvas) {
    console.warn("⚠️ vectorize.js: #vectorCanvas not found");
  }

  // ============================================================================
  // Vector Drawing Utilities
  // ============================================================================

  /**
   * Draw a rectangle outline in vector space
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Top-left X
   * @param {number} y - Top-left Y
   * @param {number} width - Rectangle width
   * @param {number} height - Rectangle height
   * @param {string} color - Stroke color
   * @param {number} lineWidth - Line width
   */
  function drawRect(ctx, x, y, width, height, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw a polygon outline
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} pts - Points [[x,y], [x,y], ...]
   * @param {string} color - Stroke color
   * @param {number} lineWidth - Line width
   */
  function drawPolygon(ctx, pts, color, lineWidth) {
    if (!pts || pts.length === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw text with background
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to display
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} bgColor - Background color
   * @param {string} textColor - Text color
   * @param {number} fontSize - Font size
   */
  function drawTextWithBg(ctx, text, x, y, bgColor, textColor, fontSize) {
    ctx.font = `${fontSize}px Courier New`;
    const metrics = ctx.measureText(text);
    const width = metrics.width + 8;
    const height = fontSize + 4;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x - 2, y - fontSize, width, height);

    // Text
    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    ctx.fillText(text, x + 2, y - fontSize + 2);
  }

  /**
   * Draw coordinate labels on objects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {object} bbox - Bounding box {xmin, ymin, xmax, ymax}
   * @param {string} label - Label text
   * @param {number} fontSize - Font size
   */
  function drawCoordinates(ctx, bbox, label, fontSize) {
    const cornerSize = 12;
    const coordColor = "#00FF00"; // Green for coordinates
    const textColor = "#000000";
    const bgColor = "#00FF0033"; // Semi-transparent green

    // Draw corner markers
    ctx.strokeStyle = coordColor;
    ctx.lineWidth = 1;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(bbox.xmin, bbox.ymin + cornerSize);
    ctx.lineTo(bbox.xmin, bbox.ymin);
    ctx.lineTo(bbox.xmin + cornerSize, bbox.ymin);
    ctx.stroke();

    // Draw coordinate text
    drawTextWithBg(ctx, `${bbox.xmin.toFixed(0)}, ${bbox.ymin.toFixed(0)}`, 
                   bbox.xmin + 2, bbox.ymin + fontSize, bgColor, textColor, fontSize - 2);

    // Draw label
    if (label) {
      drawTextWithBg(ctx, label, bbox.xmin + 2, bbox.ymin + fontSize * 1.8, 
                     "#FFFFFF33", textColor, fontSize - 2);
    }
  }

  /**
   * Render vectorized view of annotations
   * @param {Array} objects - Annotation objects
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {number} imageWidth - Original image width
   * @param {number} imageHeight - Original image height
   */
  function renderVectorView(objects, canvasWidth, canvasHeight, imageWidth, imageHeight) {
    if (!vectorCanvas) return;

    const ctx = vectorCanvas.getContext("2d");
    if (!ctx) return;

    const z = getVectorZoom();

    // Clear canvas with CAD-style background (dark grid)
    ctx.fillStyle = "#1a1a1a"; // Dark background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Transform to left-bottom origin (CAD standard)
    ctx.save();
    ctx.translate(0, canvasHeight);
    ctx.scale(1, -1);

    // Draw grid (before transform)
    const gridSize = 50 * z;
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 0.5;

    for (let x = 0; x < canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    for (let y = 0; y < canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Draw coordinate axes at origin (left-bottom)
    ctx.strokeStyle = "#FFFFFF"; // White axes
    ctx.lineWidth = 1;
    const axisLength = 60;
    
    // X axis (horizontal)
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(10 + axisLength, 10);
    ctx.stroke();
    
    // X axis arrow
    ctx.beginPath();
    ctx.moveTo(10 + axisLength, 10);
    ctx.lineTo(10 + axisLength - 8, 10 - 4);
    ctx.moveTo(10 + axisLength, 10);
    ctx.lineTo(10 + axisLength - 8, 10 + 4);
    ctx.stroke();
    
    // Y axis (vertical)
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(10, 10 + axisLength);
    ctx.stroke();
    
    // Y axis arrow
    ctx.beginPath();
    ctx.moveTo(10, 10 + axisLength);
    ctx.lineTo(10 - 4, 10 + axisLength - 8);
    ctx.moveTo(10, 10 + axisLength);
    ctx.lineTo(10 + 4, 10 + axisLength - 8);
    ctx.stroke();

    // Draw objects
    if (!objects || objects.length === 0) {
      console.log("📊 No objects to render in vectorization");
      return;
    }

    objects.forEach((obj) => {
      if (!obj.polygonPts || obj.polygonPts.length === 0) return;

      const color = obj._color || "#FFFFFF";
      const pts = obj.polygonPts.map(([x, y]) => [x * z, y * z]);

      // Draw polygon with higher precision (thinner lines)
      drawPolygon(ctx, pts, color, Math.max(0.5, 1 * z));

      // Draw vertices with smaller markers for precision
      pts.forEach((pt, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], Math.max(1.5, 2 * z), 0, 2 * Math.PI);
        ctx.fill();
      });
      // No labels/annotations
    });

    ctx.restore(); // Restore original transform
    console.log(`📐 Vectorized ${objects.length} objects at zoom ${z.toFixed(3)} (left-bottom origin)`);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  window.renderVectorView = renderVectorView;
  window.getVectorZoom = getVectorZoom;
  window.setVectorZoom = setVectorZoom;

})();
