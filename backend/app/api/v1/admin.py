from fastapi import APIRouter, Depends, HTTPException, Query
import datetime
import uuid
from app.core.firebase import db
from app.core.security import require_admin
from app.models.schemas import AdminWalletAdjust, AdminSubscriptionAssign, AdminAssignWorker, BroadcastNotification, ServiceCreateUpdate
from app.services.wallet_service import wallet_service
from app.services.notification_service import notification_service

router = APIRouter()

# Enforce Admin RBAC middleware on all routes in this router
dependency_overrides = [Depends(require_admin)]

@router.get("/dashboard/stats")
async def get_admin_dashboard_stats(current_user: dict = Depends(require_admin)):
    """Retrieves system KPIs for the admin dashboard header widgets."""
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Total bookings today
    today_bookings = db.collection("bookings")\
        .where("createdAt", ">=", today_start)\
        .get()
        
    # 2. Revenue collected today (GMV)
    gmv_today = 0.0
    for bk in today_bookings:
        pricing = bk.to_dict().get("pricing", {})
        final_amt = float(pricing.get("finalAmount", 0.0))
        wallet_u = float(pricing.get("walletUsed", 0.0))
        gmv_today += (final_amt + wallet_u)
        
    # 3. Active Online Worker count
    online_workers = db.collection("users")\
        .where("role", "==", "worker")\
        .where("isOnline", "==", True)\
        .get()
        
    # 4. Total registered customers count
    customers = db.collection("users")\
        .where("role", "==", "customer")\
        .get()

    return {
        "todayBookingsCount": len(today_bookings),
        "todayGMV": round(gmv_today, 2),
        "platformRevenueToday": round(gmv_today * 0.20, 2), # 20% platform cut represent
        "activeOnlineWorkers": len(online_workers),
        "totalRegisteredCustomers": len(customers)
    }

@router.get("/bookings")
async def list_all_bookings(status: str = Query(None), current_user: dict = Depends(require_admin)):
    """Retrieves all service bookings across the platform, filterable by status."""
    query = db.collection("bookings")
    if status:
        query = query.where("status", "==", status)
        
    docs = query.order_by("createdAt", direction="DESCENDING").stream()
    
    bookings = []
    for doc in docs:
        b_data = doc.to_dict()
        if "createdAt" in b_data and isinstance(b_data["createdAt"], datetime.datetime):
            b_data["createdAt"] = b_data["createdAt"].isoformat()
        if "scheduledAt" in b_data and isinstance(b_data["scheduledAt"], datetime.datetime):
            b_data["scheduledAt"] = b_data["scheduledAt"].isoformat()
        bookings.append(b_data)
    return bookings

@router.put("/bookings/{id}/assign-worker")
async def manual_assign_worker(id: str, payload: AdminAssignWorker, current_user: dict = Depends(require_admin)):
    """Overrides auto-matching and manually assigns/reassigns a worker to a booking."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    # Verify target worker profile
    worker_ref = db.collection("users").document(payload.workerId).get()
    if not worker_ref.exists or worker_ref.to_dict().get("role") != "worker":
        raise HTTPException(status_code=400, detail="Provided ID does not match an active worker profile.")
        
    w_data = worker_ref.to_dict()
    
    db.collection("bookings").document(id).update({
        "workerId": payload.workerId,
        "status": "worker_assigned",
        "confirmedAt": datetime.datetime.now(datetime.timezone.utc),
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "timeline": db.collection("bookings").document(id).get().to_dict().get("timeline", []) + [{
            "status": "worker_reassigned_by_admin",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "notes": f"Manual assignment override by Admin {current_user.get('name')}"
        }]
    })

    # Log action to audit logs
    log_id = f"aud_{uuid.uuid4().hex[:10]}"
    db.collection("auditLogs").document(log_id).set({
        "id": log_id,
        "adminUid": current_user["uid"],
        "action": "manual_assign_worker",
        "targetType": "booking",
        "targetId": id,
        "details": {"workerId": payload.workerId},
        "createdAt": datetime.datetime.now(datetime.timezone.utc)
    })

    # Alert worker via Twilio SMS
    w_phone = w_data.get("phone")
    if w_phone:
        notification_service.send_sms(
            to_phone=w_phone,
            message_body=f"Admin assigned: You have a new manual job assignment. Booking ID: {id}."
        )

    return {"status": "success", "message": f"Successfully assigned worker {w_data.get('name')}."}

@router.put("/bookings/{id}/wallet-refund")
async def refund_booking_to_wallet(id: str, current_user: dict = Depends(require_admin)):
    """Administrative override refund processing credit back to client wallet."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    pricing = bk_data.get("pricing", {})
    refund_amt = float(pricing.get("finalAmount", 0.0)) + float(pricing.get("walletUsed", 0.0))
    cust_id = bk_data.get("customerId")
    
    if bk_data.get("paymentStatus") == "waived":
        raise HTTPException(status_code=400, detail="Booking is already marked as waived/refunded.")

    # Process atomic credit top-up
    wallet_service.adjust_balance(
        user_id=cust_id,
        amount=refund_amt,
        tx_type="credit",
        description=f"Admin Full Overriding Waiver Refund for booking {id}",
        booking_id=id
    )

    db.collection("bookings").document(id).update({
        "paymentStatus": "waived",
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })

    # Log action to audit logs
    log_id = f"aud_{uuid.uuid4().hex[:10]}"
    db.collection("auditLogs").document(log_id).set({
        "id": log_id,
        "adminUid": current_user["uid"],
        "action": "admin_refund",
        "targetType": "booking",
        "targetId": id,
        "details": {"refundAmount": refund_amt},
        "createdAt": datetime.datetime.now(datetime.timezone.utc)
    })

    return {"status": "success", "refundedAmount": refund_amt}

@router.get("/workers")
async def list_workers(current_user: dict = Depends(require_admin)):
    """Retrieves all workforce records."""
    docs = db.collection("users").where("role", "==", "worker").stream()
    workers = []
    for doc in docs:
        workers.append(doc.to_dict())
    return workers

@router.put("/workers/{id}/approve")
async def approve_worker(id: str, current_user: dict = Depends(require_admin)):
    """Verifies a pending worker application."""
    w_ref = db.collection("users").document(id).get()
    if not w_ref.exists:
        raise HTTPException(status_code=404, detail="Worker not found.")
        
    db.collection("users").document(id).update({
        "isApproved": True,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })

    # Log to audits
    log_id = f"aud_{uuid.uuid4().hex[:10]}"
    db.collection("auditLogs").document(log_id).set({
        "id": log_id,
        "adminUid": current_user["uid"],
        "action": "approve_worker",
        "targetType": "worker",
        "targetId": id,
        "details": {},
        "createdAt": datetime.datetime.now(datetime.timezone.utc)
    })

    return {"status": "success", "message": "Worker partner approved successfully."}

@router.put("/workers/{id}/suspend")
async def suspend_worker(id: str, current_user: dict = Depends(require_admin)):
    """Suspends worker account."""
    w_ref = db.collection("users").document(id).get()
    if not w_ref.exists:
        raise HTTPException(status_code=404, detail="Worker not found.")
        
    db.collection("users").document(id).update({
        "isActive": False,
        "isOnline": False,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })

    return {"status": "success", "message": "Worker account suspended."}

@router.get("/customers")
async def list_customers(current_user: dict = Depends(require_admin)):
    """Retrieves all registered customer records."""
    docs = db.collection("users").where("role", "==", "customer").stream()
    customers = []
    for doc in docs:
        customers.append(doc.to_dict())
    return customers

@router.put("/customers/{id}/ban")
async def ban_customer(id: str, current_user: dict = Depends(require_admin)):
    """Flags account as inactive/suspended."""
    c_ref = db.collection("users").document(id).get()
    if not c_ref.exists:
        raise HTTPException(status_code=404, detail="Customer not found.")
        
    db.collection("users").document(id).update({
        "isActive": False,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })
    return {"status": "success", "message": "Customer banned."}

@router.put("/customers/{id}/wallet")
async def adjust_customer_wallet(id: str, payload: AdminWalletAdjust, current_user: dict = Depends(require_admin)):
    """Performs manual admin top-up or debit adjustments on wallet balances atomically."""
    try:
        new_bal = wallet_service.adjust_balance(
            user_id=id,
            amount=payload.amount,
            tx_type=payload.type,
            description=f"Admin Manual adjustment: {payload.reason} (Issued by: {current_user.get('name')})"
        )
        return {"status": "success", "newBalance": new_bal}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/customers/{id}/subscription")
async def assign_subscription(id: str, payload: AdminSubscriptionAssign, current_user: dict = Depends(require_admin)):
    """Manually assigns/activates Premium Subscription Plans (Silver/Gold/Platinum) for a customer profile."""
    c_ref = db.collection("users").document(id).get()
    if not c_ref.exists:
        raise HTTPException(status_code=404, detail="Customer profile not found.")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    expiry = now + datetime.timedelta(days=30) # standard 30 day cycles
    
    # 1. Update user document
    db.collection("users").document(id).update({
        "subscriptionPlan": payload.plan,
        "updatedAt": now
    })
    
    # 2. Log record to subscriptions collection
    sub_id = f"sub_{id[:6]}_{payload.plan.lower()}"
    db.collection("subscriptions").document(sub_id).set({
        "id": sub_id,
        "userId": id,
        "plan": payload.plan,
        "status": "active",
        "activatedAt": now,
        "expiresAt": expiry,
        "activatedBy": current_user["uid"],
        "createdAt": now
    })

    return {"status": "success", "subscriptionPlan": payload.plan, "expiresAt": expiry.isoformat()}

# CRUD Service Categories and Services
@router.post("/services")
async def create_new_service(payload: ServiceCreateUpdate, current_user: dict = Depends(require_admin)):
    """Creates a new service catalog offering."""
    srv_id = payload.name.lower().replace(" ", "_")
    srv_data = payload.model_dump()
    srv_data["id"] = srv_id
    srv_data["createdAt"] = datetime.datetime.now(datetime.timezone.utc)
    
    db.collection("services").document(srv_id).set(srv_data)
    return {"status": "success", "service": srv_data}

@router.put("/services/{id}")
async def update_service(id: str, payload: ServiceCreateUpdate, current_user: dict = Depends(require_admin)):
    """Updates active catalog service parameters."""
    srv_ref = db.collection("services").document(id).get()
    if not srv_ref.exists:
        raise HTTPException(status_code=404, detail="Service not found.")
        
    db.collection("services").document(id).update(payload.model_dump())
    return {"status": "success", "message": f"Service '{id}' updated."}

@router.delete("/services/{id}")
async def delete_service(id: str, current_user: dict = Depends(require_admin)):
    """Disables a catalog service (soft-delete)."""
    srv_ref = db.collection("services").document(id).get()
    if not srv_ref.exists:
        raise HTTPException(status_code=404, detail="Service not found.")
        
    db.collection("services").document(id).update({"isActive": False})
    return {"status": "success", "message": f"Service '{id}' deactivated."}

@router.post("/broadcast")
async def broadcast_push_alerts(payload: BroadcastNotification, current_user: dict = Depends(require_admin)):
    """Sends global administrative notifications using FCM FCM topic channels."""
    try:
        topic_target = "all"
        if payload.targetGroup == "workers":
            topic_target = "workers"
        elif payload.targetGroup == "customers":
            topic_target = "customers"
            
        success = notification_service.broadcast_to_topic(
            topic=topic_target,
            title=payload.title,
            body=payload.body
        )
        return {"status": "success", "broadcasted": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payouts")
async def list_payouts(current_user: dict = Depends(require_admin)):
    """Lists all worker payout summaries."""
    docs = db.collection("workerPayouts").order_by("createdAt", direction="DESCENDING").stream()
    payouts = []
    for doc in docs:
        p_data = doc.to_dict()
        if "createdAt" in p_data and isinstance(p_data["createdAt"], datetime.datetime):
            p_data["createdAt"] = p_data["createdAt"].isoformat()
        payouts.append(p_data)
    return payouts

@router.put("/payouts/{id}/mark-sent")
async def mark_payout_as_sent(id: str, current_user: dict = Depends(require_admin)):
    """Marks a worker payout as sent after confirming transaction outside the system."""
    p_ref = db.collection("workerPayouts").document(id).get()
    if not p_ref.exists:
        raise HTTPException(status_code=404, detail="Payout record not found.")
        
    db.collection("workerPayouts").document(id).update({
        "status": "sent",
        "markedSentBy": current_user["uid"],
        "markedSentAt": datetime.datetime.now(datetime.timezone.utc)
    })
    
    return {"status": "success", "message": "Payout marked as sent."}

@router.get("/audit-logs")
async def get_audit_logs(current_user: dict = Depends(require_admin)):
    """Retrieves list of administrative security logs."""
    docs = db.collection("auditLogs").order_by("createdAt", direction="DESCENDING").limit(50).stream()
    logs = []
    for doc in docs:
        l_data = doc.to_dict()
        if "createdAt" in l_data and isinstance(l_data["createdAt"], datetime.datetime):
            l_data["createdAt"] = l_data["createdAt"].isoformat()
        logs.append(l_data)
    return logs
