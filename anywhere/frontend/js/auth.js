/**
 * auth.js — PIN Authentication Manager
 *
 * Handles JWT storage, expiry checks, and PIN verification via the API.
 * No Google OAuth dependency.
 */

const PinAuthManager = (() => {
  const TOKEN_KEY = 'campo_jwt';
  const EXPIRY_KEY = 'campo_jwt_exp';

  /** Submit PIN to the server; returns true if successful. */
  async function unlock(pin) {
    const res = await fetch('/api/v1/auth/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: String(pin) }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (!data.token) return false;

    // Store token + expiry
    localStorage.setItem(TOKEN_KEY, data.token);
    // Expiry = now + expires_in_hours (in ms)
    const expiresMs = Date.now() + (data.expires_in_hours || 8) * 60 * 60 * 1000;
    localStorage.setItem(EXPIRY_KEY, String(expiresMs));

    return true;
  }

  /** Returns the stored JWT if still valid, otherwise null. */
  function getToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    const exp   = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
    if (!token || Date.now() > exp) {
      lock();
      return null;
    }
    return token;
  }

  /** Returns true if a valid session exists. */
  function isUnlocked() {
    return getToken() !== null;
  }

  /** Clears the session (forces re-auth on next load). */
  function lock() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }

  return { unlock, getToken, isUnlocked, lock };
})();