// ============================================================================
// menu.js — Manages server connection settings (IP, port) via modal interface
// Purpose: lets users easily switch between local and remote FastAPI endpoints
//           without touching code, even after page reload or GitHub deployment.
// ============================================================================

// ---------------------------------------------------------------------------
// 🔧 Utility: Update global URL and persist it in localStorage
// ---------------------------------------------------------------------------
// Why: Persisting allows the web app to remember the last used backend even
//      after reloads or when hosted statically (e.g., on GitHub Pages).
function setServerURL(ip, port) {
  window.SERVER_URL = `http://${ip}:${port}/receive_data`;
  localStorage.setItem("SERVER_URL", window.SERVER_URL);
  alert(`✅ Server URL set to: ${window.SERVER_URL}`);
}

// ---------------------------------------------------------------------------
// 🧭 Restore previously saved server settings on page load
// ---------------------------------------------------------------------------
// Why: Avoids retyping server IP every time. Works across sessions in same browser.
window.addEventListener("DOMContentLoaded", () => {
  const savedUrl = localStorage.getItem("SERVER_URL");
  if (savedUrl) {
    window.SERVER_URL = savedUrl;
    // Extract IP and port for display
    try {
      const url = new URL(savedUrl);
      const hostParts = url.host.split(":");
      document.getElementById("serverIp").value = hostParts[0] || "";
      document.getElementById("serverPort").value = hostParts[1] || "";
    } catch (e) {
      console.warn("⚠️ Invalid saved SERVER_URL, resetting...");
      localStorage.removeItem("SERVER_URL");
    }
  }
});

// ---------------------------------------------------------------------------
// ⚙️ "Settings" button → open modal
// ---------------------------------------------------------------------------
// Why: Allows users to change backend address dynamically without reloading.
document.getElementById("settingsBtn").onclick = function() {
  document.getElementById("settingsModal").style.display = "flex";
};

// ---------------------------------------------------------------------------
// ❌ "X" button → close modal (no save)
// ---------------------------------------------------------------------------
// Why: User might want to cancel or inspect current settings without applying.
document.getElementById("closeSettings").onclick = function() {
  document.getElementById("settingsModal").style.display = "none";
};

// ---------------------------------------------------------------------------
// 💾 "Save" button → build and save FastAPI endpoint
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
// 🔍 Quick connectivity check to FastAPI backend
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
