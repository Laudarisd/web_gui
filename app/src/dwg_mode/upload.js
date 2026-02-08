// ============================================================
// upload_dwg.js — DWG ZIP upload to FastAPI
// ============================================================

let uploadedImgDataUrl = null;
let currentZipBlob = null;
let currentZip = null;

function showStatus(message, type = "info") {
  const status = document.getElementById("uploadStatus");
  if (!status) {
    console.warn("uploadStatus element not found");
    return;
  }
  status.innerHTML = `<div class="status-message ${type}">${message}</div>`;
}

function updateProgress(percent) {
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");

  if (!progressBar || !progressFill || !submitBtn || !submitText) {
    console.warn("Progress elements missing");
    return;
  }

  if (percent > 0 && percent < 100) {
    progressBar.style.display = "block";
    progressFill.style.width = percent + "%";
    submitBtn.disabled = true;
    submitText.textContent = `Processing... ${percent}%`;
  } else if (percent >= 100) {
    progressFill.style.width = "100%";
    showStatus("✅ Upload Complete!", "success");
    setTimeout(() => {
      progressBar.style.display = "none";
      submitBtn.disabled = false;
      submitText.textContent = "🚀 Send to Server";
    }, 1000);
  } else {
    progressBar.style.display = "none";
    submitBtn.disabled = false;
    submitText.textContent = "🚀 Send to Server";
  }
}

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

window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ upload_dwg.js loaded and DOM ready");

  const form = document.getElementById("uploadForm");
  const zipInput = document.getElementById("zipInput");
  const preview = document.getElementById("zipPreview");

  if (!form) console.error("❌ uploadForm not found");
  if (!zipInput) console.error("❌ zipInput not found");
  if (!preview) console.warn("⚠️ zipPreview not found (optional)");

  // ZIP selection preview
  if (zipInput) {
    zipInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (preview) {
        preview.innerHTML = `
          <div style="font-size: 12px; color: #555;">
            <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)
          </div>
        `;
      }
    });
  }

  // Submit handler
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🚀 DWG form submitted");

      const file = zipInput?.files?.[0];

      if (!file) {
        showStatus("⚠️ Please select a ZIP file first.", "error");
        return;
      }

      if (!file.name.toLowerCase().endsWith(".zip")) {
        showStatus("⚠️ Invalid file. Please upload a .zip file.", "error");
        return;
      }

      const userId = document.getElementById("user_id")?.value || "web_user";
      const projectNumber = document.getElementById("project_number")?.value || "PRJ-1";

      const serverIp = document.getElementById("serverIp")?.value?.trim();
      const serverPort = document.getElementById("serverPort")?.value?.trim();

      if (!serverIp || !serverPort) {
        showStatus("⚠️ Please set server IP and port in settings.", "error");
        return;
      }

      const serverUrl = `http://${serverIp}:${serverPort}/receive_data`;
      console.log("📡 Sending to:", serverUrl);

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("project_number", projectNumber);
      formData.append("date", new Date().toISOString().split("T")[0]);
      formData.append("images", file);

      const xhr = new XMLHttpRequest();
      updateProgress(10);
      showStatus("📤 Uploading ZIP...", "info");

      try {
        const xhrResult = await new Promise((resolve, reject) => {
          xhr.timeout = 300000;

          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) {
              const percent = Math.round((ev.loaded / ev.total) * 80);
              updateProgress(percent);
            }
          });

          xhr.addEventListener("load", () => {
            console.log("✅ Server responded:", xhr.status);
            if (xhr.status === 200) resolve(xhr);
            else reject(new Error(`Server error: ${xhr.status}`));
          });

          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.addEventListener("timeout", () => reject(new Error("Request timed out")));

          xhr.open("POST", serverUrl, true);
          xhr.responseType = "blob";
          xhr.send(formData);
        });

        updateProgress(90);

        const blob = xhrResult.response;
        const contentType = xhrResult.getResponseHeader("Content-Type") || "";
        console.log("📦 Response Content-Type:", contentType);

        if (contentType.includes("application/zip")) {
          currentZipBlob = blob;
          showStatus(`✅ Results ZIP received (${(blob.size / 1024).toFixed(1)} KB)`, "success");

          const extractBtn = document.getElementById("extractBtn");
          if (extractBtn) extractBtn.style.display = "inline-block";

          if (typeof extractAndShowFiles === "function") {
            await extractAndShowFiles();
          } else {
            console.warn("⚠️ extractAndShowFiles() not found (zip.js not loaded?)");
          }

          downloadZipFile(blob, `${userId}_results.zip`);
          updateProgress(100);
        } else {
          const text = await blob.text();
          throw new Error(`Unexpected response: ${text}`);
        }

      } catch (err) {
        console.error("❌ Upload error:", err);
        showStatus(`❌ Error: ${err.message}`, "error");
        updateProgress(0);
      }
    });
  }
});
