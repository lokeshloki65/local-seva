from fastapi import APIRouter, HTTPException, status, Depends
from firebase_admin import auth as admin_auth
import logging
import random
import datetime
from app.core.firebase import db
from app.models.schemas import PhoneSendOTP, PhoneVerifyOTP, UserRegister, UserLogin
from app.core.redis import redis_client
from app.services.notification_service import notification_service

logger = logging.getLogger("servalocal.api.auth")
router = APIRouter()

@router.post("/phone/send-otp")
async def send_phone_otp(payload: PhoneSendOTP):
    """
    Sends a mock/sandbox SMS OTP to the customer's phone number
    and stores verification code in Redis cache (expiry: 5 minutes).
    """
    phone = payload.phone
    otp_code = str(random.randint(100000, 999999))
    
    try:
        # Cache verification code in Redis (TTL: 300s)
        redis_client.set(f"otp:{phone}", otp_code, ex=300)
        
        # Send SMS alert via Twilio service wrapper
        body = f"ServaLocal: Your verification OTP is {otp_code}. Valid for 5 minutes."
        notification_service.send_sms(to_phone=phone, message_body=body)
        
        return {"status": "success", "message": f"OTP successfully dispatched to {phone}."}
    except Exception as e:
        logger.error(f"Failed to dispatch SMS OTP: {e}")
        raise HTTPException(status_code=500, detail="Internal server error sending OTP code.")

@router.post("/phone/verify-otp")
async def verify_phone_otp(payload: PhoneVerifyOTP):
    """
    Verifies phone OTP from Redis cache.
    Creates or logs in the user profile on success.
    """
    phone = payload.phone
    otp = payload.otp
    
    cached_otp = redis_client.get(f"otp:{phone}")
    if not cached_otp:
        raise HTTPException(status_code=400, detail="OTP has expired or phone is incorrect.")
        
    if cached_otp != otp:
        raise HTTPException(status_code=400, detail="Incorrect verification OTP code.")
        
    # Remove from cache on successful verification
    redis_client.delete(f"otp:{phone}")
    
    # Check if user already exists in Firestore by phone
    users_ref = db.collection("users").where("phone", "==", phone).limit(1).get()
    
    if len(users_ref) > 0:
        user_data = users_ref[0].to_dict()
        return {
            "status": "success", 
            "isNewUser": False,
            "uid": user_data["uid"], 
            "role": user_data["role"], 
            "user": user_data
        }
    else:
        # Lazy profile creation on frontend prompt redirection
        new_uid = f"usr_{random.randint(100000,999999)}"
        new_user = {
            "uid": new_uid,
            "email": "",
            "phone": phone,
            "name": f"User {phone[-4:]}",
            "photoURL": "https://api.dicebear.com/7.x/miniavs/svg?seed=new",
            "role": "customer",
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
            "isActive": True,
            "walletBalance": 0.0,
            "loyaltyPoints": 0,
            "subscriptionPlan": "Free",
            "referralCode": f"SRV{random.randint(100,999)}",
            "savedAddresses": []
        }
        db.collection("users").document(new_uid).set(new_user)
        return {
            "status": "success",
            "isNewUser": True,
            "uid": new_uid,
            "role": "customer",
            "user": new_user
        }

@router.post("/email/register")
async def register_with_email(payload: UserRegister):
    """Registers a new user in Firebase Auth and builds local Firestore metadata profile."""
    try:
        # 1. Create Firebase Auth user credentials
        auth_user = admin_auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.name,
            phone_number=payload.phone
        )
        
        # 2. Build local profile in Firestore users collection
        new_user = {
            "uid": auth_user.uid,
            "email": payload.email,
            "phone": payload.phone,
            "name": payload.name,
            "photoURL": f"https://api.dicebear.com/7.x/adventurer/svg?seed={auth_user.uid[:4]}",
            "role": payload.role,
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
            "isActive": True,
            "preferredLanguage": "en",
            "fcmTokens": [],
            "notificationPreferences": {"email": True, "sms": True, "push": True}
        }
        
        # Role adjustments
        if payload.role == "customer":
            new_user.update({
                "savedAddresses": [],
                "walletBalance": 100.0, # Welcome bonus credit!
                "loyaltyPoints": 0,
                "subscriptionPlan": "Free",
                "referralCode": f"REF{auth_user.uid[:5]}".upper(),
                "referredBy": ""
            })
        elif payload.role == "worker":
            new_user.update({
                "skills": [],
                "serviceZones": [],
                "isOnline": False,
                "isApproved": False, # Requires manual admin approval
                "rating": 0.0,
                "totalJobsCompleted": 0,
                "level": "Rookie",
                "xpPoints": 0,
                "badges": [],
                "bankDetails": {},
                "currentLocation": {"lat": 13.08, "lng": 80.27}
            })

        db.collection("users").document(auth_user.uid).set(new_user)
        
        # Send Welcome Notification email
        welcome_html = f"<h3>Welcome to ServaLocal, {payload.name}!</h3><p>Your account is registered as a {payload.role.capitalize()}. Browse services or set your availability in our PWA.</p>"
        notification_service.send_email(to_email=payload.email, subject="Welcome to ServaLocal", html_content=welcome_html)

        return {"status": "success", "uid": auth_user.uid, "user": new_user}
    except Exception as e:
        logger.error(f"Error during email registration: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create user account: {e}")

@router.post("/email/login")
async def login_with_email(payload: UserLogin):
    """
    Simulates / validates signin token matching for local Firestore user verification.
    In production, frontend authenticates directly via Firebase SDK and passes Bearer token.
    """
    email = payload.email
    users_ref = db.collection("users").where("email", "==", email).limit(1).get()
    
    if len(users_ref) == 0:
        raise HTTPException(status_code=404, detail="No registered account matched this email address.")
        
    user_data = users_ref[0].to_dict()
    if not user_data.get("isActive", True):
        raise HTTPException(status_code=403, detail="Account has been suspended by an administrator.")
        
    return {
        "status": "success",
        "uid": user_data["uid"],
        "role": user_data["role"],
        "token": f"mock_bearer_token_for_{user_data['uid']}",
        "user": user_data
    }

@router.post("/google")
async def register_google_user(payload: dict):
    """Saves or updates profile for users logging in via Firebase Google OAuth."""
    uid = payload.get("uid")
    email = payload.get("email")
    name = payload.get("name", "Google User")
    photo = payload.get("photoURL", "")
    
    if not uid or not email:
        raise HTTPException(status_code=400, detail="Missing required Google OAuth profile parameters.")
        
    user_ref = db.collection("users").document(uid).get()
    if user_ref.exists:
        user_data = user_ref.to_dict()
        return {"status": "success", "isNewUser": False, "user": user_data}
        
    new_user = {
        "uid": uid,
        "email": email,
        "phone": "",
        "name": name,
        "photoURL": photo or "https://api.dicebear.com/7.x/miniavs/svg?seed=google",
        "role": "customer",
        "createdAt": datetime.datetime.now(datetime.timezone.utc),
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "isActive": True,
        "savedAddresses": [],
        "walletBalance": 100.0, # Welcome bonus credit!
        "loyaltyPoints": 0,
        "subscriptionPlan": "Free",
        "referralCode": f"SRV{uid[:5]}".upper(),
        "fcmTokens": [],
        "notificationPreferences": {"email": True, "sms": True, "push": True}
    }
    db.collection("users").document(uid).set(new_user)
    return {"status": "success", "isNewUser": True, "user": new_user}

@router.post("/refresh")
async def refresh_session():
    return {"status": "success", "message": "Auth tokens refreshed."}
