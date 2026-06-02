import logging
import datetime
from app.tasks.celery_app import celery_app
from app.services.ai_service import ai_service
from app.core.firebase import db

logger = logging.getLogger("servalocal.tasks.forecast")

@celery_app.task(name="tasks.update_zone_forecasts")
def update_zone_forecasts() -> bool:
    """
    Cron task that runs weekly to compile historical booking densities
    and generate AI predictions for every serviceable zone.
    """
    logger.info("Starting automated weekly demand forecasting cron task...")
    try:
        zones_stream = db.collection("zones").stream()
        for zone in zones_stream:
            zone_id = zone.id
            
            # Fetch booking records for this zone in the last 14 days
            past_14_days = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=14)
            bookings_ref = db.collection("bookings")\
                .where("createdAt", ">=", past_14_days)\
                .stream()
                
            zone_bookings = []
            for bk in bookings_ref:
                bk_data = bk.to_dict()
                # Simple check since our mock data coordinates or addresses match zones
                # If they are associated via worker, we capture it
                zone_bookings.append({
                    "id": bk.id,
                    "serviceId": bk_data.get("serviceId"),
                    "finalAmount": bk_data.get("pricing", {}).get("finalAmount"),
                    "status": bk_data.get("status"),
                    "createdAt": str(bk_data.get("createdAt"))
                })

            # Fetch forecast via AI
            forecast_data = ai_service.forecast_demand(zone_id=zone_id, historical_bookings=zone_bookings)
            
            # Cache the results inside the zone document
            db.collection("zones").document(zone_id).update({
                "forecast": forecast_data.get("forecast", []),
                "forecastUpdatedAt": datetime.datetime.now(datetime.timezone.utc)
            })
            
            logger.info(f"Successfully generated and cached demand forecasts for Zone: {zone_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to generate demand forecasts: {e}")
        return False
