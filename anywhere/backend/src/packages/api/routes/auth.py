import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request, current_app
import jwt
import structlog

from core.config import APP_PIN_HASH, JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_HOURS
from api.schemas import get_error_msg
from api.middleware import require_admin_key

logger = structlog.get_logger()

bp = Blueprint('auth_v1', __name__, url_prefix='/api/v1/auth')


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


@bp.route('/pin/verify', methods=['POST'])
def verify_pin():
    """
    Validates the interviewer's numeric PIN.
    Body: { "pin": "123456" }
    Returns a short-lived JWT on success.
    """
    lang = request.accept_languages.best_match(['es', 'en'], default='es')

    if not APP_PIN_HASH:
        logger.error("pin_not_configured")
        return jsonify({"error": get_error_msg("pin_not_configured", lang)}), 500

    data = request.get_json(silent=True) or {}
    submitted_pin = str(data.get("pin", ""))

    submitted_hash = _sha256(submitted_pin)

    if not secrets.compare_digest(submitted_hash, APP_PIN_HASH):
        logger.warning("pin_verify_failed")
        return jsonify({"error": get_error_msg("invalid_pin", lang)}), 401

    # Issue a JWT valid for JWT_EXPIRY_HOURS
    payload = {
        "sub": "interviewer",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    logger.info("pin_verified_ok")
    return jsonify({"token": token, "expires_in_hours": JWT_EXPIRY_HOURS}), 200


@bp.route('/pin/qr')
@require_admin_key
def get_pin_qr():
    """
    Admin-only: returns a QR code PNG encoding the current PIN in plaintext.
    The PIN is read from an env var / config so it is never stored in code.
    Requires the admin to know the plaintext PIN (passed as query param 'pin').

    Usage: GET /api/v1/auth/pin/qr?pin=123456
           Authorization: Bearer <ADMIN_API_KEY>
    """
    try:
        import qrcode
        import io
        from flask import send_file
    except ImportError:
        return jsonify({"error": "qrcode library not installed on server"}), 500

    pin = request.args.get("pin", "")
    if not pin:
        return jsonify({"error": "Query param 'pin' is required"}), 400

    # Validate that the submitted PIN actually matches the configured hash
    if not secrets.compare_digest(_sha256(pin), APP_PIN_HASH):
        return jsonify({"error": "PIN does not match configured APP_PIN_HASH"}), 403

    img = qrcode.make(pin)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png", download_name="pin_qr.png")
