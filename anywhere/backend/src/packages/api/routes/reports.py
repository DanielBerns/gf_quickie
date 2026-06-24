import uuid
import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from werkzeug.utils import secure_filename
import structlog

from api.schemas import ReportSchema, get_error_msg
from api.middleware import require_pin_token
from api.dependencies import get_storage_adapter
from core.domain.models import Report
from core.config import DEMO_BOUNDING_BOX, STORAGE_DIR
from pathlib import Path

logger = structlog.get_logger()

bp = Blueprint('reports', __name__, url_prefix='/api/v1/reports')

# Maximum photos allowed per report
MAX_PHOTOS = 5


def _get_report_repo():
    """
    Lazy import to avoid circular deps.
    Returns a simple SQLite-backed repo for Report objects.
    We reuse the same infra layer but with the new Report model.
    """
    # Import the existing repo and use it as a thin dict store via raw SQL
    # For now, persist reports as JSON files in STORAGE_DIR/reports/
    # Full DB migration can come later.
    return _JsonReportRepo()


class _JsonReportRepo:
    """Minimal file-based repo: each report is a JSON file in STORAGE_DIR/reports/."""

    def __init__(self):
        self.dir = Path(STORAGE_DIR) / "reports"
        self.dir.mkdir(parents=True, exist_ok=True)

    def save(self, report: Report):
        data = {
            "id": report.id,
            "client_id": report.client_id,
            "latitude": report.latitude,
            "longitude": report.longitude,
            "gps_accuracy": report.gps_accuracy,
            "barrio": report.barrio,
            "event_tags": report.event_tags,
            "notes": report.notes,
            "device_timestamp": report.device_timestamp.isoformat(),
            "server_timestamp": report.server_timestamp.isoformat(),
            "photo_filenames": report.photo_filenames,
            "status": report.status,
        }
        path = self.dir / f"{report.id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_all(self, limit: int = 500) -> list:
        files = sorted(self.dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        result = []
        for f in files[:limit]:
            with open(f, encoding="utf-8") as fp:
                result.append(json.load(fp))
        return result

    def get_by_id(self, report_id: str) -> dict | None:
        path = self.dir / f"{report_id}.json"
        if not path.exists():
            return None
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def delete(self, report_id: str):
        path = self.dir / f"{report_id}.json"
        if path.exists():
            path.unlink()


@bp.route('/', methods=['POST'])
@require_pin_token
def create_report():
    """
    Create a new field report.
    Expects multipart/form-data:
      - data: JSON string (validated by ReportSchema)
      - photo_0, photo_1, ... photo_N: image files (optional, max 5)
    """
    lang = request.accept_languages.best_match(['es', 'en'], default='es')
    storage = get_storage_adapter()
    repo = _get_report_repo()

    # 1. Parse + validate JSON payload
    raw_data = request.form.get('data')
    if not raw_data:
        return jsonify({"error": get_error_msg("invalid_json", lang)}), 400

    try:
        json_data = json.loads(raw_data)
        validated = ReportSchema().load(json_data)
    except (json.JSONDecodeError, ValidationError) as e:
        return jsonify({"error": get_error_msg("invalid_json", lang), "details": str(e)}), 400

    # 2. Geo-fence check
    lat, lon = validated['latitude'], validated['longitude']
    if not DEMO_BOUNDING_BOX.is_within(lat, lon):
        error_msg = get_error_msg("out_of_bounds", lang)
        # Append the coordinates to help debugging
        error_msg += f" (Recibido: lat={lat}, lon={lon})"
        return jsonify({"error": error_msg}), 403

    # 3. Handle photo uploads (photo_0 … photo_N)
    photo_filenames = []
    for i in range(MAX_PHOTOS):
        file = request.files.get(f'photo_{i}')
        if file and file.filename:
            safe_name = secure_filename(f"{uuid.uuid4()}_{file.filename}")
            storage.save_file(file, safe_name)
            photo_filenames.append(safe_name)

    # 4. Build domain object
    server_id = str(uuid.uuid4())
    report = Report(
        id=server_id,
        client_id=validated['client_id'],
        latitude=lat,
        longitude=lon,
        gps_accuracy=validated.get('gps_accuracy'),
        barrio=validated.get('barrio'),
        event_tags=validated.get('event_tags', []),
        notes=validated.get('notes', ''),
        device_timestamp=validated['device_timestamp'],
        server_timestamp=datetime.now(timezone.utc),
        photo_filenames=photo_filenames,
        status="received",
    )

    # 5. Persist
    repo.save(report)
    logger.info("report_created", id=server_id, tags=report.event_tags, photos=len(photo_filenames))

    return jsonify({"message": "Reporte recibido", "id": server_id, "client_id": report.client_id}), 201


@bp.route('/', methods=['GET'])
@require_pin_token
def list_reports():
    """Returns recent reports (used by dashboard sync). Requires PIN token."""
    repo = _get_report_repo()
    return jsonify(repo.get_all(limit=500)), 200
