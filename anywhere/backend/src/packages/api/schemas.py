from marshmallow import Schema, fields, validate, ValidationError

# Simple i18n dictionary for API errors
ERRORS = {
    "en": {
        "out_of_bounds": "Submission is outside the allowed geographic region.",
        "missing_file": "Image file is required for this submission.",
        "invalid_json": "Invalid JSON payload structure.",
        "invalid_pin": "Invalid PIN. Access denied.",
        "pin_not_configured": "Server PIN is not configured.",
    },
    "es": {
        "out_of_bounds": "El reporte se encuentra fuera de la región geográfica permitida.",
        "missing_file": "El archivo de imagen es obligatorio para este reporte.",
        "invalid_json": "Estructura de payload JSON inválida.",
        "invalid_pin": "PIN incorrecto. Acceso denegado.",
        "pin_not_configured": "El PIN del servidor no está configurado.",
    }
}

def get_error_msg(key: str, lang: str) -> str:
    # Default to Spanish if language not recognized
    safe_lang = lang if lang in ERRORS else "es"
    return ERRORS[safe_lang].get(key, "Unknown error")


# ---------------------------------------------------------------------------
# New schema for campo-ciudadano reports
# ---------------------------------------------------------------------------

class ReportSchema(Schema):
    """Validates the JSON payload sent as the 'data' field in a multipart report."""
    client_id        = fields.String(required=True)
    device_timestamp = fields.DateTime(required=True)
    latitude         = fields.Float(required=True)
    longitude        = fields.Float(required=True)
    gps_accuracy     = fields.Float(load_default=None)
    barrio           = fields.String(load_default=None, allow_none=True)
    event_tags       = fields.List(fields.String(), load_default=[])
    notes            = fields.String(load_default="")


# ---------------------------------------------------------------------------
# Legacy schemas — kept for backward compat with downloader / sync_job
# ---------------------------------------------------------------------------

class SubmissionItemSchema(Schema):
    tag_id = fields.String(required=True)
    item_type = fields.String(required=True, validate=validate.OneOf(["image", "text", "price_data"]))
    content_payload = fields.Dict(required=True)

class SubmissionSchema(Schema):
    latitude = fields.Float(required=True)
    longitude = fields.Float(required=True)
    device_timestamp = fields.DateTime(required=True)
    items = fields.List(fields.Nested(SubmissionItemSchema), required=True)
