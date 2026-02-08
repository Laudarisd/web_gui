// ============================================================================
// viz_render.js  (PRODUCTION)
// ----------------------------------------------------------------------------
// Visualize annotation JSON over the base floorplan image.
//
// PUBLIC API:
//   - visualizeOnMain()
//   - updateView()
//   - drawAnnotations()
//   - autoVisualizeAll()
// ============================================================================

(() => {
  "use strict";

  // Window-backed viewer state
  window.zoom = typeof window.zoom === "number" ? window.zoom : 1;
  window.originalWidth = typeof window.originalWidth === "number" ? window.originalWidth : 0;
  window.originalHeight = typeof window.originalHeight === "number" ? window.originalHeight : 0;
  window.showAnnotationText =
    typeof window.showAnnotationText === "boolean" ? window.showAnnotationText : true;
  window.showKeyPoints =
    typeof window.showKeyPoints === "boolean" ? window.showKeyPoints : true;

  function getZoom() {
    return typeof window.zoom === "number" ? window.zoom : 1;
  }
  function setZoom(z) {
    window.zoom = z;
  }
  function getOW() {
    return typeof window.originalWidth === "number" ? window.originalWidth : 0;
  }
  function setOW(v) {
    window.originalWidth = v;
  }
  function getOH() {
    return typeof window.originalHeight === "number" ? window.originalHeight : 0;
  }
  function setOH(v) {
    window.originalHeight = v;
  }
  function showText() {
    return typeof window.showAnnotationText === "boolean" ? window.showAnnotationText : true;
  }
  function showKP() {
    return typeof window.showKeyPoints === "boolean" ? window.showKeyPoints : true;
  }

  let classMap = {};
  let currentObjs = [];
  let hiddenDimensionIndices = new Set(); // Track hidden dimension indices

  const viewer = document.getElementById("viewer");
  const img = document.getElementById("mainImage");
  const canvas = document.getElementById("mainCanvas");

  if (!viewer || !img || !canvas) {
    console.error("❌ Required DOM elements not found (viewer, mainImage, mainCanvas)");
  }

  // ROI transform from crop.json background
  const roiTransform = {
    extracted: false,
    origW: 0,
    origH: 0,
    cropW: 0,
    cropH: 0,
    roiXmin: 0,
    roiYmin: 0,
    roiXmax: 0,
    roiYmax: 0,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
  };

  // Dimension areas metadata: idx -> {bbox_width, bbox_height, original_polygon}
  let dimensionAreas = {};

  // ============================================================================
  // Dimension area extraction and conversion
  // ============================================================================

  function extractDimensionAreasFromCropJson(cropJson) {
    const objs = cropJson?.objects || [];
    dimensionAreas = {};

    for (const o of objs) {
      if (o.class_name === "dimension_area" && o.idx !== undefined) {
        dimensionAreas[o.idx] = {
          bbox_width: o.bbox_width || 0,
          bbox_height: o.bbox_height || 0,
          original_polygon: o.original_polygon || o.bbox_polygon,
        };
        console.log(`   📦 dimension_area idx=${o.idx}: ${o.bbox_width}×${o.bbox_height}`);
      }
    }

    console.log(
      `✅ Extracted ${Object.keys(dimensionAreas).length} dimension areas`
    );
  }

  function cropDimToOriginalPts(pts, cropIdx) {
    const dim = dimensionAreas[cropIdx];
    if (!dim || !dim.bbox_width || !dim.bbox_height) {
      console.warn(`⚠️ dimension_area idx=${cropIdx} not found`);
      return pts;
    }

    const roiPts = anyPolygonToPoints(dim.original_polygon);
    const roiBB = bboxFromPoints(roiPts);

    if (!roiBB) {
      console.warn(`⚠️ Cannot compute ROI bbox for dimension idx=${cropIdx}`);
      return pts;
    }

    const roiW = roiBB.xmax - roiBB.xmin;
    const roiH = roiBB.ymax - roiBB.ymin;
    const scaleX = roiW / dim.bbox_width;
    const scaleY = roiH / dim.bbox_height;
    const offsetX = roiBB.xmin;
    const offsetY = roiBB.ymin;

    console.log(
      `🔍 dim_ocr idx=${cropIdx}: scale=${scaleX.toFixed(4)}×${scaleY.toFixed(4)}, offset=(${offsetX},${offsetY})`
    );

    return pts.map(([x, y]) => [x * scaleX + offsetX, y * scaleY + offsetY]);
  }

  // ============================================================================
  // Geometry helpers
  // ============================================================================

  function isPointArrayPolygon(p) {
    return Array.isArray(p) && Array.isArray(p[0]) && p[0].length >= 2;
  }

  function dictPolygonToPoints(polyDict) {
    if (!polyDict || typeof polyDict !== "object") return [];
    const keys = Object.keys(polyDict).sort();
    return keys
      .map((k) => polyDict[k])
      .filter((v) => Array.isArray(v) && v.length >= 2)
      .map((v) => [Number(v[0]), Number(v[1])]);
  }

  function anyPolygonToPoints(poly) {
    if (!poly) return [];
    if (isPointArrayPolygon(poly)) return poly.map((p) => [Number(p[0]), Number(p[1])]);
    if (typeof poly === "object") return dictPolygonToPoints(poly);
    return [];
  }

  function bboxFromPoints(pts) {
    if (!pts || pts.length === 0) return null;
    let xmin = Infinity,
      ymin = Infinity,
      xmax = -Infinity,
      ymax = -Infinity;
    for (const [x, y] of pts) {
      if (x < xmin) xmin = x;
      if (y < ymin) ymin = y;
      if (x > xmax) xmax = x;
      if (y > ymax) ymax = y;
    }
    return { xmin, ymin, xmax, ymax };
  }

  function cropToOriginalPts(pts) {
    if (!roiTransform.extracted) {
      console.warn("⚠️ ROI transform not extracted");
      return pts;
    }

    const sx = roiTransform.scaleX;
    const sy = roiTransform.scaleY;
    const ox = roiTransform.offsetX;
    const oy = roiTransform.offsetY;

    return pts.map(([x, y]) => [x * sx + ox, y * sy + oy]);
  }

  function scalePointsForZoom(pts, z) {
    return pts.map(([x, y]) => [x * z, y * z]);
  }

  // ============================================================================
  // File type detection
  // ============================================================================

  function _fnameLower(name) {
    return (name || "").toLowerCase();
  }

  function isCropJsonFile(name) {
    return _fnameLower(name).includes("crop");
  }
  function isDimOcrJsonFile(name) {
    return _fnameLower(name).includes("dim_ocr");
  }
  function isSymbolOcrJsonFile(name) {
    return _fnameLower(name).includes("symbol_ocr");
  }
  function isSpaceOcrJsonFile(name) {
    return _fnameLower(name).includes("space_ocr");
  }

  // ============================================================================
  // Extract ROI transform from crop.json
  // ============================================================================

  function ingestRoiTransformFromCropJson(cropJson) {
    const objs = cropJson?.objects || [];
    if (!Array.isArray(objs) || objs.length === 0) {
      console.warn("⚠️ crop.json has no objects array");
      return;
    }

    const bg = objs.find((o) => o?.class_name === "background");
    if (!bg) {
      console.warn("⚠️ crop.json has no background object");
      return;
    }

    const origW = Number(bg.original_size?.width || 0);
    const origH = Number(bg.original_size?.height || 0);
    const cropW = Number(bg.crop_size?.width || 0);
    const cropH = Number(bg.crop_size?.height || 0);

    if (!origW || !origH || !cropW || !cropH) {
      console.warn("⚠️ Missing original_size/crop_size in background");
      return;
    }

    const roiPoly = bg.original_polygon || bg.bbox_polygon;
    if (!roiPoly) {
      console.warn("⚠️ Background has no original_polygon or bbox_polygon");
      return;
    }

    const roiPts = anyPolygonToPoints(roiPoly);
    const roiBB = bboxFromPoints(roiPts);

    if (!roiBB) {
      console.warn("⚠️ Cannot compute ROI bbox from background polygon");
      return;
    }

    const roiW = roiBB.xmax - roiBB.xmin;
    const roiH = roiBB.ymax - roiBB.ymin;

    if (roiW <= 0 || roiH <= 0) {
      console.warn("⚠️ ROI bbox has invalid size", roiBB);
      return;
    }

    roiTransform.extracted = true;
    roiTransform.origW = origW;
    roiTransform.origH = origH;
    roiTransform.cropW = cropW;
    roiTransform.cropH = cropH;
    roiTransform.roiXmin = roiBB.xmin;
    roiTransform.roiYmin = roiBB.ymin;
    roiTransform.roiXmax = roiBB.xmax;
    roiTransform.roiYmax = roiBB.ymax;
    roiTransform.scaleX = roiW / cropW;
    roiTransform.scaleY = roiH / cropH;
    roiTransform.offsetX = roiBB.xmin;
    roiTransform.offsetY = roiBB.ymin;

    setOW(origW);
    setOH(origH);

    console.log("📐 ROI transform extracted from crop.json:");
    console.log(`   Original: ${origW}×${origH}, Crop: ${cropW}×${cropH}`);
    console.log(`   ROI: [${roiBB.xmin},${roiBB.ymin}]→[${roiBB.xmax},${roiBB.ymax}]`);
    console.log(`   Scale: ${roiTransform.scaleX.toFixed(4)}×${roiTransform.scaleY.toFixed(4)}`);

    extractDimensionAreasFromCropJson(cropJson);
  }

  // ============================================================================
  // Normalize objects for rendering
  // ============================================================================

  function normalizeObjectsForRender(fileName, json) {
    const objs = json?.objects || json?.data?.objects || [];
    const out = [];

    // crop*.json - already in original coords
    if (isCropJsonFile(fileName)) {
      ingestRoiTransformFromCropJson(json);

      for (const o of objs) {
        const cls = o.class_name || "unknown_crop";
        // Use original_polygon for main visualization (actual rotated shape)
        const pts = anyPolygonToPoints(o.original_polygon || o.bbox_polygon);
        // Also extract bbox_polygon for dashed line visualization
        const bboxPts = o.bbox_polygon ? anyPolygonToPoints(o.bbox_polygon) : null;

        out.push({
          _cls: cls,
          kind: "polygon",
          polygonPts: pts,  // Main polygon (with mask fill)
          bboxPts: bboxPts,  // Bounding box (dashed lines only, no fill)
          label: cls,
          meta: o,
        });
      }
      return out;
    }

    // dim_ocr*.json - use dimension-specific conversion
    if (isDimOcrJsonFile(fileName)) {
      for (const o of objs) {
        const cropIdx = o.crop_idx;
        const pts = anyPolygonToPoints(o.polygon);
        const convertedPts = cropDimToOriginalPts(pts, cropIdx);

        // Get dimension area box (original_polygon) for this cropIdx
        const dimArea = dimensionAreas[cropIdx];
        let dimensionAreaPts = null;
        if (dimArea && dimArea.original_polygon) {
          dimensionAreaPts = anyPolygonToPoints(dimArea.original_polygon);
        }

        out.push({
          _cls: "dim_ocr",
          kind: "ocr_text",
          polygonPts: convertedPts,
          label: o.text || "",
          cropIdx: cropIdx,
          dimensionAreaPts: dimensionAreaPts,  // Dimension box for visualization
          meta: o,
        });
      }
      return out;
    }

    // All other files require ROI transform
    if (!roiTransform.extracted) {
      console.error(`❌ ROI transform not extracted! Load crop*.json first (${fileName})`);
      return [];
    }

    // segment, wall_oob, normal_oob, symbol_ocr, space_ocr - crop to original conversion
    for (const o of objs) {
      let cls = o.class_name || "unknown";

      if (isSpaceOcrJsonFile(fileName) && o.segmentation_class) {
        cls = `${o.segmentation_class}`; // Annotation class from space_ocr
      }

      if (isSymbolOcrJsonFile(fileName)) {
        cls = "symbol_ocr";
      }

      const symPts = anyPolygonToPoints(o.symbol_polygon);
      const sizePts = anyPolygonToPoints(o.size_polygon);
      const detailPts = anyPolygonToPoints(o.detail_polygon);

      const mainPts = symPts.length
        ? symPts
        : anyPolygonToPoints(o.polygon || o.bbox_polygon || o.original_polygon);

      const convertedMainPts = cropToOriginalPts(mainPts);
      const convertedSizePts = cropToOriginalPts(sizePts);
      const convertedDetailPts = cropToOriginalPts(detailPts);

      let label = cls;
      if (isSpaceOcrJsonFile(fileName) && o.text) {
        label = o.text;
      } else if (isSymbolOcrJsonFile(fileName)) {
        label = `${o.size || ""} ${o.detail || ""}`.trim() || "symbol_ocr";
      } else if (o.text) {
        label = o.text;
      }

      const kind = isSymbolOcrJsonFile(fileName)
        ? "symbol_ocr"
        : o.text
        ? "ocr_text"
        : "polygon";

      const norm = {
        _cls: cls,
        kind,
        polygonPts: convertedMainPts,
        label,
        meta: o,
      };

      if (kind === "symbol_ocr") {
        norm.sizePts = convertedSizePts;
        norm.detailPts = convertedDetailPts;
      }

      out.push(norm);
    }

    return out;
  }

  // ============================================================================
  // Main visualization entry point
  // ============================================================================

  function visualizeOnMain() {
    if (!viewer || !img || !canvas) {
      console.error("❌ Cannot visualize: required DOM elements not found");
      return;
    }

    // Hide waiting puppy and show viewer
    if (typeof window.hideWaitingPuppy === "function") {
      window.hideWaitingPuppy();
    }
    if (viewer) {
      viewer.style.display = "block";
    }

    if (typeof window.setGifSectionReady === "function") {
      window.setGifSectionReady("visualization", true);
    }

    console.log(`\n🎯 Visualizing: ${currentFileName}`);

    const normalized = normalizeObjectsForRender(currentFileName, selectedJson);
    currentObjs = normalized;

    console.log(`   Found ${normalized.length} objects`);

    classMap = {};
    const classColors = {};
    for (const obj of normalized) {
      const cls = obj._cls || "Unknown";
      if (!classMap[cls]) {
        classMap[cls] = [];
        classColors[cls] = randomColor();
      }
      obj._color = classColors[cls];
      classMap[cls].push(obj);
    }

    const controls = document.getElementById("annotationControls");
    if (controls) {
      controls.innerHTML = "";
      
      // Add class toggles
      Object.keys(classMap)
        .sort()
        .forEach((cls) => {
          const label = document.createElement("label");
          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = true;
          check.id = `class-toggle-${cls.replace(/\s/g, "-").replace(/:/g, "-")}`;
          check.addEventListener("change", updateView);
          label.appendChild(check);
          label.append(` ${cls} (${classMap[cls].length})`);
          controls.appendChild(label);
        });
      
      // Collect unique dimension indices and add toggles
      const dimensionIndices = new Set();
      Object.values(classMap).forEach(objs => {
        objs.forEach(o => {
          if (o.kind === "ocr_text" && o.cropIdx !== undefined) {
            dimensionIndices.add(o.cropIdx);
          }
        });
      });
      
      // Add dimension index toggles if there are any dimensions
      if (dimensionIndices.size > 0) {
        const dimSection = document.createElement("div");
        dimSection.style.marginTop = "15px";
        dimSection.style.paddingTop = "15px";
        dimSection.style.borderTop = "1px solid #ddd";
        
        const dimLabel = document.createElement("div");
        dimLabel.textContent = "📍 Dimension Areas:";
        dimLabel.style.fontWeight = "bold";
        dimLabel.style.marginBottom = "8px";
        dimSection.appendChild(dimLabel);
        
        Array.from(dimensionIndices).sort((a, b) => a - b).forEach((idx) => {
          const label = document.createElement("label");
          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = true;
          check.id = `dimension-toggle-${idx}`;
          check.dataset.dimIndex = idx;
          check.addEventListener("change", (e) => {
            if (e.target.checked) {
              hiddenDimensionIndices.delete(parseInt(idx));
            } else {
              hiddenDimensionIndices.add(parseInt(idx));
            }
            updateView();
          });
          label.appendChild(check);
          label.append(` Dimension [${idx}]`);
          label.style.display = "inline-block";
          label.style.marginRight = "15px";
          dimSection.appendChild(label);
        });
        controls.appendChild(dimSection);
      }
    }

    console.log("📷 Loading image...");
    if (!uploadedImgDataUrl) {
      console.error("❌ uploadedImgDataUrl not defined");
      return;
    }

    img.src = uploadedImgDataUrl;

    img.onload = () => {
      console.log("✅ Image loaded");
      if (!getOW()) setOW(img.naturalWidth);
      if (!getOH()) setOH(img.naturalHeight);

      console.log(`   Base image: ${getOW()}×${getOH()}`);

      if (viewer) {
        const minZoom = Math.min(viewer.clientWidth / getOW(), viewer.clientHeight / getOH());
        setZoom(minZoom);
        console.log(`   Initial zoom: ${getZoom().toFixed(4)}`);
      }

      updateView();

      if (viewer) {
        viewer.scrollLeft = Math.max(0, (getOW() * getZoom() - viewer.clientWidth) / 2);
        viewer.scrollTop = Math.max(0, (getOH() * getZoom() - viewer.clientHeight) / 2);
      }
    };
  }

  // ============================================================================
  // Update view
  // ============================================================================

  function updateView() {
    if (!getOW() || !getOH() || !img || !canvas) return;

    const z = getZoom();
    const displayWidth = getOW() * z;
    const displayHeight = getOH() * z;

    // Update image size
    img.style.width = `${displayWidth}px`;
    img.style.height = `${displayHeight}px`;

    // Update canvas size to match zoomed image
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Update zoom container size
    const zc = document.getElementById("zoomContainer");
    if (zc) {
      zc.style.width = `${displayWidth}px`;
      zc.style.height = `${displayHeight}px`;
    }

    // Redraw all annotations at new zoom level
    drawAnnotations();
    console.log(`📐 View updated: zoom=${z.toFixed(3)}, size=${displayWidth}×${displayHeight}`);
  }

  // ============================================================================
  // Draw annotations
  // ============================================================================

  function drawAnnotations() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const z = getZoom();

    const BORDER_WIDTH = 3 * z;
    const LABEL_HEIGHT = 28 * z;
    const LABEL_PADDING = 8 * z;
    const FONT_SIZE = 18 * z;

    let drawnCount = 0;
    
    // Track placed label rectangles to avoid overlaps
    const placedLabels = [];
    
    // Helper: Check if two rectangles overlap
    function rectsOverlap(r1, r2) {
      return !(r1.right < r2.left || 
               r1.left > r2.right || 
               r1.bottom < r2.top || 
               r1.top > r2.bottom);
    }
    
    // Helper: Find non-overlapping position for label
    function findLabelPosition(bb, labelWidth, labelHeight) {
      const positions = [
        // Above (default - best position)
        { x: bb.xmin, y: bb.ymin - labelHeight - 3 * z, name: 'above' },
        // Above-right corner (still close)
        { x: bb.xmax - labelWidth, y: bb.ymin - labelHeight - 3 * z, name: 'above-right' },
        // Below (keep close to polygon)
        { x: bb.xmin, y: bb.ymax + 3 * z, name: 'below' },
        // Below-right corner (still close)
        { x: bb.xmax - labelWidth, y: bb.ymax + 3 * z, name: 'below-right' },
        // Above with small horizontal offset (if above is taken)
        { x: bb.xmin + labelWidth / 2, y: bb.ymin - labelHeight - 3 * z, name: 'above-center' },
        // Below with small horizontal offset
        { x: bb.xmin + labelWidth / 2, y: bb.ymax + 3 * z, name: 'below-center' }
      ];
      
      for (const pos of positions) {
        const testRect = {
          left: pos.x,
          top: pos.y,
          right: pos.x + labelWidth,
          bottom: pos.y + labelHeight
        };
        
        // Check if this position overlaps with any existing label
        const hasOverlap = placedLabels.some(placed => rectsOverlap(testRect, placed));
        
        if (!hasOverlap) {
          // Found a free spot, record it
          placedLabels.push(testRect);
          return pos;
        }
      }
      
      // If all positions overlap, use default (above) with small offset
      const defaultPos = { 
        x: positions[0].x, 
        y: positions[0].y - (10 * z), // Small vertical offset
        name: 'above-stacked' 
      };
      placedLabels.push({
        left: defaultPos.x,
        top: defaultPos.y,
        right: defaultPos.x + labelWidth,
        bottom: defaultPos.y + labelHeight
      });
      return defaultPos;
    }

    Object.keys(classMap).forEach((cls) => {
      const toggleId = `class-toggle-${cls.replace(/\s/g, "-").replace(/:/g, "-")}`;
      const toggle = document.getElementById(toggleId);
      if (!toggle || !toggle.checked) return;

      for (const o of classMap[cls]) {
        // Skip hidden dimensions
        if (o.kind === "ocr_text" && hiddenDimensionIndices.has(o.cropIdx)) {
          continue;
        }
        
        const color = o._color;
        const rgba = hslToRgba(color, 0.25);

        const pts = scalePointsForZoom(o.polygonPts || [], z);

        if (pts.length) {
          ctx.fillStyle = rgba;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = color;
          ctx.lineWidth = BORDER_WIDTH;
          ctx.stroke();

          if (showKP()) {
            for (const p of pts) {
              ctx.beginPath();
              ctx.arc(p[0], p[1], 5 * z, 0, 2 * Math.PI);
              ctx.fillStyle = "red";
              ctx.fill();
            }
          }

          drawnCount++;
        }

        if (showText() && o.label) {
          const bb = bboxFromPoints(pts);
          if (bb) {
            ctx.font = `bold ${FONT_SIZE}px Arial`;

            let displayLabel = o.label;
            const isDimOcr = o.kind === "ocr_text" && o.cropIdx !== undefined;
            
            if (isDimOcr) {
              displayLabel = `${o.label} [${o.cropIdx}]`;
            }

            const tw = ctx.measureText(displayLabel).width;
            const labelWidth = tw + LABEL_PADDING * 2;
            
            let labelX, labelY;
            
            // Only use smart positioning for dimension OCR to avoid overlaps
            if (isDimOcr) {
              const pos = findLabelPosition(bb, labelWidth, LABEL_HEIGHT);
              labelX = pos.x;
              labelY = pos.y;
            } else {
              // Other annotations: simple default position (above)
              labelX = bb.xmin;
              labelY = bb.ymin - LABEL_HEIGHT - 3 * z;
            }

            // Draw label background
            ctx.fillStyle = color;
            ctx.fillRect(labelX, labelY, labelWidth, LABEL_HEIGHT);

            // Draw label text
            ctx.fillStyle = "white";
            ctx.textBaseline = "middle";
            ctx.fillText(displayLabel, labelX + LABEL_PADDING, labelY + LABEL_HEIGHT / 2);
          }
        }

        if (o.kind === "symbol_ocr") {
          const sizePts = scalePointsForZoom(o.sizePts || [], z);
          const detailPts = scalePointsForZoom(o.detailPts || [], z);
          drawPolyOutline(ctx, sizePts, "#00BFFF", 2 * z);
          drawPolyOutline(ctx, detailPts, "#FF4500", 2 * z);
        }

        // dim_ocr: draw dimension area box as dashed red lines
        if (o.kind === "ocr_text" && o.dimensionAreaPts) {
          const dimAreaPtsScaled = scalePointsForZoom(o.dimensionAreaPts, z);
          drawPolyOutlineWithDash(ctx, dimAreaPtsScaled, "#FF0000", 2 * z);
          
          // Annotate dimension area box with index
          const dimBB = bboxFromPoints(dimAreaPtsScaled);
          if (dimBB) {
            const idxLabel = `[${o.cropIdx}]`;
            ctx.font = `bold ${FONT_SIZE * 0.8}px Arial`;
            ctx.fillStyle = "#FF0000";
            ctx.fillText(idxLabel, dimBB.xmin + 5, dimBB.ymin + 15);
          }
        }

        // crop.json: draw bbox_polygon as dashed RED lines (no fill)
        // bbox is axis-aligned rectangle, original_polygon may be rotated
        if (o.kind === "polygon" && o.bboxPts) {
          const bboxPtsScaled = scalePointsForZoom(o.bboxPts, z);
          drawPolyOutlineWithDash(ctx, bboxPtsScaled, "#FF0000", 2 * z);
        }
      }
    });

    console.log(`✅ Drew ${drawnCount} polygons at zoom ${z.toFixed(4)}`);
  }

  function drawPolyOutline(ctx, pts, stroke, lw) {
    if (!pts || pts.length === 0) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.stroke();
  }

  // Draw polygon outline with dashed pattern (no fill)
  function drawPolyOutlineWithDash(ctx, pts, stroke, lw) {
    if (!pts || pts.length === 0) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.setLineDash([5, 5]);  // 5px dash, 5px gap
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);  // Reset to solid
  }

  // ============================================================================
  // Auto-visualize all
  // ============================================================================

  async function autoVisualizeAll() {
    const section = document.getElementById("visualizationSection");
    if (section) section.style.display = "block";

    let hasViz = false;

    if (window.uploadedImgDataUrl && window.selectedJson) {
      visualizeOnMain();
    }

    let vizIndex = 1;
    for (const fileName of window.zipFiles || []) {
      if ((fileName.endsWith(".png") || fileName.endsWith(".jpg")) && vizIndex <= 5) {
        try {
          const blob = await window.currentZip.files[fileName].async("blob");
          const url = URL.createObjectURL(blob);

          const imgEl = document.getElementById(`vizImg${vizIndex}`);
          const labelEl = document.getElementById(`vizLabel${vizIndex}`);
          const blockEl = document.getElementById(`viz${vizIndex}`);

          if (imgEl) imgEl.src = url;
          if (labelEl) labelEl.textContent = fileName;
          if (blockEl) blockEl.style.display = "block";

          hasViz = true;

          vizIndex++;
        } catch (error) {
          console.error(`Error loading ${fileName}:`, error);
        }
      }
    }

    if (hasViz && typeof window.setGifSectionReady === "function") {
      window.setGifSectionReady("visualization", true);
    }
  }

  // ============================================================================
  // Color utilities
  // ============================================================================

  function randomColor() {
    return `hsl(${Math.random() * 360},70%,50%)`;
  }

  function hslToRgba(hslColor, alpha) {
    const hue = parseInt(hslColor.match(/\d+/)[0], 10);
    const sat = 70;
    const light = 50;

    const c = (1 - Math.abs((2 * light) / 100 - 1)) * (sat / 100);
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light / 100 - c / 2;

    let r, g, b;
    if (hue >= 0 && hue < 60) [r, g, b] = [c, x, 0];
    else if (hue >= 60 && hue < 120) [r, g, b] = [x, c, 0];
    else if (hue >= 120 && hue < 180) [r, g, b] = [0, c, x];
    else if (hue >= 180 && hue < 240) [r, g, b] = [0, x, c];
    else if (hue >= 240 && hue < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ============================================================================
  // Vectorization support
  // ============================================================================
  
  /**
   * Render current objects in vector mode
   */
  function renderCurrentVector() {
    if (typeof window.renderVectorView !== "function") {
      console.warn("⚠️ renderVectorView not available");
      return;
    }

    const objects = currentObjs || [];
    const vectorCanvas = document.getElementById("vectorCanvas");
    if (!vectorCanvas) return;

    // Pass current objects to vector renderer
    window.renderVectorView(objects, vectorCanvas.width, vectorCanvas.height, getOW(), getOH());
  }

  // ============================================================================
  // Public API
  // ============================================================================
  window.visualizeOnMain = visualizeOnMain;
  window.updateView = updateView;
  window.drawAnnotations = drawAnnotations;
  window.autoVisualizeAll = autoVisualizeAll;
  window.renderCurrentVector = renderCurrentVector;
})();