// ============================================================================
// menu.js — Manages server connection settings (IP, port) via modal interface
// Purpose: lets users easily switch between local and remote FastAPI endpoints
//           without touching code, even after page reload or GitHub deployment.
// ============================================================================

// ---------------------------------------------------------------------------
// 🔧 Utility: Update global URL (session only - not persisted)
// ---------------------------------------------------------------------------
// Why: For security, server settings are not saved across page reloads.
// Users must re-enter server details each session when using custom endpoints.
function setServerURL(ip, port) {
  window.SERVER_URL = `http://${ip}:${port}/receive_data`;
  alert(`✅ Server URL set to: ${window.SERVER_URL}`);
}

// ---------------------------------------------------------------------------
// Security: Always reset to default on page load
// ---------------------------------------------------------------------------
// Why: Prevents exposure of sensitive server IPs when hosted publicly.
// Users must manually enter server details each session for security.
window.addEventListener("DOMContentLoaded", () => {
  // Always clear any saved server URL for security
  localStorage.removeItem("SERVER_URL");
  
  // Reset to default values
  document.getElementById("serverIp").value = "127.0.0.1";
  document.getElementById("serverPort").value = "5000";
  
  // Set default SERVER_URL
  window.SERVER_URL = "http://127.0.0.1:5000/receive_data";
});

// ---------------------------------------------------------------------------
// "Settings" button → open modal
// ---------------------------------------------------------------------------
// Why: Allows users to change backend address dynamically without reloading.
document.getElementById("settingsBtn").onclick = function() {
  document.getElementById("settingsModal").style.display = "flex";
};

// ---------------------------------------------------------------------------
//  "X" button → close modal (no save)
// ---------------------------------------------------------------------------
// Why: User might want to cancel or inspect current settings without applying.
document.getElementById("closeSettings").onclick = function() {
  document.getElementById("settingsModal").style.display = "none";
};

// ---------------------------------------------------------------------------
// "Save" button → build and save FastAPI endpoint
// ---------------------------------------------------------------------------
// Why: Sets a global variable accessible by upload.js and other modules.
// Note: Includes minimal validation to prevent empty fields.
document.getElementById("saveSettings").onclick = function() {
  const ip = document.getElementById("serverIp").value.trim();
  const port = document.getElementById("serverPort").value.trim();

  if (!ip || !port) {
    alert("⚠️ Please enter both IP and port before saving.");
    return;
  }

  setServerURL(ip, port);

  // Hide modal
  document.getElementById("settingsModal").style.display = "none";

  // Optional: verify connection immediately
  testServerConnection();
};

// ---------------------------------------------------------------------------
//  Quick connectivity check to FastAPI backend
// ---------------------------------------------------------------------------
// Why: Helps user confirm whether the backend is reachable (e.g., on remote IP).
// Works by pinging `/health` endpoint; ignores CORS errors gracefully.
async function testServerConnection() {
  if (!window.SERVER_URL) return;

  const indicator = document.getElementById("connectionStatus");
  if (indicator) indicator.textContent = "⏳ Testing connection...";

  try {
    const baseUrl = new URL(window.SERVER_URL);
    const healthUrl = `${baseUrl.origin}/health`; // expect FastAPI /health route

    const res = await fetch(healthUrl, { method: "GET" });
    if (res.ok) {
      if (indicator) indicator.textContent = "🟢 Connected to server";
      console.log("✅ FastAPI reachable:", healthUrl);
    } else {
      if (indicator) indicator.textContent = "🟠 Server responded, but not OK";
      console.warn("⚠️ Server response not OK:", res.status);
    }
  } catch (err) {
    if (indicator) indicator.textContent = "🔴 Cannot reach server";
    console.error("❌ Connection test failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Handle Mode Switching (Image / DWG / TwARCH)
// ---------------------------------------------------------------------------
// Runs whenever user changes the "Choose Mode" dropdown in settings modal.
const modeDropdown = document.getElementById("appMode");

// Restore previously selected mode on page load
window.addEventListener("DOMContentLoaded", () => {
  const savedMode = localStorage.getItem("APP_MODE") || "image";
  modeDropdown.value = savedMode;
});

if (modeDropdown) {
  modeDropdown.addEventListener("change", (e) => {
    const selectedMode = e.target.value;
    localStorage.setItem("APP_MODE", selectedMode);

    if (selectedMode === "image") {
      alert("You are now in Image Mode.");
      // stay on same page
    } 
    else if (selectedMode === "dwg") {
      alert("Switching to DWG Mode...");
      window.location.href = "dwg_mode.html"; // future DWG GUI
    } 
    else if (selectedMode === "twarch") {
      alert("Switching to TwARCH Mode...");
      window.location.href = "twarch_mode.html"; // future TwARCH GUI
    }
  });
}

