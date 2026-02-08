// ============================================================
// data_dwg.js — Displays file content (JSON, images, or text) from ZIP (DWG mode)
// Purpose: show structured data or images inside "Data Check" panel
// ============================================================

let selectedJson = null;   // stores the currently opened JSON object
let currentFileName = "";  // keeps track of which file is currently selected

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
    // Case 1: JSON file
    // ------------------------------------------------------------
    if (fileName.toLowerCase().endsWith(".json")) {
      const content = await currentZip.files[fileName].async("string");
      selectedJson = JSON.parse(content);

      const objCount =
        selectedJson.data?.objects?.length ||
        selectedJson.objects?.length ||
        0;

      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <p style="margin-bottom: 10px;"><strong>Objects:</strong> ${objCount}</p>
        <pre>${JSON.stringify(selectedJson, null, 2)}</pre>
      `;

      // ✅ DWG mode: base image is often in ZIP, not uploadedImgDataUrl
      if (typeof visualizeOnMain === "function") {
        visualizeOnMain();
      }

    // ------------------------------------------------------------
    // Case 2: Image file (PNG/JPG)
    // ------------------------------------------------------------
    } else if (/\.(png|jpg|jpeg)$/i.test(fileName)) {
      const blob = await currentZip.files[fileName].async("blob");
      const url = URL.createObjectURL(blob);

      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <img src="${url}" style="max-width: 100%; border-radius: 6px;">
      `;

    // ------------------------------------------------------------
    // Case 3: Other text-like file
    // ------------------------------------------------------------
    } else {
      const content = await currentZip.files[fileName].async("string");
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <pre>${content}</pre>
      `;
    }

  } catch (error) {
    console.error("❌ Error reading file:", error);
    dataCheck.innerHTML = `
      <p class="status-message error">Error: ${error.message}</p>
    `;
  }
}
