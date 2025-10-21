/* script.js
   Client-side image converter using Canvas.
   Notes:
   - WEBP support depends on browser (modern Chrome/Firefox/Edge/Safari support it).
   - For large images, conversion may be memory heavy.
*/

const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const previewImg = document.getElementById('previewImg');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const formatSelect = document.getElementById('formatSelect');
const qualityInput = document.getElementById('qualityInput');
const widthInput = document.getElementById('widthInput');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const message = document.getElementById('message');

let currentFile = null;
let imgElement = new Image();
imgElement.crossOrigin = 'anonymous';

function showMessage(text, isError = false) {
  message.textContent = text || '';
  message.style.color = isError ? '#ef4444' : '';
}

// Handle file selection
imageInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) loadFile(f);
});

// Drag and drop UI
;['dragenter','dragover'].forEach(evt=>{
  dropZone.addEventListener(evt, (e)=>{
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});
;['dragleave','drop'].forEach(evt=>{
  dropZone.addEventListener(evt, (e)=>{
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', e=>{
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
});

// Make the label clickable (keeps accessibility)
dropZone.querySelector('.file-label').addEventListener('click', () => {
  imageInput.click();
});

// Load file and show preview
function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    showMessage('Please upload a valid image file.', true);
    return;
  }
  currentFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    previewImg.onload = () => {
      showMessage(`Loaded: ${file.name} — ${previewImg.naturalWidth}×${previewImg.naturalHeight}`);
    };
  };
  reader.onerror = () => showMessage('Failed to read file.', true);
  reader.readAsDataURL(file);
}

// Reset
resetBtn.addEventListener('click', () => {
  currentFile = null;
  previewImg.src = '';
  imageInput.value = '';
  widthInput.value = '';
  showMessage('');
});

// Convert and download
convertBtn.addEventListener('click', async () => {
  if (!currentFile && !previewImg.src) {
    showMessage('Choose or drop an image first.', true);
    return;
  }

  const outType = formatSelect.value || 'image/png'; // MIME string like image/png
  let quality = parseInt(qualityInput.value, 10);
  if (isNaN(quality) || quality < 1) quality = 90;
  if (quality > 100) quality = 100;

  // calculate output dimensions
  const requestedWidth = parseInt(widthInput.value, 10) || null;
  const naturalW = previewImg.naturalWidth || imgElement.naturalWidth;
  const naturalH = previewImg.naturalHeight || imgElement.naturalHeight;
  if (!naturalW || !naturalH) {
    showMessage('Image not ready yet. Wait a moment and try again.', true);
    return;
  }

  let targetWidth = naturalW;
  let targetHeight = naturalH;
  if (requestedWidth && requestedWidth > 0 && requestedWidth < naturalW) {
    targetWidth = requestedWidth;
    targetHeight = Math.round((naturalH / naturalW) * targetWidth);
  }

  // draw to canvas
  const canvas = hiddenCanvas;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Use an intermediate Image object (ensure it's loaded)
  const drawImage = () => {
    try {
      ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
    } catch (err) {
      showMessage('Error drawing image to canvas: ' + err, true);
      return;
    }

    // For JPEG-like outputs, the quality range for toBlob is 0..1
    const blobQuality = Math.max(1, Math.min(100, quality)) / 100;

    // Try using toBlob (async) — preferred
    if (canvas.toBlob) {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showMessage('Conversion failed (blob is empty).', true);
          return;
        }
        triggerDownload(blob);
      }, outType, blobQuality);
    } else {
      // Fallback: dataURL (synchronous) then convert to blob
      try {
        const dataUrl = canvas.toDataURL(outType, blobQuality);
        const blob = dataURLtoBlob(dataUrl);
        triggerDownload(blob);
      } catch (err) {
        showMessage('Conversion failed: ' + err.message, true);
      }
    }
  };

  // Ensure preview image is ready. If not, create an Image and load the src.
  if (previewImg.complete && previewImg.naturalWidth) {
    drawImage();
  } else {
    const temp = new Image();
    temp.crossOrigin = 'anonymous';
    temp.onload = () => {
      previewImg.src = temp.src;
      drawImage();
    };
    temp.onerror = () => showMessage('Failed to load image for conversion.', true);
    temp.src = previewImg.src || URL.createObjectURL(currentFile);
  }

  showMessage('Processing...');

  function triggerDownload(blob) {
    const ext = mimeToExt(outType);
    const baseName = (currentFile && currentFile.name) ? currentFile.name.replace(/\.[^/.]+$/, '') : 'converted-image';
    const outName = `${baseName}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage(`Converted: ${outName} (size: ${Math.round(blob.size/1024)} KB)`);
  }

});

// utility: convert dataURL to blob
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function mimeToExt(mime) {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'img';
  }
}
