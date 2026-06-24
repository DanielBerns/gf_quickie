/**
 * db.js — Offline Storage (Dexie/IndexedDB) + Sync Manager
 *
 * Stores pending reports locally when offline.
 * SyncManager handles upload queue when connectivity is restored.
 */

// ── Database ──────────────────────────────────────────────────
const db = new Dexie('CampoCiudadanoDB');

db.version(1).stores({
  reports: '++id, client_id, device_timestamp, sync_status'
});

// ── Storage Adapter ───────────────────────────────────────────
const StorageAdapter = {
  async saveLocally(reportData) {
    try {
      const record = {
        ...reportData,
        sync_status:      'pending',
        device_timestamp: reportData.device_timestamp || new Date().toISOString(),
        local_saved_at:   new Date().toISOString(),
      };
      await db.reports.add(record);
      console.log('[StorageAdapter] Reporte guardado localmente.');
      await this.broadcastCount();
    } catch (err) {
      console.error('[StorageAdapter] Error al guardar localmente:', err);
    }
  },

  async getPending() {
    return await db.reports.where('sync_status').equals('pending').toArray();
  },

  async markSynced(id) {
    await db.reports.delete(id);
    await this.broadcastCount();
  },

  async getPendingCount() {
    return await db.reports.where('sync_status').equals('pending').count();
  },

  async broadcastCount() {
    const count = await this.getPendingCount();
    window.dispatchEvent(new CustomEvent('pending-reports-changed', { detail: { count } }));
  },

  async clear() {
    await db.reports.clear();
    await this.broadcastCount();
  }
};

// ── Sync Manager ──────────────────────────────────────────────
const SyncManager = {
  _syncing: false,

  async syncPendingReports() {
    if (this._syncing || !navigator.onLine) return;

    const token = PinAuthManager.getToken();
    if (!token) return;

    const pending = await StorageAdapter.getPending();
    if (pending.length === 0) return;

    this._syncing = true;
    console.log(`[SyncManager] Sincronizando ${pending.length} reporte(s)…`);

    for (const report of pending) {
      try {
        const ok = await ApiClient.submitReport(report, token);
        if (ok) {
          await StorageAdapter.markSynced(report.id);
          console.log(`[SyncManager] Reporte ID ${report.id} sincronizado.`);
        } else {
          break; // network issue — retry later
        }
      } catch (err) {
        if (err.message && err.message.includes('403')) {
          // Out-of-bounds: discard to avoid infinite loop
          await StorageAdapter.markSynced(report.id);
          console.warn('[SyncManager] Reporte fuera de límites, descartado.');
        } else {
          console.error('[SyncManager] Error de red:', err);
          break;
        }
      }
    }

    this._syncing = false;
  }
};

// ── Auto-sync on reconnect ─────────────────────────────────────
window.addEventListener('online', () => SyncManager.syncPendingReports());