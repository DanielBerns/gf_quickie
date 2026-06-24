/**
 * api.js — API Client
 *
 * Handles all server communication for Campo Ciudadano.
 * Submits reports as multipart/form-data to /api/v1/reports/.
 */

const ApiClient = {
  /**
   * Submit a report to the live server.
   * reportData: { client_id, device_timestamp, latitude, longitude,
   *               gps_accuracy, barrio, event_tags, notes,
   *               photo_blobs: [Blob, ...] }
   * Returns true on success, false on network/server error.
   * Throws on hard rejection (403 out-of-bounds).
   */
  async submitReport(reportData, token) {
    const form = new FormData();

    // JSON payload (everything except binary files)
    const jsonPayload = {
      client_id:        reportData.client_id,
      device_timestamp: reportData.device_timestamp,
      latitude:         reportData.latitude  || 0,
      longitude:        reportData.longitude || 0,
      gps_accuracy:     reportData.gps_accuracy || null,
      barrio:           reportData.barrio || null,
      event_tags:       reportData.event_tags || [],
      notes:            reportData.notes || '',
    };
    form.append('data', JSON.stringify(jsonPayload));

    // Attach photo blobs
    const blobs = reportData.photo_blobs || [];
    blobs.forEach((blob, i) => {
      form.append(`photo_${i}`, blob, `photo_${i}.jpg`);
    });

    let res;
    try {
      res = await fetch('/api/v1/reports/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
    } catch {
      return false; // network failure
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`403: ${data.error || 'Forbidden'}`);
    }

    return res.ok;
  },
};