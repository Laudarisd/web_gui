// zip.js
let currentZipBlob = null;
let currentZip = null;
let zipFiles = [];

// Crop transformation info - CRITICAL for coordinate conversion
let scaleInfo = {
  originalWidth: 0,
  originalHeight: 0,
  cropWidth: 0,
  cropHeight: 0,
  cropXMin: 0,  // Crop position in original image
  cropYMin: 0,
  cropXMax: 0,
  cropYMax: 0,
  scaleX: 1,
  scaleY: 1,
  extracted: false
};

document.getElementById("extractBtn").addEventListener("click", async () => {
  await extractAndShowFiles();
});

// ============================================================================
// Extract scale info from crop JSON
// ============================================================================
async function extractScaleInfo() {
  if (!currentZip) return false;
  
  const files = Object.keys(currentZip.files).filter(name => !currentZip.files[name].dir);
  const cropJsonFile = files.find(f => f.toLowerCase().includes('crop') && f.endsWith('.json'));
  
  if (!cropJsonFile) {
    console.warn("⚠️ No crop JSON found");
    return false;
  }
  
  try {
    const cropContent = await currentZip.files[cropJsonFile].async("string");
    const cropData = JSON.parse(cropContent);
    const cropObjs = cropData.data?.objects || cropData.objects || [];
    const firstObj = cropObjs[0];
    
    if (firstObj && firstObj.original_size && firstObj.crop_size) {
      scaleInfo.originalWidth = firstObj.original_size.width;
      scaleInfo.originalHeight = firstObj.original_size.height;
      scaleInfo.cropWidth = firstObj.crop_size.width;
      scaleInfo.cropHeight = firstObj.crop_size.height;
      
      // Extract crop offset from bbox
      if (firstObj.bbox) {
        scaleInfo.cropXMin = firstObj.bbox.xmin || 0;
        scaleInfo.cropYMin = firstObj.bbox.ymin || 0;
        scaleInfo.cropXMax = firstObj.bbox.xmax || scaleInfo.originalWidth;
        scaleInfo.cropYMax = firstObj.bbox.ymax || scaleInfo.originalHeight;
      }
      
      scaleInfo.scaleX = (scaleInfo.cropXMax - scaleInfo.cropXMin) / scaleInfo.cropWidth;
      scaleInfo.scaleY = (scaleInfo.cropYMax - scaleInfo.cropYMin) / scaleInfo.cropHeight;
      
      scaleInfo.extracted = true;
      
      console.log("✅ Scale extracted:", {
        original: `${scaleInfo.originalWidth}×${scaleInfo.originalHeight}`,
        crop: `${scaleInfo.cropWidth}×${scaleInfo.cropHeight}`,
        offset: `(${scaleInfo.cropXMin}, ${scaleInfo.cropYMin})`,
        scale: `${scaleInfo.scaleX.toFixed(3)}×, ${scaleInfo.scaleY.toFixed(3)}×`
      });
      
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
    console.error("❌ Error extracting scale:", e);
  }
  
  return false;
}

async function extractAndShowFiles() {
  if (!currentZipBlob) {
    showStatus("❌ No ZIP file available!", "error");
    return;
  }
  
  try {
    currentZip = await JSZip.loadAsync(currentZipBlob);
    
    // Extract scale info first
    await extractScaleInfo();
    
    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";
    
    const files = Object.keys(currentZip.files).filter(name => !currentZip.files[name].dir);
    zipFiles = files;
    
    if (files.length === 0) {
      fileList.innerHTML = "<p>No files found in ZIP</p>";
      return;
    }
    
    files.forEach(fileName => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-item";
      
      const fileIcon = fileName.endsWith('.json') ? '📄' : 
                      fileName.endsWith('.png') || fileName.endsWith('.jpg') ? '🖼️' : '📎';
      
      fileItem.innerHTML = `
        <span class="file-icon">${fileIcon}</span>
        <span style="flex: 1;">${fileName}</span>
      `;
      
      fileItem.onclick = async () => {
        document.querySelectorAll('.file-item').forEach(item => item.classList.remove('selected'));
        fileItem.classList.add('selected');
        
        await showFileContent(fileName);
      };
      
      fileList.appendChild(fileItem);
    });
    
    if (uploadedImgDataUrl) {
      await autoVisualizeAll();
    }
    
    showStatus(`✅ Extracted ${files.length} files`, "success");
    
  } catch (error) {
    console.error("Error extracting ZIP:", error);
    showStatus(`❌ Error: ${error.message}`, "error");
  }
}