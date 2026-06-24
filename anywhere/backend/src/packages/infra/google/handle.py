import os
import jwt
import datetime
from sqlalchemy.orm import Session
from infra.google.schema import GoogleUserData, AuthResponse
from infra.database.schema import UserModel
from infra.database.engine import SessionLocal  # Adjust path to your session factory

def handle_google_login(google_data: GoogleUserData) -> AuthResponse:
    """
    Handles the core business logic of authenticating a federated user.
    Takes an explicitly typed dictionary of Google user data and returns an AuthResponse.
    """
    with SessionLocal() as session:
        # 1. Lookup user by google_id or email
        user = session.query(UserModel).filter(
            (UserModel.google_id == google_data["google_id"]) |
            (UserModel.email == google_data["email"])
        ).first()

        if user:
            # 2. Enforce the deactivated user policy
            if not user.is_active:
                return {"token": None, "error": "Account is inactive and cannot be accessed."}

            # If they existed previously by email but didn't have a google_id linked, link it now.
            if not user.google_id:
                user.google_id = google_data["google_id"]
                session.commit()
        else:
            # 3. Create a new user if they don't exist
            user = UserModel(
                google_id=google_data["google_id"],
                email=google_data["email"],
                name=google_data["name"],
                is_active=True
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        # 4. Generate the local PyJWT for the PWA buffer authentication
        from core.config import JWT_SECRET_KEY
        secret_key = JWT_SECRET_KEY
        if not secret_key:
            raise ValueError("JWT_SECRET_KEY environment variable is missing.")

        # Set token expiration to 7 days for field longevity before forcing a re-auth
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": str(user.id),
            "exp": now + datetime.timedelta(days=7),
            "iat": now
        }

        token = jwt.encode(payload, secret_key, algorithm="HS256")

        return {"token": token, "error": None}
