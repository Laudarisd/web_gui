// ============================================================
// zip.js — Handles ZIP extraction, file listing, and scale info
// Uses globals (currentZipBlob, currentZip) defined in upload.js
// ============================================================

// Reuse global ZIP variables from upload.js instead of redefining them
// (they are shared across scripts when loaded sequentially in index.html)

// Holds list of extracted filenames for quick access
let zipFiles = [];

// ------------------------------------------------------------
// Scale info object — used to convert cropped image coordinates
// back to original image coordinates for visualization alignment
// ------------------------------------------------------------
let scaleInfo = {
  originalWidth: 0,
  originalHeight: 0,
  cropWidth: 0,
  cropHeight: 0,
  cropXMin: 0,  // Crop top-left offset in original image
  cropYMin: 0,
  cropXMax: 0,
  cropYMax: 0,
  scaleX: 1,
  scaleY: 1,
  extracted: false
};

// ------------------------------------------------------------
// Manual "Extract ZIP" button — also useful for debugging
// ------------------------------------------------------------
document.getElementById("extractBtn").addEventListener("click", async () => {
  await extractAndShowFiles();
});

// ============================================================================
// Function: extractScaleInfo()
// Purpose: Read crop-related JSON inside the ZIP to reconstruct scaling
// ============================================================================
async function extractScaleInfo() {
  if (!currentZip) return false; // If no zip loaded yet, skip

  // Filter files (ignore directories)
  const files = Object.keys(currentZip.files).filter(name => !currentZip.files[name].dir);

  // Find the first JSON file with "crop" in its name
  const cropJsonFile = files.find(f => f.toLowerCase().includes("crop") && f.endsWith(".json"));

  if (!cropJsonFile) {
    console.warn("⚠️ No crop JSON found in ZIP");
    return false;
  }

  try {
    // Read JSON file as text
    const cropContent = await currentZip.files[cropJsonFile].async("string");
    const cropData = JSON.parse(cropContent);

    // Support multiple dataset structures
    const cropObjs = cropData.data?.objects || cropData.objects || [];
    const firstObj = cropObjs[0];

    // Extract scaling and offset parameters
    if (firstObj && firstObj.original_size && firstObj.crop_size) {
      scaleInfo.originalWidth = firstObj.original_size.width;
      scaleInfo.originalHeight = firstObj.original_size.height;
      scaleInfo.cropWidth = firstObj.crop_size.width;
      scaleInfo.cropHeight = firstObj.crop_size.height;

      // Crop bounding box offsets (position within original image)
      if (firstObj.bbox) {
        scaleInfo.cropXMin = firstObj.bbox.xmin || 0;
        scaleInfo.cropYMin = firstObj.bbox.ymin || 0;
        scaleInfo.cropXMax = firstObj.bbox.xmax || scaleInfo.originalWidth;
        scaleInfo.cropYMax = firstObj.bbox.ymax || scaleInfo.originalHeight;
      }

      // Compute scale factors (ratio between crop and original)
      scaleInfo.scaleX = (scaleInfo.cropXMax - scaleInfo.cropXMin) / scaleInfo.cropWidth;
      scaleInfo.scaleY = (scaleInfo.cropYMax - scaleInfo.cropYMin) / scaleInfo.cropHeight;
      scaleInfo.extracted = true;

      // Log results for debugging
      console.log("✅ Scale extracted:", {
        original: `${scaleInfo.originalWidth}×${scaleInfo.originalHeight}`,
        crop: `${scaleInfo.cropWidth}×${scaleInfo.cropHeight}`,
        offset: `(${scaleInfo.cropXMin}, ${scaleInfo.cropYMin})`,
        scale: `${scaleInfo.scaleX.toFixed(3)}×, ${scaleInfo.scaleY.toFixed(3)}×`
      });

      // Display extracted scale info on UI
      document.getElementById("scaleInfo").innerHTML = `
        <strong>📐 Scale Info:</strong><br>
        Original: ${scaleInfo.originalWidth}×${scaleInfo.originalHeight}px<br>
        Crop: ${scaleInfo.cropWidth}×${scaleInfo.cropHeight}px<br>
        Offset: (${scaleInfo.cropXMin}, ${scaleInfo.cropYMin})px<br>
        Scale: ${scaleInfo.scaleX.toFixed(3)}× (X), ${scaleInfo.scaleY.toFixed(3)}× (Y)
      `;
      document.getElementById("scaleInfo").style.display = "block";

      return true;
    }
  } catch (e) {
    console.error("❌ Error extracting scale info:", e);
  }

  return false;
}

// ============================================================================
// Function: extractAndShowFiles()
// Purpose: Load the ZIP blob → parse files → show list in sidebar
// ============================================================================
async function extractAndShowFiles() {
  // Check if ZIP blob exists (set by upload.js)
  if (!currentZipBlob) {
    showStatus("❌ No ZIP file available!", "error");
    return;
  }

  try {
    // Load ZIP contents asynchronously using JSZip
    currentZip = await JSZip.loadAsync(currentZipBlob);

    // Try extracting scale info before listing files
    await extractScaleInfo();

    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";

    // Collect file names (skip directories)
    const files = Object.keys(currentZip.files).filter(name => !currentZip.files[name].dir);
    zipFiles = files;

    if (files.length === 0) {
      fileList.innerHTML = "<p>No files found in ZIP</p>";

      if (typeof window.setGifSectionReady === "function") {
        window.setGifSectionReady("dataContent", true);
      }
      return;
    }

    // For each file in the ZIP, create a clickable entry
    files.forEach(fileName => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-item";

      // Choose emoji icon based on file type
      const fileIcon = fileName.endsWith(".json")
        ? "📄"
        : fileName.endsWith(".png") || fileName.endsWith(".jpg")
        ? "🖼️"
        : "📎";

      fileItem.innerHTML = `
        <span class="file-icon">${fileIcon}</span>
        <span style="flex: 1;">${fileName}</span>
      `;

      // Highlight selected file and display content
      fileItem.onclick = async () => {
        document.querySelectorAll(".file-item").forEach(item => item.classList.remove("selected"));
        fileItem.classList.add("selected");

        await showFileContent(fileName); // defined elsewhere (data.js)
      };

      fileList.appendChild(fileItem);
    });

    if (typeof window.setGifSectionReady === "function") {
      window.setGifSectionReady("dataContent", true);
    }

    // Auto-visualize everything if preview image already loaded
    if (uploadedImgDataUrl) {
      await autoVisualizeAll(); // defined in viz.js
    }

    showStatus(`✅ Extracted ${files.length} files`, "success");

  } catch (error) {
    console.error("❌ Error extracting ZIP:", error);
    showStatus(`❌ Error: ${error.message}`, "error");
  }
}
