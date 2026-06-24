import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
packages_dir = current_dir.parent

if str(packages_dir) not in sys.path:
    sys.path.insert(0, str(packages_dir))

print(sys.path)

from api.app import create_app

app = create_app()
