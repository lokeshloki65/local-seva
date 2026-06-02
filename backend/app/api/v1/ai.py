from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.core.security import get_current_user
from app.models.schemas import AIChatQuery
from app.services.ai_service import ai_service
from app.core.firebase import db

router = APIRouter()

@router.post("/chat")
async def chat_with_ai_assistant(payload: AIChatQuery, current_user: dict = Depends(get_current_user)):
    """
    Conversational assistant powered by GPT-4o.
    Context includes the user's details, active bookings, and wallet balance.
    """
    try:
        # Assemble additional contextual information to ground the AI's response
        user_context = {
            "name": current_user.get("name", "User"),
            "role": current_user.get("role", "customer"),
            "walletBalance": current_user.get("walletBalance", 0.0),
            "language": current_user.get("preferredLanguage", "en")
        }
        
        # Pull active bookings if customer
        if current_user.get("role") == "customer":
            active_bk = db.collection("bookings")\
                .where("customerId", "==", current_user["uid"])\
                .where("status", "in", ["requested", "worker_assigned", "confirmed", "en_route", "in_progress"])\
                .limit(1)\
                .get()
            if len(active_bk) > 0:
                bk_data = active_bk[0].to_dict()
                user_context["activeBooking"] = {
                    "bookingId": bk_data.get("id"),
                    "status": bk_data.get("status"),
                    "service": bk_data.get("serviceId"),
                    "scheduledTime": str(bk_data.get("scheduledAt"))
                }

        # Build dummy history array or extract if client passed it in payload
        chat_history = payload.context.get("history", []) if payload.context else []
        
        response = ai_service.chat_assistant(
            message=payload.message,
            chat_history=chat_history,
            user_context=user_context
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Chat Service Error: {e}")
