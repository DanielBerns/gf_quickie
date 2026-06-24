import os
from dataclasses import dataclass
from pathlib import Path

import yaml


def load_configuration(config_path: Path) -> dict:
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file missing at {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


# ---------------------------------------------------------------------------
# Instance directory
# Set QUICKIE_INSTANCE to the directory that contains server.yaml.
# Example:  export QUICKIE_INSTANCE=~/Info/quickie/devel
# ---------------------------------------------------------------------------
_instance_env = os.environ.get("QUICKIE_INSTANCE")
if not _instance_env:
    raise EnvironmentError(
        "QUICKIE_INSTANCE environment variable is not set. "
        "Point it to the directory that contains server.yaml."
    )

INSTANCE = Path(_instance_env).expanduser().resolve()
INSTANCE.mkdir(mode=0o700, parents=True, exist_ok=True)

config = load_configuration(INSTANCE / "server.yaml")


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------
@dataclass
class GeoBoundingBox:
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float

    def is_within(self, lat: float, lon: float) -> bool:
        return (self.min_lat <= lat <= self.max_lat) and (self.min_lon <= lon <= self.max_lon)


# Comodoro Rivadavia / Surrounding Area Rough Bounding Box
DEMO_BOUNDING_BOX = GeoBoundingBox(
    min_lat=-46.0, max_lat=-45.5,
    min_lon=-67.8, max_lon=-67.3
)


# ---------------------------------------------------------------------------
# Derived paths  (no overrides needed — all relative to INSTANCE)
# ---------------------------------------------------------------------------
STORAGE_DIR = INSTANCE / "Storage"
STORAGE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)

DATABASE_DIR = INSTANCE / "Database"
DATABASE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)

DATABASE = DATABASE_DIR / "database.db"
DATABASE_PATH = f"sqlite:///{DATABASE}"


# ---------------------------------------------------------------------------
# Secrets & auth  (set these in server.yaml)
# ---------------------------------------------------------------------------
# Admin API key for protected endpoints
ADMIN_API_KEY = config.get("ADMIN_API_KEY", "dev-secret-admin-key-12345ABCDEF")

# Interviewer PIN Authentication
# APP_PIN_HASH: SHA-256 hex digest of the interviewer's numeric PIN
# Generate with: python -c "import hashlib; print(hashlib.sha256(b'YOUR_PIN').hexdigest())"
APP_PIN_HASH = config.get("APP_PIN_HASH", "")

# JWT (issued after PIN login)
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "default-dev-secret-key-12345ABCDEF")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8  # Session expires after 8 hours of inactivity


# ---------------------------------------------------------------------------
# Events catalog
# ---------------------------------------------------------------------------
_default_events = Path(__file__).parent.parent.parent / "events_default.json"
EVENTS_FILE = Path(config.get("EVENTS_FILE", str(INSTANCE / "events.json")))
EVENTS_DEFAULT_FILE = _default_events
