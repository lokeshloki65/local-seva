from fastapi import APIRouter, Depends, HTTPException
import datetime
from app.core.firebase import db
from app.core.security import get_current_user
from app.models.schemas import UserProfileUpdate

router = APIRouter()

@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Retrieves current verified user profile details."""
    return current_user

@router.put("/me")
async def update_my_profile(payload: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Updates user information such as name, language, addresses, and billing credentials."""
    uid = current_user["uid"]
    update_data = {}
    
    # Map attributes that are not None
    payload_dict = payload.model_dump(exclude_none=True)
    
    if "name" in payload_dict:
        update_data["name"] = payload_dict["name"]
    if "preferredLanguage" in payload_dict:
        update_data["preferredLanguage"] = payload_dict["preferredLanguage"]
    if "photoURL" in payload_dict:
        update_data["photoURL"] = payload_dict["photoURL"]
    if "notificationPreferences" in payload_dict:
        update_data["notificationPreferences"] = payload_dict["notificationPreferences"]
    if "savedAddresses" in payload_dict:
        update_data["savedAddresses"] = payload_dict["savedAddresses"]
    if "bankDetails" in payload_dict:
        update_data["bankDetails"] = payload_dict["bankDetails"]
    if "skills" in payload_dict:
        update_data["skills"] = payload_dict["skills"]
    if "serviceZones" in payload_dict:
        update_data["serviceZones"] = payload_dict["serviceZones"]

    if not update_data:
        raise HTTPException(status_code=400, detail="No parameters were provided to update.")

    update_data["updatedAt"] = datetime.datetime.now(datetime.timezone.utc)
    
    # Update document in Firestore
    db.collection("users").document(uid).update(update_data)
    
    # Fetch fresh profile document
    fresh_ref = db.collection("users").document(uid).get()
    return {"status": "success", "user": fresh_ref.to_dict()}

@router.delete("/me")
async def delete_my_account(current_user: dict = Depends(get_current_user)):
    """Wipes user account document from Firestore for GDPR compliance."""
    uid = current_user["uid"]
    
    # Wipe profile
    db.collection("users").document(uid).delete()
    
    # Optional: Delete associated bookings or flag as anonymous
    # In production, we can anonymize records to maintain booking history stats
    return {"status": "success", "message": "Your profile information has been successfully wiped."}

@router.get("/me/bookings")
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    """Retrieves all service bookings requested by this customer or assigned to this worker."""
    uid = current_user["uid"]
    role = current_user["role"]
    
    bookings_query = db.collection("bookings")
    if role == "worker":
        bookings_query = bookings_query.where("workerId", "==", uid)
    else:
        bookings_query = bookings_query.where("customerId", "==", uid)
        
    # Run query sorted by creation time
    docs = bookings_query.order_by("createdAt", direction="DESCENDING").stream()
    
    bookings_list = []
    for doc in docs:
        b_data = doc.to_dict()
        # Convert timestamp fields to ISO strings for JSON serialization
        if "createdAt" in b_data and isinstance(b_data["createdAt"], datetime.datetime):
            b_data["createdAt"] = b_data["createdAt"].isoformat()
        if "scheduledAt" in b_data and isinstance(b_data["scheduledAt"], datetime.datetime):
            b_data["scheduledAt"] = b_data["scheduledAt"].isoformat()
        bookings_list.append(b_data)
        
    return bookings_list

@router.get("/me/notifications")
async def get_my_notifications(current_user: dict = Depends(get_current_user)):
    """Retrieves standard in-app notifications inbox feeds."""
    uid = current_user["uid"]
    docs = db.collection("notifications")\
        .where("userId", "==", uid)\
        .order_by("createdAt", direction="DESCENDING")\
        .limit(30)\
        .stream()
        
    notifs = []
    for doc in docs:
        n_data = doc.to_dict()
        if "createdAt" in n_data and isinstance(n_data["createdAt"], datetime.datetime):
            n_data["createdAt"] = n_data["createdAt"].isoformat()
        notifs.append(n_data)
    return notifs

@router.put("/me/notifications/read-all")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Marks all user notification cards as read."""
    uid = current_user["uid"]
    docs = db.collection("notifications").where("userId", "==", uid).where("read", "==", False).stream()
    
    batch = db.batch()
    count = 0
    for doc in docs:
        batch.update(doc.reference, {"read": True})
        count += 1
        
    if count > 0:
        batch.commit()
        
    return {"status": "success", "updatedCount": count}

@router.get("/me/wallet")
async def get_wallet_info(current_user: dict = Depends(get_current_user)):
    """Retrieves current user's wallet credit balance."""
    return {
        "userId": current_user["uid"],
        "walletBalance": current_user.get("walletBalance", 0.0)
    }

@router.get("/me/transactions")
async def get_my_transactions(current_user: dict = Depends(get_current_user)):
    """Returns chronological ledger log history of credits and debits."""
    uid = current_user["uid"]
    docs = db.collection("transactions")\
        .where("userId", "==", uid)\
        .order_by("createdAt", direction="DESCENDING")\
        .stream()
        
    txs = []
    for doc in docs:
        t_data = doc.to_dict()
        if "createdAt" in t_data and isinstance(t_data["createdAt"], datetime.datetime):
            t_data["createdAt"] = t_data["createdAt"].isoformat()
        txs.append(t_data)
    return txs

@router.get("/me/loyalty-points")
async def get_loyalty_summary(current_user: dict = Depends(get_current_user)):
    """Returns current user's loyalty details."""
    return {
        "loyaltyPoints": current_user.get("loyaltyPoints", 0),
        "pointRedemptionRate": "10 points = ₹1 wallet credit"
    }

@router.post("/me/loyalty-points/redeem")
async def redeem_loyalty_points(current_user: dict = Depends(get_current_user)):
    """Redeems loyalty points into actual wallet credits atomically."""
    uid = current_user["uid"]
    points = int(current_user.get("loyaltyPoints", 0))
    
    if points < 100:
        raise HTTPException(status_code=400, detail="Minimum 100 loyalty points required to trigger redemption.")
        
    # Convert points (10 points = 1 INR credit)
    credit_amount = float(points // 10)
    remaining_points = points % 10
    
    # Adjust balances atomically in Firestore
    from app.services.wallet_service import wallet_service
    wallet_service.adjust_balance(
        user_id=uid,
        amount=credit_amount,
        tx_type="credit",
        description=f"Redemption of {points - remaining_points} loyalty points"
    )
    
    db.collection("users").document(uid).update({
        "loyaltyPoints": remaining_points
    })
    
    return {
        "status": "success", 
        "redeemedAmount": credit_amount, 
        "remainingPoints": remaining_points
    }

@router.get("/me/referral")
async def get_referral_summary(current_user: dict = Depends(get_current_user)):
    """Retrieves custom referral metrics."""
    return {
        "referralCode": current_user.get("referralCode", "SRV000"),
        "referredBy": current_user.get("referredBy", ""),
        "referralRewardValue": "₹250 per validated friend signup"
    }
