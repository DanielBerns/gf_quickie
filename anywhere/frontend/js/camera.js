/**
 * camera.js — Photo Capture Manager
 *
 * Uses file input with capture="environment" (native camera on mobile).
 * Compresses images client-side to max 800px wide, ~200 KB JPEG.
 * Supports up to 5 photos per report.
 */

const CameraManager = (() => {
  const MAX_PHOTOS   = 5;
  const MAX_PX       = 800;    // max width/height in pixels
  const JPEG_QUALITY = 0.75;   // JPEG compression quality

  let _photos = [];  // Array of { blob, dataUrl } objects

  // ── Compress image blob ───────────────────────────────────────
  function _compressBlob(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width > MAX_PX || height > MAX_PX) {
          if (width >= height) {
            height = Math.round(height * (MAX_PX / width));
            width  = MAX_PX;
          } else {
            width  = Math.round(width * (MAX_PX / height));
            height = MAX_PX;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compresión fallida')); return; }
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve({ blob, dataUrl });
        }, 'image/jpeg', JPEG_QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
      img.src = url;
    });
  }

  // ── Thumbnail rendering ───────────────────────────────────────
  function _renderThumbnails() {
    const row = document.getElementById('photo-row');
    if (!row) return;
    row.innerHTML = '';

    _photos.forEach((photo, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `
        <img src="${photo.dataUrl}" alt="Foto ${idx + 1}">
        <button class="remove-photo" data-idx="${idx}"
                aria-label="Eliminar foto ${idx + 1}">✕</button>
      `;
      thumb.querySelector('.remove-photo').addEventListener('click', () => removePhoto(idx));
      row.appendChild(thumb);
    });

    _updateUI();
  }

  function _updateUI() {
    const n = _photos.length;
    
    const startBtn    = document.getElementById('start-camera-btn');
    const fallbackBtn = document.getElementById('fallback-photo-btn');
    const status      = document.getElementById('photos-status');
    const note        = document.getElementById('photo-limit-note');
    const section     = document.getElementById('section-photos');

    const limitReached = (n >= MAX_PHOTOS);
    if (startBtn) startBtn.disabled = limitReached;
    if (fallbackBtn) fallbackBtn.disabled = limitReached;

    if (status)  {
      status.textContent = n > 0 ? `${n} foto${n > 1 ? 's' : ''}` : 'Sin fotos';
      status.className   = `section-status${n > 0 ? ' done' : ''}`;
    }
    if (note) note.textContent = limitReached ? 'Límite de fotos alcanzado' : `Máximo ${MAX_PHOTOS} fotos`;
    if (section) section.classList.toggle('has-data', n > 0);
  }

  // ── Video Capture Logic ───────────────────────────────────────
  let _stream = null;
  let _shouldBeOn = false;

  async function startCamera(e) {
    if (e) e.preventDefault();
    if (_photos.length >= MAX_PHOTOS) return;
    _shouldBeOn = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      if (!_shouldBeOn) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      _stream = stream;
      const video = document.getElementById('camera-feed');
      video.srcObject = _stream;
      video.classList.remove('hidden');

      // Update Buttons
      document.getElementById('start-camera-btn').classList.add('hidden');
      document.getElementById('fallback-photo-btn').classList.add('hidden');
      document.getElementById('capture-photo-btn').classList.remove('hidden');
      document.getElementById('cancel-camera-btn').classList.remove('hidden');

    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      // Automatically fallback if permissions denied or not supported
      showToast('⚠️ Cámara no disponible. Usa "Adjuntar desde galería".', 'error');
      stopCamera();
    }
  }

  function stopCamera(e) {
    if (e) e.preventDefault();
    _shouldBeOn = false;
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    const video = document.getElementById('camera-feed');
    if (video) video.classList.add('hidden');

    document.getElementById('start-camera-btn')?.classList.remove('hidden');
    document.getElementById('fallback-photo-btn')?.classList.remove('hidden');
    document.getElementById('capture-photo-btn')?.classList.add('hidden');
    document.getElementById('cancel-camera-btn')?.classList.add('hidden');
  }

  function captureFrame(e) {
    if (e) e.preventDefault();
    if (!_stream) return;
    if (_photos.length >= MAX_PHOTOS) return;

    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('photo-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const photo = await _compressBlob(blob);
        _photos.push(photo);
        _renderThumbnails();
        stopCamera();
      } catch (err) {
        console.error('Error al procesar la foto capturada:', err);
        showToast('❌ Error al procesar la imagen.', 'error');
      }
    }, 'image/jpeg', 0.95);
  }

  // ── Public API ────────────────────────────────────────────────
  function init() {
    const fileInput   = document.getElementById('photo-input');
    const startBtn    = document.getElementById('start-camera-btn');
    const captureBtn  = document.getElementById('capture-photo-btn');
    const cancelBtn   = document.getElementById('cancel-camera-btn');
    const fallbackBtn = document.getElementById('fallback-photo-btn');

    if (startBtn) startBtn.addEventListener('click', startCamera);
    if (captureBtn) captureBtn.addEventListener('click', captureFrame);
    if (cancelBtn) cancelBtn.addEventListener('click', stopCamera);

    if (fallbackBtn && fileInput) {
      fallbackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (_photos.length >= MAX_PHOTOS) return;
        fileInput.value = '';  // reset so same file can be re-selected
        fileInput.click();
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const photo = await _compressBlob(file);
          _photos.push(photo);
          _renderThumbnails();
        } catch (err) {
          console.error('Error al procesar foto:', err);
        }
      });
    }

    _updateUI();
  }

  function removePhoto(idx) {
    _photos.splice(idx, 1);
    _renderThumbnails();
  }

  function getPhotoBlobs() {
    return _photos.map(p => p.blob);
  }

  function clear() {
    _photos = [];
    _renderThumbnails();
    stopCamera();
  }

  // Make sure we have a way to show toast (usually defined in app.js, fallback if missing)
  const showToast = typeof window.showToast === 'function' ? window.showToast : console.log;

  return { init, getPhotoBlobs, clear, count: () => _photos.length };
})();
