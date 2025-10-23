// upload.js
let uploadedImgDataUrl = null;

document.getElementById("image").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImgDataUrl = e.target.result;
      showImagePreview(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }
});

function showImagePreview(dataUrl, filename) {
  const preview = document.getElementById("imagePreview");
  preview.innerHTML = `
    <img src="${dataUrl}" style="max-width: 100%; max-height: 100px; border-radius: 6px; margin-top: 10px;">
  `;
}

function showStatus(message, type = 'info') {
  const status = document.getElementById("uploadStatus");
  status.innerHTML = `<div class="status-message ${type}">${message}</div>`;
}

function updateProgress(percent) {
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const submitBtn = document.getElementById("submitBtn");
  
  if (percent > 0 && percent < 100) {
    progressBar.style.display = "block";
    progressFill.style.width = percent + "%";
    submitBtn.disabled = true;
    document.getElementById("submitText").textContent = `Processing... ${percent}%`;
    showStatus(`📊 Upload Progress: ${percent}%`, "info");
  } else if (percent >= 100) {
    progressBar.style.display = "block";
    progressFill.style.width = "100%";
    showStatus("✅ Upload Complete!", "success");
    setTimeout(() => {
      progressBar.style.display = "none";
      submitBtn.disabled = false;
      document.getElementById("submitText").textContent = "🚀 Send to Server";
    }, 1000);
  } else {
    progressBar.style.display = "none";
    submitBtn.disabled = false;
    document.getElementById("submitText").textContent = "🚀 Send to Server";
  }
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  updateProgress(10);

  const formData = new FormData();
  formData.append("user_id", document.getElementById("user_id").value);
  formData.append("project_number", document.getElementById("project_number").value);
  formData.append("floor_number", document.getElementById("floor_number").value);
  formData.append("date", new Date().toISOString().split('T')[0]);
  formData.append("images", document.getElementById("image").files[0]);

  // Get remote IP and port from settings modal
  formData.append("remote_ip", document.getElementById("serverIp").value);
  formData.append("remote_port", document.getElementById("serverPort").value);

  try {
    updateProgress(30);
    showStatus(`📡 Sending data...`, "info");

    const xhr = new XMLHttpRequest();

    const uploadPromise = new Promise((resolve, reject) => {
      xhr.timeout = 120000;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 50) + 30;
          updateProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve(xhr);
        } else {
          reject(new Error(`Server error: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error"));
      });

      xhr.addEventListener("timeout", () => {
        reject(new Error("Request timed out"));
      });

      // Always use proxy URL
      xhr.open("POST", "http://localhost:5000/proxy/receive_data", true);
      xhr.responseType = "blob";
      xhr.send(formData);
    });
    
    const xhr_result = await uploadPromise;
    updateProgress(80);
    
    const blob = xhr_result.response;
    const contentType = xhr_result.getResponseHeader("Content-Type");
    
    updateProgress(90);
    
    if (contentType && contentType.includes("application/zip")) {
      const userId = document.getElementById("user_id").value || "result";
      const zipFileName = `${userId}.zip`;
      
      currentZipBlob = blob;
      
      showStatus(`✅ ZIP received (${(blob.size/1024).toFixed(1)} KB)`, "success");
      
      document.getElementById("zipInfo").innerHTML = `📦 ${zipFileName} (${(blob.size/1024).toFixed(1)} KB)`;
      document.getElementById("zipInfo").style.display = "block";
      document.getElementById("extractBtn").style.display = "block";
      
      downloadZipFile(blob, zipFileName);
      
      updateProgress(100);
      
    } else {
      throw new Error("Unexpected response type");
    }
  } catch (error) {
    updateProgress(0);
    showStatus(`❌ Error: ${error.message}`, "error");
  }
});

function downloadZipFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}