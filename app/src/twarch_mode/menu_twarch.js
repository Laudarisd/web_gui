// ============================================================================
// menu_twarch.js — Handles TwARCH Mode UI + navigation
// ============================================================================

// Security: Clear saved server settings and restore mode selection only
window.addEventListener("DOMContentLoaded", () => {
  // Clear any saved server URL for security
  localStorage.removeItem("SERVER_URL");
  
  const mode = localStorage.getItem("APP_MODE") || "twarch";
  document.getElementById("appMode").value = mode;

  // Update menu title dynamically
  document.querySelector(".menu-title").textContent = "TwARCH Mode";
});

// Handle mode switching (parallel to other modes)
document.getElementById("appMode").addEventListener("change", (e) => {
  const mode = e.target.value;
  localStorage.setItem("APP_MODE", mode);

  if (mode === "image") {
    alert("Switching to Image Mode...");
    window.location.href = "index.html";
  } else if (mode === "dwg") {
    alert("Switching to DWG Mode...");
    window.location.href = "dwg_mode.html";
  } else if (mode === "twarch") {
    alert("Already in TwARCH Mode");
  }
});

// Modal-open / close behavior
document.getElementById("settingsBtn").onclick = () =>
  (document.getElementById("settingsModal").style.display = "flex");
document.getElementById("closeSettings").onclick = () =>
  (document.getElementById("settingsModal").style.display = "none");
