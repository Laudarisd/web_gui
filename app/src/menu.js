document.getElementById("settingsBtn").onclick = function() {
  document.getElementById("settingsModal").style.display = "flex";
};
document.getElementById("closeSettings").onclick = function() {
  document.getElementById("settingsModal").style.display = "none";
};
document.getElementById("saveSettings").onclick = function() {
  const ip = document.getElementById("serverIp").value.trim();
  const port = document.getElementById("serverPort").value.trim();
  // Update global SERVER_URL (used in upload.js)
  window.SERVER_URL = `http://${ip}:${port}/proxy/receive_data`;
  alert(`Server URL set to: ${window.SERVER_URL}`);
  document.getElementById("settingsModal").style.display = "none";
};