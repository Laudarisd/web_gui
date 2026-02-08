// ============================================================================
// menu_dwg.js — Handles DWG mode UI + server settings
// Same behavior as image_mode/menu.js
// ============================================================================

// Utility: set server URL (session only - not persisted for security)
function setServerURL(ip, port) {
  window.SERVER_URL = `http://${ip}:${port}/receive_data`;
  alert(`✅ Server URL set to: ${window.SERVER_URL}`);
}

// Security: Always reset to default on load
window.addEventListener("DOMContentLoaded", () => {
  // Clear any saved settings for security
  localStorage.removeItem("SERVER_URL");
  
  // Restore mode selection only
  const mode = localStorage.getItem("APP_MODE") || "dwg";
  document.getElementById("appMode").value = mode;
  document.querySelector(".menu-title").textContent = "DWG MODE";

  // Always default to 127.0.0.1:5000
  document.getElementById("serverIp").value = "127.0.0.1";
  document.getElementById("serverPort").value = "5000";
  window.SERVER_URL = "http://127.0.0.1:5000/receive_data";
});

// Mode switching
document.getElementById("appMode").addEventListener("change", (e) => {
  const mode = e.target.value;
  localStorage.setItem("APP_MODE", mode);

  if (mode === "image") {
    alert("Switching to Image Mode...");
    window.location.href = "index.html";
  } else if (mode === "dwg") {
    alert("Already in DWG Mode");
  } else if (mode === "twarch") {
    alert("Switching to TwARCH Mode...");
    window.location.href = "twarch_mode.html";
  }
});

// Modal open / close
document.getElementById("settingsBtn").onclick = () => {
  document.getElementById("settingsModal").style.display = "flex";
};

document.getElementById("closeSettings").onclick = () => {
  document.getElementById("settingsModal").style.display = "none";
};

// Save button (IMPORTANT)
document.getElementById("saveSettings").onclick = () => {
  const ip = document.getElementById("serverIp").value.trim();
  const port = document.getElementById("serverPort").value.trim();

  if (!ip || !port) {
    alert("⚠️ Please enter both IP and port.");
    return;
  }

  setServerURL(ip, port);
  document.getElementById("settingsModal").style.display = "none";
};
