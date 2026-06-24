import os
from pathlib import Path
from flask import Flask, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix
import structlog

from api.routes import submissions, auth, admin, events, reports

logger = structlog.get_logger()

def create_app():
    # 1. Dynamically locate the frontend directory
    # __file__ is packages/api/src/api/app.py
    # .parents[3] navigates up to the 'packages' directory
    current_dir = Path(__file__).resolve().parent
    frontend_dir = current_dir.parents[3] / "frontend"

    # 2. Tell Flask where the static files are, and set the URL path to root ('/')
    app = Flask(__name__, static_folder=str(frontend_dir), static_url_path='/')

    # Apply ProxyFix so Flask trusts the X-Forwarded-Proto header from PythonAnywhere's load balancer
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # Configure session secret key
    app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'default-dev-secret-key-12345ABCDEF')

    # Register Blueprints
    app.register_blueprint(reports.bp)      # NEW: campo-ciudadano reports
    app.register_blueprint(events.bp)       # NEW: configurable events catalog
    app.register_blueprint(auth.bp)         # Updated: PIN auth (no Google OAuth)
    app.register_blueprint(submissions.bp)  # Legacy: kept for downloader compat
    app.register_blueprint(admin.bp)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {"status": "healthy", "version": "2.0.0"}

    # 3. Serve the Progressive Web App UI
    @app.route('/')
    def serve_ui():
        if not frontend_dir.exists():
            return {"error": f"Frontend directory not found at {frontend_dir}"}, 404
        return send_from_directory(app.static_folder, 'index.html')

    logger.info("flask_app_initialized", frontend_path=str(frontend_dir), version="2.0.0")
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
