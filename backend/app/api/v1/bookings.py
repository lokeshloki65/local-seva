from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
import datetime
import os
from app.core.firebase import db
from app.core.security import get_current_user
from app.models.schemas import BookingCreate, BookingReschedule, BookingCancel, BookingReview, BookingIssue
from app.services.booking_service import booking_service
from app.services.wallet_service import wallet_service
from app.services.invoice_service import InvoiceService as invoice_service
from app.services.notification_service import notification_service

router = APIRouter()

@router.post("")
async def create_new_booking(payload: BookingCreate, current_user: dict = Depends(get_current_user)):
    """
    Creates a new service booking, computes pricing, applies promo codes,
    verifies wallet transactions, and starts workforce matching algorithms.
    """
    if current_user.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Only customer accounts can create service bookings.")
        
    try:
        # Convert schema model to standard dict
        payload_dict = payload.model_dump()
        payload_dict["scheduledAt"] = payload.scheduledAt # Preserve datetime
        
        result = booking_service.create_booking(
            customer_id=current_user["uid"],
            booking_data=payload_dict
        )
        return {"status": "success", "booking": result}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Booking creation failed: {e}")

@router.get("/{id}")
async def get_booking_details(id: str, current_user: dict = Depends(get_current_user)):
    """Retrieves full details of a specific service booking."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Requested booking code not found.")
        
    bk_data = bk_ref.to_dict()
    
    # Enforce role scoping: customers/workers see only their own jobs; admins see all
    if current_user["role"] not in ["admin", "superadmin"]:
        if bk_data.get("customerId") != current_user["uid"] and bk_data.get("workerId") != current_user["uid"]:
            raise HTTPException(status_code=403, detail="Access denied. You do not have permissions for this booking.")
            
    # Serialize timestamps
    if "createdAt" in bk_data and isinstance(bk_data["createdAt"], datetime.datetime):
        bk_data["createdAt"] = bk_data["createdAt"].isoformat()
    if "scheduledAt" in bk_data and isinstance(bk_data["scheduledAt"], datetime.datetime):
        bk_data["scheduledAt"] = bk_data["scheduledAt"].isoformat()
    if "confirmedAt" in bk_data and isinstance(bk_data["confirmedAt"], datetime.datetime):
        bk_data["confirmedAt"] = bk_data["confirmedAt"].isoformat()
    if "startedAt" in bk_data and isinstance(bk_data["startedAt"], datetime.datetime):
        bk_data["startedAt"] = bk_data["startedAt"].isoformat()
    if "completedAt" in bk_data and isinstance(bk_data["completedAt"], datetime.datetime):
        bk_data["completedAt"] = bk_data["completedAt"].isoformat()
        
    return bk_data

@router.put("/{id}/reschedule")
async def reschedule_booking(id: str, payload: BookingReschedule, current_user: dict = Depends(get_current_user)):
    """Allows customers or admins to reschedule a service slot (allowed up to 2 hours before the appointment)."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    
    # Enforce role-scoping
    if current_user["role"] not in ["admin", "superadmin"] and bk_data.get("customerId") != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    # Verify rescheduling deadline (minimum 2 hours ahead of time)
    sched_time = bk_data.get("scheduledAt")
    if sched_time:
        if isinstance(sched_time, str):
            sched_time = datetime.datetime.fromisoformat(sched_time.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        if sched_time - now < datetime.timedelta(hours=2):
            raise HTTPException(status_code=400, detail="Bookings can only be rescheduled up to 2 hours before the scheduled slot.")

    # Update scheduledAt field
    db.collection("bookings").document(id).update({
        "scheduledAt": payload.newScheduledAt,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "timeline": db.collection("bookings").document(id).get().to_dict().get("timeline", []) + [{
            "status": "rescheduled",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "notes": f"Slot moved to {payload.newScheduledAt.strftime('%Y-%m-%d %H:%M')}"
        }]
    })

    # Alert assigned worker
    worker_id = bk_data.get("workerId")
    if worker_id:
        worker_ref = db.collection("users").document(worker_id).get().to_dict()
        worker_phone = worker_ref.get("phone")
        if worker_phone:
            notification_service.send_sms(
                to_phone=worker_phone,
                message_body=f"Booking {id} has been rescheduled to {payload.newScheduledAt.strftime('%Y-%m-%d %H:%M')}. Review details."
            )

    return {"status": "success", "message": "Booking slot rescheduled successfully."}

@router.put("/{id}/cancel")
async def cancel_booking(id: str, payload: BookingCancel, current_user: dict = Depends(get_current_user)):
    """Allows customers or admins to cancel bookings, auto-refunding wallet charges atomically."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    cust_id = bk_data.get("customerId")
    
    if current_user["role"] not in ["admin", "superadmin"] and cust_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    if bk_data.get("status") in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel a booking that is already completed or cancelled.")

    # Update status in Firestore
    db.collection("bookings").document(id).update({
        "status": "cancelled",
        "cancelledAt": datetime.datetime.now(datetime.timezone.utc),
        "updatedAt": datetime.datetime.now(datetime.timezone.utc),
        "timeline": db.collection("bookings").document(id).get().to_dict().get("timeline", []) + [{
            "status": "cancelled",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "reason": payload.reason
        }]
    })

    # Refund wallet deductions atomically if applicable
    wallet_used = float(bk_data.get("pricing", {}).get("walletUsed", 0.0))
    if wallet_used > 0:
        wallet_service.adjust_balance(
            user_id=cust_id,
            amount=wallet_used,
            tx_type="credit",
            description=f"Refund for cancelled booking {id}",
            booking_id=id
        )

    # Nudge worker about cancellation
    worker_id = bk_data.get("workerId")
    if worker_id:
        w_profile = db.collection("users").document(worker_id).get().to_dict()
        w_phone = w_profile.get("phone")
        if w_phone:
            notification_service.send_sms(to_phone=w_phone, message_body=f"Alert: Booking {id} has been cancelled by the customer.")

    return {"status": "success", "message": "Booking has been successfully cancelled and refunded."}

@router.put("/{id}/complete")
async def complete_booking(id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    """
    Allows workers to mark jobs as completed by verifying a customer's unique completion OTP code.
    Also handles gamification XP rewards.
    """
    if current_user.get("role") != "worker":
        raise HTTPException(status_code=403, detail="Only assigned worker partners can complete bookings.")
        
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    
    if bk_data.get("workerId") != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied. You are not the assigned worker for this job.")

    # Validate OTP to avoid fraud completion
    customer_otp = payload.get("otp")
    if bk_data.get("customerOTP") != customer_otp:
        raise HTTPException(status_code=400, detail="Incorrect verification OTP. Ask customer for the 4-digit code on their PWA booking screen.")

    # Update status to completed
    now = datetime.datetime.now(datetime.timezone.utc)
    db.collection("bookings").document(id).update({
        "status": "completed",
        "paymentStatus": "collected",
        "completedAt": now,
        "updatedAt": now,
        "workerNotes": payload.get("workerNotes", ""),
        "afterPhotos": payload.get("afterPhotos", []),
        "timeline": db.collection("bookings").document(id).get().to_dict().get("timeline", []) + [{
            "status": "completed",
            "timestamp": now.isoformat()
        }]
    })

    # Execute Gamification XP additions (+50 XP for completed job)
    worker_id = current_user["uid"]
    current_xp = int(current_user.get("xpPoints", 0))
    current_jobs = int(current_user.get("totalJobsCompleted", 0))
    
    new_xp = current_xp + 50
    new_jobs = current_jobs + 1
    
    # Calculate Levels: Rookie (0-500), Professional (501-2000), Expert (2001-5000), Master (5001-10000), Legend (10001+)
    new_level = "Rookie"
    if new_xp > 10000: new_level = "Legend"
    elif new_xp > 5000: new_level = "Master"
    elif new_xp > 2000: new_level = "Expert"
    elif new_xp > 500: new_level = "Professional"

    db.collection("users").document(worker_id).update({
        "xpPoints": new_xp,
        "totalJobsCompleted": new_jobs,
        "level": new_level,
        "updatedAt": now
    })

    # Trigger welcome bonus credit if first booking completed
    # (E.g. increase loyalty points for customers)
    cust_id = bk_data.get("customerId")
    cust_ref = db.collection("users").document(cust_id).get().to_dict()
    loyalty = int(cust_ref.get("loyaltyPoints", 0))
    db.collection("users").document(cust_id).update({
        "loyaltyPoints": loyalty + 20 # +20 loyalty points for booking completion
    })

    return {"status": "success", "message": "Job successfully marked as completed. +50 XP rewarded!", "newXP": new_xp, "level": new_level}

@router.post("/{id}/review")
async def review_booking(id: str, payload: BookingReview, current_user: dict = Depends(get_current_user)):
    """Allows customers to review completed bookings and triggers sentiment flags."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    
    if bk_data.get("customerId") != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied. You can only review your own bookings.")
        
    if bk_data.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Reviews can only be given on completed bookings.")

    # 1. Update rating fields in booking
    db.collection("bookings").document(id).update({
        "rating": {
            "score": payload.score,
            "review": payload.review,
            "tags": payload.tags,
            "reviewedAt": datetime.datetime.now(datetime.timezone.utc)
        }
    })

    # 2. Add to global reviews collection for display
    review_id = f"rev_{id}"
    db.collection("reviews").document(review_id).set({
        "id": review_id,
        "bookingId": id,
        "customerId": current_user["uid"],
        "workerId": bk_data["workerId"],
        "score": payload.score,
        "review": payload.review,
        "tags": payload.tags,
        "photos": payload.photos,
        "createdAt": datetime.datetime.now(datetime.timezone.utc)
    })

    # 3. Trigger review sentiment classifier (GPT-4o)
    from app.services.ai_service import ai_service
    sentiment = ai_service.analyze_sentiment(payload.review)
    if sentiment == "negative":
        # Flag booking as disputed or raise issue for admin dashboard feed review
        db.collection("bookings").document(id).update({"status": "disputed"})
        logger.warning(f"Negative sentiment identified in review of Booking {id}! Flagged for admin scrutiny.")

    # 4. Re-calculate worker's average rating
    worker_id = bk_data["workerId"]
    all_reviews = db.collection("reviews").where("workerId", "==", worker_id).stream()
    total_score = 0.0
    count = 0
    for r in all_reviews:
        total_score += float(r.to_dict().get("score", 0.0))
        count += 1
        
    if count > 0:
        new_avg = round(total_score / count, 2)
        db.collection("users").document(worker_id).update({"rating": new_avg})

    return {"status": "success", "sentiment": sentiment}

@router.get("/{id}/invoice")
async def download_booking_invoice(id: str, current_user: dict = Depends(get_current_user)):
    """Generates and streams a downloadable itemized PDF invoice for the completed booking."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    bk_data = bk_ref.to_dict()
    
    # PDF output path
    pdf_dir = "artifacts/invoices"
    pdf_filename = f"invoice_{id}.pdf"
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    
    # Query client and partner details
    cust_ref = db.collection("users").document(bk_data["customerId"]).get()
    cust_name = cust_ref.to_dict().get("name", "Valued Customer") if cust_ref.exists else "Customer"
    
    worker_name = "Best Available Partner"
    if bk_data.get("workerId"):
        w_ref = db.collection("users").document(bk_data["workerId"]).get()
        if w_ref.exists:
            worker_name = w_ref.to_dict().get("name", "Expert Worker")

    # Generate using Invoice PDF Service
    invoice_service.generate_pdf(
        booking_data=bk_data,
        customer_name=cust_name,
        worker_name=worker_name,
        output_path=pdf_path
    )
    
    return FileResponse(
        path=pdf_path, 
        filename=pdf_filename, 
        media_type="application/pdf"
    )

@router.post("/{id}/issue")
async def report_booking_issue(id: str, payload: BookingIssue, current_user: dict = Depends(get_current_user)):
    """Logs disputes or quality issues about a specific booking for admin auditing."""
    bk_ref = db.collection("bookings").document(id).get()
    if not bk_ref.exists:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    issue_data = {
        "id": f"iss_{uuid.uuid4().hex[:8]}",
        "description": payload.description,
        "photoURL": payload.photoURL or "",
        "reporterId": current_user["uid"],
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    db.collection("bookings").document(id).update({
        "status": "disputed",
        "issueReports": db.collection("bookings").document(id).get().to_dict().get("issueReports", []) + [issue_data],
        "updatedAt": datetime.datetime.now(datetime.timezone.utc)
    })
    
    return {"status": "success", "message": "Dispute reported. Customer care is notified."}
