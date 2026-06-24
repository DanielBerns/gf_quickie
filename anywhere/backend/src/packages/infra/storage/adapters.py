import os
import shutil
import structlog
from core.config import STORAGE_DIR

logger = structlog.get_logger()

class LocalDiskStorageAdapter:
    def __init__(self):
        self.base_dir = STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)
        logger.info("storage_initialized", directory=self.base_dir)

    def save_file(self, file_stream, filename: str) -> str:
        """Saves a file to disk and returns the relative path for the JSON payload."""
        file_path = os.path.join(self.base_dir, filename)

        with open(file_path, 'wb') as f:
            shutil.copyfileobj(file_stream, f)

        logger.info("file_saved", file_path=file_path)
        return file_path
