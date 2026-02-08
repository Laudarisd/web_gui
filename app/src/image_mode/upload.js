// ============================================================
// upload.js — Sends selected image directly to FastAPI server,
// tracks progress, and auto-loads returned ZIP for inspection.
// ============================================================

let uploadedImgDataUrl = null;     // stores preview image as DataURL for quick display
let currentZipBlob = null;         // global ZIP blob (shared with zip.js)
let currentZip = null;             // JSZip object (used by zip.js later)

// ------------------------------------------------------------
// Handle image selection and preview
// ------------------------------------------------------------
document.getElementById("image").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();

    // FileReader converts file → base64 preview
    reader.onload = (e) => {
      uploadedImgDataUrl = e.target.result;
      showImagePreview(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }
});

// Displays a small preview image and filename below input
function showImagePreview(dataUrl, filename) {
  const preview = document.getElementById("imagePreview");
  preview.innerHTML = `
    <img src="${dataUrl}" style="max-width: 100%; max-height: 100px; border-radius: 6px; margin-top: 10px;">
    <div style="font-size: 12px; color: #555;">${filename}</div>
  `;
}

// ------------------------------------------------------------
// Utility: show upload status messages (info/success/error)
// ------------------------------------------------------------
function showStatus(message, type = "info") {
  const status = document.getElementById("uploadStatus");
  status.innerHTML = `<div class="status-message ${type}">${message}</div>`;
}

// ------------------------------------------------------------
// Utility: visual progress bar control
// ------------------------------------------------------------
function updateProgress(percent) {
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const submitBtn = document.getElementById("submitBtn");

  if (percent > 0 && percent < 100) {
    // While uploading — show progress
    progressBar.style.display = "block";
    progressFill.style.width = percent + "%";
    submitBtn.disabled = true;
    document.getElementById("submitText").textContent = `Processing... ${percent}%`;
  } else if (percent >= 100) {
    // Upload finished
    progressFill.style.width = "100%";
    showStatus("✅ Upload Complete!", "success");
    setTimeout(() => {
      progressBar.style.display = "none";
      submitBtn.disabled = false;
      document.getElementById("submitText").textContent = "🚀 Send to Server";
    }, 1000);
  } else {
    // Reset state
    progressBar.style.display = "none";
    submitBtn.disabled = false;
    document.getElementById("submitText").textContent = "🚀 Send to Server";
  }
}

// ------------------------------------------------------------
// Main: Handle form submission → send file to FastAPI
// ------------------------------------------------------------
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // stop default form reload

  if (typeof window.setGifSectionReady === "function") {
    window.setGifSectionReady("dataContent", false);
    window.setGifSectionReady("dataCheck", false);
    window.setGifSectionReady("visualization", false);
  }

  const dataCheck = document.getElementById("dataCheckContent");
  if (dataCheck) {
    dataCheck.innerHTML = "";
    dataCheck.style.display = "none";
  }

  const fileList = document.getElementById("fileList");
  if (fileList) fileList.innerHTML = "";

  const fileInput = document.getElementById("image");
  const file = fileInput.files[0];
  if (!file) {
    showStatus("⚠️ Please select an image first.", "error");
    return;
  }

  // Collect metadata + server info from user input
  const userId = document.getElementById("user_id").value || "web_user";
  const projectNumber = document.getElementById("project_number").value || "PRJ-1";
  const floorNumber = document.getElementById("floor_number").value || "floor_1";
  const serverIp = document.getElementById("serverIp").value.trim();
  const serverPort = document.getElementById("serverPort").value.trim();

  // Validate IP/port presence
  if (!serverIp || !serverPort) {
    showStatus("⚠️ Please set server IP and port in settings.", "error");
    return;
  }

  // Construct full FastAPI endpoint URL
  const serverUrl = `http://${serverIp}:${serverPort}/receive_data`;
  console.log(`📡 Sending to ${serverUrl}`);

  // Prepare form data exactly as FastAPI expects
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("project_number", projectNumber);
  formData.append("floor_number", floorNumber);
  formData.append("date", new Date().toISOString().split("T")[0]);
  formData.append("images", file);

  const xhr = new XMLHttpRequest();
  updateProgress(10);
  showStatus("📤 Uploading...", "info");

  try {
    // Wrap XHR in a Promise to await completion
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.timeout = 120000; // 2 min timeout

      // Update progress bar during upload
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 80);
          updateProgress(percent);
        }
      });

      // When request completes successfully
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) resolve(xhr);
        else reject(new Error(`Server error: ${xhr.status}`));
      });

      // Handle errors / timeouts
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.addEventListener("timeout", () => reject(new Error("Request timed out")));

      // Open and send POST request to FastAPI endpoint
      xhr.open("POST", serverUrl, true);
      xhr.responseType = "blob";  // Expect a ZIP blob in response
      xhr.send(formData);
    });

    // Wait for upload to finish
    const xhr_result = await uploadPromise;
    updateProgress(90);

    // Extract response
    const blob = xhr_result.response;
    const contentType = xhr_result.getResponseHeader("Content-Type");

    // --------------------------------------------------------
    // If FastAPI returned a ZIP, save it and auto-extract
    // --------------------------------------------------------
    if (contentType && contentType.includes("application/zip")) {
      const zipFileName = `${userId}.zip`;
      currentZipBlob = blob; // store globally for zip.js to read

      showStatus(`✅ ZIP received (${(blob.size / 1024).toFixed(1)} KB)`, "success");

      // Automatically extract ZIP contents (uses zip.js)
      if (typeof extractAndShowFiles === "function") {
        await extractAndShowFiles();
      }

      // Still download the file locally for user
      downloadZipFile(blob, zipFileName);
      updateProgress(100);
    } else {
      // Unexpected response (e.g., JSON error message)
      const text = await blob.text();
      throw new Error(`Unexpected response: ${text}`);
    }

  } catch (err) {
    // Catch all network or server errors
    showStatus(`❌ Error: ${err.message}`, "error");
    updateProgress(0);
    
    // Hide running puppy on error
    if (typeof window.hideRunningPuppy === "function") {
      window.hideRunningPuppy();
    }
  }
});

// ------------------------------------------------------------
// Utility: trigger ZIP file download for user
// ------------------------------------------------------------
function downloadZipFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
