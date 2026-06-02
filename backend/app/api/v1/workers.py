from fastapi import APIRouter, Depends, HTTPException
import datetime
from app.core.firebase import db
from app.core.security import get_current_user, require_worker

router = APIRouter()

@router.get("/dashboard")
async def get_worker_dashboard(current_user: dict = Depends(require_worker)):
    """Retrieves worker stats: today's completions, earnings summary, XP counters, and level."""
    uid = current_user["uid"]
    
    # 1. Query today's completed jobs for this worker
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    jobs_today = db.collection("bookings")\
        .where("workerId", "==", uid)\
        .where("status", "==", "completed")\
        .where("completedAt", ">=", today_start)\
        .get()
        
    # Calculate today's earnings (80% share to worker, 20% platform commission fee)
    today_earnings = 0.0
    for job in jobs_today:
        pricing = job.to_dict().get("pricing", {})
        final_amt = float(pricing.get("finalAmount", 0.0))
        wallet_u = float(pricing.get("walletUsed", 0.0))
        total_payment = final_amt + wallet_u
        today_earnings += total_payment * 0.8 # 80% share

    # 2. Query next active job
    upcoming_job = db.collection("bookings")\
        .where("workerId", "==", uid)\
        .where("status", "in", ["confirmed", "worker_assigned", "en_route", "in_progress"])\
        .order_by("scheduledAt")\
        .limit(1)\
        .get()
        
    next_job = None
    if len(upcoming_job) > 0:
        next_job = upcoming_job[0].to_dict()
        if "scheduledAt" in next_job and isinstance(next_job["scheduledAt"], datetime.datetime):
            next_job["scheduledAt"] = next_job["scheduledAt"].isoformat()

    return {
        "todayJobsCompleted": len(jobs_today),
        "todayEarnings": round(today_earnings, 2),
        "rating": current_user.get("rating", 0.0),
        "isOnline": current_user.get("isOnline", False),
        "xpPoints": current_user.get("xpPoints", 0),
        "level": current_user.get("level", "Rookie"),
        "badges": current_user.get("badges", []),
        "nextJob": next_job
    }

@router.put("/availability")
async def toggle_availability(payload: dict, current_user: dict = Depends(require_worker)):
    """Toggles online state or updates week availability schedules."""
    uid = current_user["uid"]
    
    update_data = {}
    if "isOnline" in payload:
        update_data["isOnline"] = bool(payload["isOnline"])
    if "workingHours" in payload:
        update_data["workingHours"] = payload["workingHours"] # E.g., {"mon": "9am-6pm", ...}
        
    if not update_data:
        raise HTTPException(status_code=400, detail="Missing parameters to update.")
        
    update_data["updatedAt"] = datetime.datetime.now(datetime.timezone.utc)
    db.collection("users").document(uid).update(update_data)
    
    return {"status": "success", "isOnline": update_data.get("isOnline")}

@router.get("/jobs/incoming")
async def list_incoming_jobs(current_user: dict = Depends(require_worker)):
    """Retrieves list of active jobs where worker is matched but status is requested/confirmed."""
    uid = current_user["uid"]
    
    # In auto-assignment, the worker is pre-assigned and status becomes worker_assigned
    docs = db.collection("bookings")\
        .where("workerId", "==", uid)\
        .where("status", "in", ["worker_assigned"])\
        .stream()
        
    incoming = []
    for doc in docs:
        b_data = doc.to_dict()
        if "scheduledAt" in b_data and isinstance(b_data["scheduledAt"], datetime.datetime):
            b_data["scheduledAt"] = b_data["scheduledAt"].isoformat()
        if "createdAt" in b_data and isinstance(b_data["createdAt"], datetime.datetime):
            b_data["createdAt"] = b_data["createdAt"].isoformat()
        incoming.append(b_data)
        
    return incoming

@router.post("/jobs/{bookingId}/accept")
async def accept_job(bookingId: str, current_user: dict = Depends(require_worker)):
    """Worker accepts incoming pre-assigned job. Changes status to 'confirmed'."""
    uid = current_user["uid"]
    
    bk_ref = db.collection("bookings").document(bookingId).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    bk_data = bk_ref.to_dict()
    if bk_data.get("workerId") != uid:
        raise HTTPException(status_code=403, detail="This booking is not assigned to you.")
        
    if bk_data.get("status") != "worker_assigned":
        raise HTTPException(status_code=400, detail="Job has already been accepted or cancelled.")

    # Accept job and transition status to confirmed
    db.collection("bookings").document(bookingId).update({
        "status": "confirmed",
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "timeline": db.collection("bookings").document(bookingId).get().to_dict().get("timeline", []) + [{
            "status": "confirmed",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "notes": f"Accepted by worker: {current_user.get('name')}"
        }]
    })
    
    # Increment XP (+5 XP for fast acceptance)
    db.collection("users").document(uid).update({
        "xpPoints": int(current_user.get("xpPoints", 0)) + 5
    })

    return {"status": "success", "message": "Job accepted. Safe travel to customer location!"}

@router.post("/jobs/{bookingId}/decline")
async def decline_job(bookingId: str, current_user: dict = Depends(require_worker)):
    """Worker declines job. Triggers immediate re-assignment fallback loop."""
    uid = current_user["uid"]
    
    bk_ref = db.collection("bookings").document(bookingId).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    bk_data = bk_ref.to_dict()
    if bk_data.get("workerId") != uid:
        raise HTTPException(status_code=403, detail="You are not authorized.")

    # Re-assign immediately: Wipe current worker ID and run assignment search
    db.collection("bookings").document(bookingId).update({
        "workerId": "",
        "status": "requested",
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })
    
    # Rerun assignment logic
    from app.services.booking_service import booking_service
    addr = bk_data.get("address", {})
    lat = float(addr.get("lat", 13.08))
    lng = float(addr.get("lng", 80.27))
    
    from app.services.worker_assignment import worker_assignment_service
    # Re-trigger search (excluding current worker)
    next_worker = worker_assignment_service.get_best_worker(
        service_id=bk_data["serviceId"],
        zone_id="chennai_core",
        lat=lat,
        lng=lng
    )
    
    if next_worker and next_worker != uid:
        db.collection("bookings").document(bookingId).update({
            "workerId": next_worker,
            "status": "worker_assigned",
            "confirmedAt": datetime.datetime.now(datetime.timezone.utc)
        })
        logger.info(f"Decline recovery: Job {bookingId} successfully re-assigned to worker {next_worker}.")
    else:
        logger.warning(f"Decline recovery: No alternative qualified worker was online for job {bookingId}.")

    return {"status": "success", "message": "You have declined the job request successfully."}

@router.put("/jobs/{bookingId}/status")
async def update_job_status(bookingId: str, payload: dict, current_user: dict = Depends(require_worker)):
    """Updates the active job checklist status (e.g. 'en_route', 'in_progress')."""
    uid = current_user["uid"]
    new_status = payload.get("status")
    
    if new_status not in ["en_route", "in_progress"]:
        raise HTTPException(status_code=400, detail="Invalid active checklist transition. Use dedicated complete route for closures.")
        
    bk_ref = db.collection("bookings").document(bookingId).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    bk_data = bk_ref.to_dict()
    if bk_data.get("workerId") != uid:
        raise HTTPException(status_code=403, detail="Unauthorized access.")
        
    # Update status
    db.collection("bookings").document(bookingId).update({
        "status": new_status,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "timeline": db.collection("bookings").document(bookingId).get().to_dict().get("timeline", []) + [{
            "status": new_status,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }]
    })
    
    return {"status": "success", "status": new_status}

@router.get("/earnings")
async def get_my_earnings(current_user: dict = Depends(require_worker)):
    """Retrieves full itemized earnings statements."""
    uid = current_user["uid"]
    docs = db.collection("bookings")\
        .where("workerId", "==", uid)\
        .where("status", "==", "completed")\
        .order_by("completedAt", direction="DESCENDING")\
        .stream()
        
    total_revenue = 0.0
    jobs_list = []
    
    for doc in docs:
        b_data = doc.to_dict()
        pricing = b_data.get("pricing", {})
        final_amt = float(pricing.get("finalAmount", 0.0))
        wallet_u = float(pricing.get("walletUsed", 0.0))
        
        # 80% to partner
        job_total = final_amt + wallet_u
        partner_share = round(job_total * 0.8, 2)
        platform_fee = round(job_total * 0.2, 2)
        
        total_revenue += partner_share
        
        if "completedAt" in b_data and isinstance(b_data["completedAt"], datetime.datetime):
            b_data["completedAt"] = b_data["completedAt"].isoformat()
            
        jobs_list.append({
            "bookingId": doc.id,
            "serviceName": b_data.get("serviceId", "Service").replace("_", " ").title(),
            "completedAt": b_data.get("completedAt"),
            "totalPaid": job_total,
            "earnings": partner_share,
            "platformFee": platform_fee
        })
        
    return {
        "totalEarnings": round(total_revenue, 2),
        "platformCut": round(total_revenue * 0.25, 2), # 20% platform share representation
        "jobs": jobs_list
    }

@router.get("/leaderboard")
async def get_city_leaderboard(current_user: dict = Depends(require_worker)):
    """Lists top scoring workers in the system for community competition."""
    docs = db.collection("users")\
        .where("role", "==", "worker")\
        .order_by("rating", direction="DESCENDING")\
        .limit(10)\
        .stream()
        
    board = []
    for doc in docs:
        w_data = doc.to_dict()
        board.append({
            "name": w_data.get("name"),
            "rating": w_data.get("rating", 0.0),
            "level": w_data.get("level", "Rookie"),
            "totalJobs": w_data.get("totalJobsCompleted", 0)
        })
    return board
