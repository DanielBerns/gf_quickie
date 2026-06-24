import uuid
import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g

from marshmallow import ValidationError
from werkzeug.utils import secure_filename

from api.schemas import SubmissionSchema, get_error_msg
from api.middleware import require_user_token
from api.dependencies import get_submission_repo, get_storage_adapter
from core.domain.models import Submission, SubmissionItem
from core.config import DEMO_BOUNDING_BOX

bp = Blueprint('submissions', __name__, url_prefix='/api/v1/submissions')

@bp.route('/', methods=['POST'])
@require_user_token
def create_submission():
    # 1. Determine Language for errors
    lang = request.accept_languages.best_match(['es', 'en'], default='es')

    repo = get_submission_repo()
    storage = get_storage_adapter()

    # 2. Extract Multipart Data
    raw_data = request.form.get('data')
    if not raw_data:
        return jsonify({"error": get_error_msg("invalid_json", lang)}), 400

    try:
        json_data = json.loads(raw_data)
        validated_data = SubmissionSchema().load(json_data)
    except (json.JSONDecodeError, ValidationError) as e:
        return jsonify({"error": get_error_msg("invalid_json", lang), "details": str(e)}), 400

    # 3. Geo-Fencing Check
    lat = validated_data['latitude']
    lon = validated_data['longitude']
    if not DEMO_BOUNDING_BOX.is_within(lat, lon):
        return jsonify({"error": get_error_msg("out_of_bounds", lang)}), 403

    # 4. Handle File Upload (if present)
    uploaded_file = request.files.get('file')
    file_path = None
    saved_filename = None  # We will store the isolated filename here

    if uploaded_file and uploaded_file.filename:
        saved_filename = secure_filename(f"{uuid.uuid4()}_{uploaded_file.filename}")
        file_path = storage.save_file(uploaded_file, saved_filename)

    # 5. Map to Domain Models
    submission_id = str(uuid.uuid4())
    items = []

    for item_data in validated_data['items']:
        payload = item_data['content_payload']
        # If this item expects an image, inject both the path and the isolated filename
        if item_data['item_type'] == 'image':
            if not file_path:
                return jsonify({"error": get_error_msg("missing_file", lang)}), 400

            # Inject the exact key sync_job.py is looking for
            payload = {
                "file_path": file_path,
                "filename": saved_filename
            }

        items.append(SubmissionItem(
            id=str(uuid.uuid4()),
            submission_id=submission_id,
            tag_id=item_data['tag_id'],
            item_type=item_data['item_type'],
            content_payload=payload
        ))

    # Construct the parent Submission object using the validated data and items list
    submission = Submission(
        id=submission_id,
        user_id=g.user_id,
        latitude=validated_data['latitude'],
        longitude=validated_data['longitude'],
        device_timestamp=validated_data['device_timestamp'],
        server_timestamp=datetime.now(timezone.utc), # Improved: Record exact reception time
        status="pending",
        items=items
    )
    # -----------------------

    # 6. Save via Port (Infrastructure Adapter)
    repo.save(submission)

    return jsonify({"message": "Submission successful", "id": submission_id}), 201
