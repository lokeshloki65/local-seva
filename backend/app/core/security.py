from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import logging
from app.core.firebase import db

logger = logging.getLogger("servalocal.security")
security_bearer = HTTPBearer()

def verify_firebase_token(token: str) -> dict:
    """Verifies Firebase ID token sent from the frontend."""
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_418_IM_A_TEAPOT if "expired" in str(e).lower() else status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication credentials: {e}"
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Dependency that extracts the current authenticated user and their profile from Firestore."""
    token = credentials.credentials
    decoded = verify_firebase_token(token)
    uid = decoded.get("uid")
    email = decoded.get("email")
    
    # Query Firestore user record to get role and features
    user_ref = db.collection("users").document(uid).get()
    if not user_ref.exists:
        # Create a lazy/basic profile if not already seeded or registered
        user_data = {
            "uid": uid,
            "email": email,
            "name": decoded.get("name", "User"),
            "photoURL": decoded.get("picture", ""),
            "role": "customer", # default fallback
            "walletBalance": 0.0,
            "loyaltyPoints": 0,
            "isActive": True
        }
        db.collection("users").document(uid).set(user_data)
        return user_data
    
    user_data = user_ref.to_dict()
    if not user_data.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been suspended by the administrator."
        )
        
    return user_data

# Specific role checkers
class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {self.allowed_roles}. Current role: {current_user.get('role')}"
            )
        return current_user

# Global shortcuts for role checking dependencies
require_customer = RoleChecker(["customer"])
require_worker = RoleChecker(["worker"])
require_admin = RoleChecker(["admin", "superadmin"])
require_superadmin = RoleChecker(["superadmin"])
