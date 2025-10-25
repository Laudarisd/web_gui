// ============================================================
// menu.js — Controls the Settings modal for server configuration
// Purpose: lets users define remote FastAPI IP and port directly
// ============================================================

// ------------------------------------------------------------
// "Settings" button click → open settings modal
// ------------------------------------------------------------
// Reason: gives user access to change server IP/Port without editing code.
document.getElementById("settingsBtn").onclick = function() {
  document.getElementById("settingsModal").style.display = "flex";
};

// ------------------------------------------------------------
// "X" (close) button click → close modal
// ------------------------------------------------------------
// Reason: allows user to cancel without saving; hides the modal overlay.
document.getElementById("closeSettings").onclick = function() {
  document.getElementById("settingsModal").style.display = "none";
};

// ------------------------------------------------------------
// "Save" button click → save new IP and port
// ------------------------------------------------------------
// Reason: store FastAPI address globally so upload.js can use it.
// Notes:
//  - We build the base URL dynamically: http://<ip>:<port>/receive_data
//  - Stored in `window.SERVER_URL` for potential future global use
//  - We also update the visible modal fields for consistency.
document.getElementById("saveSettings").onclick = function() {
  const ip = document.getElementById("serverIp").value.trim();
  const port = document.getElementById("serverPort").value.trim();

  // Basic validation
  if (!ip || !port) {
    alert("⚠️ Please enter both IP and port before saving.");
    return;
  }

  // Build FastAPI server URL (no Flask proxy anymore)
  window.SERVER_URL = `http://${ip}:${port}/receive_data`;

  // Give feedback to the user (temporary alert confirmation)
  alert(`✅ Server URL set to: ${window.SERVER_URL}`);

  // Hide modal after saving
  document.getElementById("settingsModal").style.display = "none";
};
