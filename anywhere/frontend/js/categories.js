/**
 * categories.js — Event Catalog Manager
 *
 * Loads the event taxonomy from the API (/api/v1/events/).
 * Caches the result in localStorage with a 24-hour TTL.
 * Renders accordion groups with selectable event chips.
 */

const EventCatalog = (() => {
  const CACHE_KEY     = 'campo_events_cache';
  const CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours
  let   _catalog      = null;  // { grupos: [...] }
  let   _selected     = new Set(); // set of event IDs

  // ── Load ─────────────────────────────────────────────────────

  async function load() {
    // 1. Try cache
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) {
          _catalog = data;
          return data;
        }
      }
    } catch { /* ignore cache errors */ }

    // 2. Fetch from server
    try {
      const res = await fetch('/api/v1/events/');
      if (res.ok) {
        const data = await res.json();
        _catalog = data;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        return data;
      }
    } catch { /* offline — fall through to empty */ }

    _catalog = { grupos: [] };
    return _catalog;
  }

  function getGroups() {
    return _catalog ? _catalog.grupos : [];
  }

  // ── Selection ─────────────────────────────────────────────────

  function toggle(eventId) {
    if (_selected.has(eventId)) {
      _selected.delete(eventId);
    } else {
      _selected.add(eventId);
    }
    _renderSelectedRow();
    _syncChipStates();
    _updateSectionStatus();
  }

  function getSelected() {
    return [..._selected];
  }

  function clearSelection() {
    _selected.clear();
    _renderSelectedRow();
    _syncChipStates();
    _updateSectionStatus();
  }

  // ── Rendering ─────────────────────────────────────────────────

  function renderGroups(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!_catalog || _catalog.grupos.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim);font-size:0.9rem;">Sin temas disponibles.</p>';
      return;
    }

    _catalog.grupos.forEach(group => {
      const groupEl = _buildGroupElement(group);
      container.appendChild(groupEl);
    });
  }

  function _buildGroupElement(group) {
    const div = document.createElement('div');
    div.className = 'event-group';
    div.dataset.groupId = group.id;

    const selectedInGroup = group.eventos.filter(e => _selected.has(e.id)).length;

    div.innerHTML = `
      <div class="event-group-header" role="button" aria-expanded="false" tabindex="0"
           aria-label="${group.nombre}">
        <span class="event-group-icon" aria-hidden="true">${group.icono}</span>
        <span class="event-group-name">${group.nombre}</span>
        <span class="event-group-count${selectedInGroup > 0 ? ' has-selected' : ''}"
              data-count-for="${group.id}">
          ${selectedInGroup > 0 ? selectedInGroup + ' ✓' : group.eventos.length}
        </span>
        <span class="event-group-arrow" aria-hidden="true">›</span>
      </div>
      <div class="event-items" role="group" aria-label="Eventos de ${group.nombre}">
        ${group.eventos.map(e => `
          <button class="event-chip ${_selected.has(e.id) ? 'selected-' + group.id : ''}"
                  data-event-id="${e.id}"
                  data-group-id="${group.id}"
                  aria-pressed="${_selected.has(e.id)}"
                  aria-label="${e.nombre}">
            ${e.nombre}
          </button>
        `).join('')}
      </div>
    `;

    // Toggle open/close
    const header = div.querySelector('.event-group-header');
    header.addEventListener('click', () => {
      div.classList.toggle('open');
      header.setAttribute('aria-expanded', div.classList.contains('open'));
    });
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });

    // Event chip clicks
    div.querySelectorAll('.event-chip').forEach(chip => {
      chip.addEventListener('click', () => toggle(chip.dataset.eventId));
    });

    return div;
  }

  function _renderSelectedRow() {
    const row = document.getElementById('selected-tags-row');
    if (!row) return;
    row.innerHTML = '';

    if (_selected.size === 0) return;

    _selected.forEach(id => {
      const info = _findEvent(id);
      if (!info) return;
      const chip = document.createElement('button');
      chip.className = `chip chip-${info.groupId}`;
      chip.setAttribute('aria-label', `Quitar: ${info.nombre}`);
      chip.innerHTML = `${info.nombre} <span class="chip-remove" aria-hidden="true">✕</span>`;
      chip.addEventListener('click', () => toggle(id));
      row.appendChild(chip);
    });
  }

  function _syncChipStates() {
    // Update all event chips' selected class and aria-pressed
    document.querySelectorAll('.event-chip').forEach(chip => {
      const id      = chip.dataset.eventId;
      const groupId = chip.dataset.groupId;
      const sel     = _selected.has(id);
      chip.className = `event-chip ${sel ? 'selected-' + groupId : ''}`;
      chip.setAttribute('aria-pressed', sel);
    });

    // Update group counters
    if (!_catalog) return;
    _catalog.grupos.forEach(group => {
      const count = group.eventos.filter(e => _selected.has(e.id)).length;
      const badge = document.querySelector(`[data-count-for="${group.id}"]`);
      if (badge) {
        badge.textContent = count > 0 ? `${count} ✓` : group.eventos.length;
        badge.classList.toggle('has-selected', count > 0);
      }
    });
  }

  function _updateSectionStatus() {
    const el = document.getElementById('tags-status');
    if (!el) return;
    const n = _selected.size;
    el.textContent = n > 0 ? `${n} seleccionado${n > 1 ? 's' : ''}` : 'Ninguno';
    el.className = `section-status${n > 0 ? ' done' : ''}`;

    const section = document.getElementById('section-tags');
    if (section) section.classList.toggle('has-data', n > 0);
  }

  function _findEvent(id) {
    if (!_catalog) return null;
    for (const g of _catalog.grupos) {
      const ev = g.eventos.find(e => e.id === id);
      if (ev) return { ...ev, groupId: g.id };
    }
    return null;
  }

  return { load, getGroups, renderGroups, toggle, getSelected, clearSelection };
})();
