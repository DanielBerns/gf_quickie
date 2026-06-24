from typing import TypedDict, Optional

class GoogleUserData(TypedDict):
    """
    Explicitly typed structure for the user information extracted
    from the Google OAuth 2.0 ID token.
    """
    google_id: str
    email: str
    name: str

class AuthResponse(TypedDict):
    """
    Standardized response from the authentication domain service.
    """
    token: Optional[str]
    error: Optional[str]
