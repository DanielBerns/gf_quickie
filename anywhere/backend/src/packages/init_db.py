import sys
import structlog
from sqlalchemy.exc import SQLAlchemyError

# Import the infrastructure components
from infra.database.engine import engine
from infra.database.schema import Base

logger = structlog.get_logger()

def bootstrap_database() -> None:
    """
    Initializes the database schema by creating all defined tables.
    If the tables already exist, SQLAlchemy safely ignores them.
    """
    logger.info("Initializing database schema...")

    try:
        # 1. Create all tables defined in the schema
        Base.metadata.create_all(engine)
        logger.info("Database tables verified/created successfully.")

        # 2. Output the credentials information for the developer
        print("\n" + "=" * 70)
        print("DATABASE INITIALIZED SUCCESSFULLY")
        print("=" * 70)
        print("No database admin user required for sync_job.py.")
        print("Please ensure your ADMIN_API_KEY is configured in your server.yaml")
        print("=" * 70 + "\n")

    except SQLAlchemyError as e:
        # Catch specific database/ORM errors for targeted debugging
        logger.error(
            "database_bootstrap_failed", 
            error=str(e), 
            exc_info=True  # Includes the full stack trace in the structured log
        )
        sys.exit(1)  # Ensure the script exits with an error code
        
    except Exception as e:
        # Fallback for unexpected system errors (e.g., memory issues, import failures)
        logger.exception("unexpected_error_during_bootstrap", error=str(e))
        sys.exit(1)

if __name__ == "__main__":
    bootstrap_database()