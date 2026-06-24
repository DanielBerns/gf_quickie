import json
import shutil
import structlog
from flask import Blueprint, jsonify, request

from core.config import EVENTS_FILE, EVENTS_DEFAULT_FILE
from api.middleware import require_admin_key

logger = structlog.get_logger()

bp = Blueprint('events_v1', __name__, url_prefix='/api/v1/events')


def _load_events() -> dict:
    """Load events from the instance file, falling back to bundled default."""
    target = EVENTS_FILE if EVENTS_FILE.exists() else EVENTS_DEFAULT_FILE
    if not target.exists():
        return {"grupos": []}
    with open(target, encoding="utf-8") as f:
        return json.load(f)


@bp.route('/', methods=['GET'])
def get_events():
    """Public: returns the current events catalog (no auth required)."""
    data = _load_events()
    return jsonify(data), 200


@bp.route('/', methods=['PUT'])
@require_admin_key
def update_events():
    """
    Admin-only: replace the events catalog.
    Body: full events JSON (same structure as events_default.json).
    """
    data = request.get_json(silent=True)
    if not data or "grupos" not in data:
        return jsonify({"error": "Invalid events JSON. Must contain 'grupos' key."}), 400

    # Ensure the instance directory exists
    EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(EVENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info("events_catalog_updated", grupos=len(data["grupos"]))
    return jsonify({"message": "Events catalog updated", "grupos": len(data["grupos"])}), 200


@bp.route('/reset', methods=['POST'])
@require_admin_key
def reset_events():
    """Admin-only: reset events catalog to the bundled default."""
    if EVENTS_FILE.exists():
        EVENTS_FILE.unlink()
    logger.info("events_catalog_reset_to_default")
    return jsonify({"message": "Events catalog reset to default"}), 200
