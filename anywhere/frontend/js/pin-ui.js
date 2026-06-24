/**
 * pin-ui.js — PIN Gate UI and QR Scanner
 *
 * Renders the PIN entry keypad and manages the QR scanner overlay.
 * Delegates actual auth to PinAuthManager (auth.js).
 */

const PinUI = (() => {
  const MAX_DIGITS = 6;
  let digits = [];
  let qrStream = null;
  let qrScanning = false;

  // ── DOM references (set after DOMContentLoaded) ──────────────
  let $gate, $dots, $error, $app, $qrOverlay, $qrVideo;

  function init() {
    $gate      = document.getElementById('pin-gate');
    $dots      = document.querySelectorAll('.pin-dot');
    $error     = document.getElementById('pin-error');
    $app       = document.getElementById('app');
    $qrOverlay = document.getElementById('qr-scanner-overlay');
    $qrVideo   = document.getElementById('qr-video');

    // Digit keys
    document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
      btn.addEventListener('click', () => pressDigit(btn.dataset.digit));
    });

    // Delete key
    document.getElementById('pin-delete-btn').addEventListener('click', deleteDigit);

    // QR button
    document.getElementById('pin-qr-btn').addEventListener('click', startQrScan);
    document.getElementById('qr-cancel-btn').addEventListener('click', stopQrScan);
  }

  function pressDigit(d) {
    if (digits.length >= MAX_DIGITS) return;
    digits.push(d);
    renderDots();
    clearError();
    if (digits.length === MAX_DIGITS) submitPin(digits.join(''));
  }

  function deleteDigit() {
    digits.pop();
    renderDots();
    clearError();
  }

  function renderDots() {
    $dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < digits.length);
      dot.classList.remove('error');
    });
  }

  function showError(msg) {
    $error.textContent = msg;
    $dots.forEach(d => d.classList.add('error'));
    digits = [];
    // Re-trigger animation
    $error.style.animation = 'none';
    requestAnimationFrame(() => {
      $error.style.animation = '';
    });
    setTimeout(() => renderDots(), 400);
  }

  function clearError() { $error.textContent = ''; }

  async function submitPin(pin) {
    try {
      const ok = await PinAuthManager.unlock(pin);
      if (ok) {
        showApp();
      } else {
        showError('PIN incorrecto. Intente nuevamente.');
      }
    } catch {
      showError('Error de conexión. Verifique el servidor.');
    }
  }

  function showApp() {
    $gate.style.display = 'none';
    $app.classList.remove('hidden');
    // Trigger app initialization
    window.dispatchEvent(new CustomEvent('app-unlocked'));
  }

  // ── QR Scanner ────────────────────────────────────────────────
  async function startQrScan() {
    if (!('BarcodeDetector' in window)) {
      alert('Su navegador no soporta el escáner QR. Ingrese el PIN manualmente.');
      return;
    }

    try {
      qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      $qrVideo.srcObject = qrStream;
      $qrOverlay.classList.add('active');
      qrScanning = true;
      scanFrame();
    } catch {
      alert('No se pudo acceder a la cámara para el QR. Ingrese el PIN manualmente.');
    }
  }

  function stopQrScan() {
    qrScanning = false;
    if (qrStream) {
      qrStream.getTracks().forEach(t => t.stop());
      qrStream = null;
    }
    $qrOverlay.classList.remove('active');
  }

  async function scanFrame() {
    if (!qrScanning) return;

    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    try {
      const barcodes = await detector.detect($qrVideo);
      if (barcodes.length > 0) {
        const pin = barcodes[0].rawValue.trim();
        stopQrScan();
        // Fill digits visually then submit
        digits = pin.split('').slice(0, MAX_DIGITS);
        renderDots();
        await submitPin(pin);
        return;
      }
    } catch { /* keep scanning */ }

    requestAnimationFrame(scanFrame);
  }

  return { init, showApp };
})();

document.addEventListener('DOMContentLoaded', PinUI.init);
