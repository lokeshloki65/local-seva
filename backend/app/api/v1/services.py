from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.core.firebase import db
from app.services.ai_service import ai_service

router = APIRouter()

@router.get("")
async def list_services():
    """Returns a full list of active, available services."""
    docs = db.collection("services").where("isActive", "==", True).stream()
    services = []
    for doc in docs:
        services.append(doc.to_dict())
    return services

@router.get("/categories")
async def list_categories():
    """Returns all service category items sorted by priority order."""
    docs = db.collection("categories").where("isActive", "==", True).order_by("order").stream()
    categories = []
    for doc in docs:
        categories.append(doc.to_dict())
    return categories

@router.get("/{id}")
async def get_service(id: str):
    """Retrieves a single service document details by code ID."""
    srv_ref = db.collection("services").document(id).get()
    if not srv_ref.exists:
        raise HTTPException(status_code=404, detail="Service not found.")
    return srv_ref.to_dict()

@router.get("/category/{categoryId}")
async def list_services_by_category(categoryId: str):
    """Retrieves list of active services within a specific category parent."""
    docs = db.collection("services")\
        .where("categoryId", "==", categoryId)\
        .where("isActive", "==", True)\
        .stream()
        
    services = []
    for doc in docs:
        services.append(doc.to_dict())
    return services

@router.get("/search/intent")
async def search_services_with_intent(
    q: str = Query(..., description="Natural language search prompt"),
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """
    Intelligent search endpoint powered by OpenAI GPT-4o.
    Parses conversational queries like 'I need someone to clean my oily kitchen and repair the AC'
    and matches them to exact platform catalog nodes.
    """
    try:
        # Run prompt analysis via AI Service
        intent = ai_service.parse_search_intent(natural_query=q)
        service_id = intent.get("serviceId")
        sub_service_id = intent.get("subServiceId")
        add_ons = intent.get("addOns", [])
        
        # Verify matched service exists in local index
        srv_ref = db.collection("services").document(service_id).get()
        if not srv_ref.exists:
            # Fallback to category standard clean search
            fallback_docs = db.collection("services").where("isActive", "==", True).limit(2).stream()
            fallback_list = [d.to_dict() for d in fallback_docs]
            return {
                "intent": {"serviceId": "full_house_clean", "subServiceId": "1bhk", "addOns": [], "confidence": 0.5},
                "matchedService": fallback_list[0] if fallback_list else None,
                "notes": "Fallbacked. OpenAI matched service did not exist in catalog database."
            }

        srv_data = srv_ref.to_dict()
        return {
            "intent": intent,
            "matchedService": srv_data,
            "recommendedSubService": sub_service_id,
            "recommendedAddOns": add_ons
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search parsing failed: {e}")
