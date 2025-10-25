// ============================================================
// data.js — Displays file content (JSON, images, or text) from ZIP
// Purpose: show structured data or images inside "Data Check" panel
// ============================================================

let selectedJson = null;      // stores the currently opened JSON object
let currentFileName = "";     // keeps track of which file is currently selected

// ============================================================================
// Function: showFileContent(fileName)
// Purpose: Display contents of a selected file (JSON, image, or plain text)
// Called when user clicks a file name in the ZIP Contents list.
// ============================================================================
async function showFileContent(fileName) {
  const dataCheck = document.getElementById("dataCheckContent");
  currentFileName = fileName;

  try {
    // ------------------------------------------------------------
    // Case 1: JSON file (usually annotations, segmentation, or crop info)
    // ------------------------------------------------------------
    if (fileName.endsWith(".json")) {
      // Read JSON as string from ZIP
      const content = await currentZip.files[fileName].async("string");
      selectedJson = JSON.parse(content);

      // Count number of detected objects, if structure matches dataset format
      const objCount = selectedJson.data?.objects?.length || selectedJson.objects?.length || 0;

      // Display JSON content in pretty-print format
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <p style="margin-bottom: 10px;"><strong>Objects:</strong> ${objCount}</p>
        <pre>${JSON.stringify(selectedJson, null, 2)}</pre>
      `;

      // If base floorplan image is loaded, visualize JSON annotations on it
      // (handled by visualizeOnMain() in viz.js)
      if (uploadedImgDataUrl) {
        visualizeOnMain();
      }

    // ------------------------------------------------------------
    // Case 2: Image file (PNG/JPG)
    // ------------------------------------------------------------
    } else if (
      fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg")
    ) {
      // Extract image as Blob and create a temporary object URL
      const blob = await currentZip.files[fileName].async("blob");
      const url = URL.createObjectURL(blob);

      // Show the image preview inside "Data Check" panel
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <img src="${url}" style="max-width: 100%; border-radius: 6px;">
      `;

    // ------------------------------------------------------------
    // Case 3: Any other file (e.g., TXT, CSV, XML, etc.)
    // ------------------------------------------------------------
    } else {
      const content = await currentZip.files[fileName].async("string");

      // Show raw text content
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <pre>${content}</pre>
      `;
    }

  } catch (error) {
    // ------------------------------------------------------------
    // Handle any read/parse/display errors gracefully
    // ------------------------------------------------------------
    console.error("❌ Error reading file:", error);
    dataCheck.innerHTML = `
      <p class="status-message error">Error: ${error.message}</p>
    `;
  }
}
