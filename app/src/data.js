// data.js
let selectedJson = null;
let currentFileName = "";

async function showFileContent(fileName) {
  const dataCheck = document.getElementById("dataCheckContent");
  currentFileName = fileName;
  
  try {
    if (fileName.endsWith('.json')) {
      const content = await currentZip.files[fileName].async("string");
      selectedJson = JSON.parse(content);
      
      const objCount = selectedJson.data?.objects?.length || selectedJson.objects?.length || 0;
      
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <p style="margin-bottom: 10px;"><strong>Objects:</strong> ${objCount}</p>
        <pre>${JSON.stringify(selectedJson, null, 2)}</pre>
      `;
      
      if (uploadedImgDataUrl) {
        visualizeOnMain();
      }
      
    } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      const blob = await currentZip.files[fileName].async("blob");
      const url = URL.createObjectURL(blob);
      
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <img src="${url}" style="max-width: 100%; border-radius: 6px;">
      `;
      
    } else {
      const content = await currentZip.files[fileName].async("string");
      dataCheck.innerHTML = `
        <h4 style="color: #6B7A5A; margin-bottom: 10px;">${fileName}</h4>
        <pre>${content}</pre>
      `;
    }
  } catch (error) {
    dataCheck.innerHTML = `<p class="status-message error">Error: ${error.message}</p>`;
  }
}