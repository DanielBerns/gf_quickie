/**
 * geolocation.js — GPS Location Service
 *
 * Provides high-accuracy GPS coordinates with accuracy reporting.
 * Manages the location display UI.
 */

const GeolocationService = (() => {
  let _lat = null;
  let _lon = null;
  let _accuracy = null;
  let _watching = false;
  let _watchId  = null;

  function _updateDisplay(state, text) {
    const el = document.getElementById('location-display');
    if (!el) return;
    el.className = `location-display ${state}`;
    el.innerHTML = `<span class="location-icon" aria-hidden="true">${state === 'gps-ok' ? '✓' : state === 'gps-error' ? '✗' : '📡'}</span>${text}`;

    const status = document.getElementById('location-status');
    if (status) {
      status.textContent = state === 'gps-ok' ? '✓ Obtenida' : state === 'gps-error' ? 'Error' : '…';
      status.className = `section-status${state === 'gps-ok' ? ' done' : ''}`;
    }

    const section = document.getElementById('section-location');
    if (section) section.classList.toggle('has-data', state === 'gps-ok');
  }

  function _setHiddenInputs(lat, lon, acc) {
    const latEl = document.getElementById('latitude');
    const lonEl = document.getElementById('longitude');
    const accEl = document.getElementById('gps-accuracy');
    if (latEl) latEl.value = lat;
    if (lonEl) lonEl.value = lon;
    if (accEl) accEl.value = acc ?? '';
  }

  async function getCoordinates() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS no disponible en este dispositivo.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          _lat = pos.coords.latitude;
          _lon = pos.coords.longitude;
          _accuracy = pos.coords.accuracy;
          resolve({ latitude: _lat, longitude: _lon, accuracy: _accuracy });
        },
        err => {
          const msgs = {
            1: 'Permiso de ubicación denegado.',
            2: 'Posición no disponible.',
            3: 'Tiempo de espera agotado.',
          };
          reject(new Error(msgs[err.code] || 'Error de GPS.'));
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }

  async function refresh() {
    _updateDisplay('gps-loading', 'Obteniendo GPS…');
    try {
      const { latitude, longitude, accuracy } = await getCoordinates();
      const accText = accuracy ? ` ±${Math.round(accuracy)}m` : '';
      _updateDisplay('gps-ok', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accText}`);
      _setHiddenInputs(latitude, longitude, accuracy);
    } catch (err) {
      _updateDisplay('gps-error', err.message);
    }
  }

  function getCurrent() {
    return { lat: _lat, lon: _lon, accuracy: _accuracy };
  }

  return { getCoordinates, refresh, getCurrent };
})();