/**
 * app.js — Campo Ciudadano Main Application
 *
 * Orchestrates the report card: location, tags, photos, notes, and submit.
 * Initialized after the PIN gate is passed (listens for 'app-unlocked' event).
 */

// ── Toast helper ──────────────────────────────────────────────
function showToast(msg, type = 'info', durationMs = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, durationMs);
}

// ── Pending badge ─────────────────────────────────────────────
function updatePendingBadge(count) {
  const badge    = document.getElementById('pending-badge');
  const countEl  = document.getElementById('pending-count');
  const pluralEl = document.getElementById('pending-plural');
  const syncBar  = document.getElementById('sync-bar');
  const syncCnt  = document.getElementById('sync-count');

  if (!badge) return;

  if (count > 0) {
    badge.classList.add('visible');
    countEl.textContent  = count;
    pluralEl.textContent = count > 1 ? 's' : '';
    if (syncBar)  syncBar.classList.add('visible');
    if (syncCnt)  syncCnt.textContent = count;
  } else {
    badge.classList.remove('visible');
    if (syncBar) syncBar.classList.remove('visible');
  }
}

// ── App Init ─────────────────────────────────────────────────
async function initApp() {
  // Start GPS immediately
  GeolocationService.refresh();

  // Bind location refresh button
  const refreshBtn = document.getElementById('refresh-location-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      await GeolocationService.refresh();
      refreshBtn.disabled = false;
    });
  }

  // Bind barrio select change
  const barrioSelect = document.getElementById('barrio-select');
  if (barrioSelect) {
    barrioSelect.addEventListener('change', () => {
      const section = document.getElementById('section-location');
      if (section) {
        const hasBoth = barrioSelect.value && document.getElementById('latitude').value;
        section.classList.toggle('has-data', !!document.getElementById('latitude').value);
      }
    });
  }

  // Load event catalog and render groups
  await EventCatalog.load();
  EventCatalog.renderGroups('event-groups-container');

  // Init camera
  CameraManager.init();

  // Notes change handler
  const notesInput = document.getElementById('notes-input');
  if (notesInput) {
    notesInput.addEventListener('input', () => {
      const status  = document.getElementById('notes-status');
      const section = document.getElementById('section-notes');
      const hasText = notesInput.value.trim().length > 0;
      if (status)  { status.textContent = hasText ? '✓ Hay notas' : ''; status.className = `section-status${hasText ? ' done' : ''}`; }
      if (section) section.classList.toggle('has-data', hasText);
    });
  }

  // Force sync button
  const forceSyncBtn = document.getElementById('force-sync-btn');
  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', () => SyncManager.syncPendingReports());
  }

  // Pending count listener
  window.addEventListener('pending-reports-changed', e => {
    updatePendingBadge(e.detail.count);
  });

  // Broadcast initial count
  StorageAdapter.broadcastCount();

  // Sync if online
  if (navigator.onLine) SyncManager.syncPendingReports();

  // Submit button
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
}

// ── Submit Handler ────────────────────────────────────────────
async function handleSubmit() {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Enviando…'; }

  try {
    const lat = parseFloat(document.getElementById('latitude').value) || null;
    const lon = parseFloat(document.getElementById('longitude').value) || null;
    const acc = parseFloat(document.getElementById('gps-accuracy').value) || null;

    // If no GPS yet, try once more
    let finalLat = lat, finalLon = lon, finalAcc = acc;
    if (!lat || !lon) {
      try {
        const coords = await GeolocationService.getCoordinates();
        finalLat = coords.latitude;
        finalLon = coords.longitude;
        finalAcc = coords.accuracy;
      } catch { /* no GPS — submit with 0,0, server geo-fence will catch */ }
    }

    const reportData = {
      client_id:        crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      device_timestamp: new Date().toISOString(),
      latitude:         finalLat ?? 0,
      longitude:        finalLon ?? 0,
      gps_accuracy:     finalAcc,
      barrio:           document.getElementById('barrio-select')?.value || null,
      event_tags:       EventCatalog.getSelected(),
      notes:            document.getElementById('notes-input')?.value?.trim() || '',
      photo_blobs:      CameraManager.getPhotoBlobs(),
    };

    const token = PinAuthManager.getToken();

    if (navigator.onLine && token) {
      const ok = await ApiClient.submitReport(reportData, token);
      if (ok) {
        showToast('✅ Reporte enviado con éxito', 'success');
        resetForm();
      } else {
        // Fallback to offline queue
        const offlineData = { ...reportData, photo_blobs: [] }; // blobs can't be stored in Dexie easily
        await StorageAdapter.saveLocally(offlineData);
        showToast('📡 Sin conexión. Reporte guardado localmente.', 'info');
        resetForm();
      }
    } else {
      // Offline: store locally (without blobs for simplicity)
      const offlineData = { ...reportData, photo_blobs: [] };
      await StorageAdapter.saveLocally(offlineData);
      showToast('📡 Sin conexión. Reporte guardado localmente.', 'info');
      resetForm();
    }
  } catch (err) {
    console.error('[app.js] Error al enviar:', err);
    if (err.message && err.message.includes('403')) {
      showToast('⚠️ Ubicación fuera del área permitida.', 'error', 5000);
    } else {
      showToast('❌ Error al enviar. Intente nuevamente.', 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '✅ Enviar reporte';
    }
  }
}

// ── Form Reset ────────────────────────────────────────────────
function resetForm() {
  // Clear tags
  EventCatalog.clearSelection();

  // Clear photos
  CameraManager.clear();

  // Clear notes
  const notesInput = document.getElementById('notes-input');
  if (notesInput) { notesInput.value = ''; notesInput.dispatchEvent(new Event('input')); }

  // Clear barrio (keep GPS — user is likely in same location)
  const barrioSelect = document.getElementById('barrio-select');
  if (barrioSelect) barrioSelect.value = '';

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Entry Point ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated (within 8h window)
  if (PinAuthManager.isUnlocked()) {
    document.getElementById('pin-gate').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    initApp();
  }
  // Otherwise, PinUI handles the gate; we listen for 'app-unlocked'
});

window.addEventListener('app-unlocked', initApp);
