import secrets
from pathlib import Path
import structlog
from flask import Blueprint, send_from_directory, request, jsonify
from core.config import STORAGE_DIR, ADMIN_API_KEY
from api.middleware import require_admin_key

logger = structlog.get_logger()
bp = Blueprint('admin', __name__, url_prefix='/api/v1/admin')


# ── Local JSON report repo (same as reports.py) ───────────────
class _JsonReportRepo:
    """Reads/deletes report JSON files from STORAGE_DIR/reports/."""

    def __init__(self):
        self.dir = Path(STORAGE_DIR) / "reports"
        self.dir.mkdir(parents=True, exist_ok=True)

    def get_all(self, limit: int = 500) -> list:
        files = sorted(self.dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        result = []
        for f in files[:limit]:
            try:
                import json
                with open(f, encoding="utf-8") as fp:
                    result.append(json.load(fp))
            except Exception as e:
                logger.error("failed_to_read_report", file=str(f), error=str(e))
        return result

    def get_by_id(self, report_id: str) -> dict | None:
        import json
        path = self.dir / f"{report_id}.json"
        if not path.exists():
            return None
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def delete(self, report_id: str):
        path = self.dir / f"{report_id}.json"
        if path.exists():
            path.unlink()

@bp.route('/submissions', methods=['GET'])
@require_admin_key
def get_recent_submissions():
    """Endpoint for the downloader to pull recent report data."""
    repo = _JsonReportRepo()
    data = repo.get_all(limit=500)
    logger.info("admin_data_pulled", record_count=len(data))
    return jsonify(data), 200


@bp.route('/submissions/file/<filename>', methods=['GET'])
@require_admin_key
def download_file(filename):
    """
    Securely serves a physical file from the storage directory.
    """
    # 1. Verify the file actually exists on the disk
    full_path = Path(STORAGE_DIR, filename)
    if not full_path.exists():  # Fixed typo: changed exist() to exists()
        return jsonify({"error": f"File '{filename}' not found on server."}), 404

    # 2. Serve the file securely
    return send_from_directory(
        directory=STORAGE_DIR,
        path=filename,
        as_attachment=True
    )


@bp.route('/submissions/<submission_id>', methods=['DELETE'])
@require_admin_key
def delete_submission(submission_id):
    """Deletes a report and its associated photo files."""
    repo = _JsonReportRepo()
    report = repo.get_by_id(submission_id)

    if not report:
        return jsonify({"error": "Report not found"}), 404

    # 1. Delete physical photo files
    for filename in report.get("photo_filenames", []):
        file_path = Path(STORAGE_DIR) / filename
        if file_path.exists():
            try:
                file_path.unlink()
                logger.info("photo_deleted", filename=filename)
            except Exception as e:
                logger.error("photo_delete_error", filename=filename, error=str(e))

    # 2. Delete the JSON report file
    repo.delete(submission_id)
    logger.info("report_deleted", id=submission_id)

    return jsonify({"message": "Report and associated files deleted"}), 200
