import math
import logging
from typing import Optional, List, Dict, Any
from app.core.firebase import db

logger = logging.getLogger("servalocal.assignment")

class WorkerAssignmentService:
    @staticmethod
    def calculate_haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculates distance between two lat/lng coordinates in kilometers."""
        # Radius of the Earth in km
        R = 6371.0
        
        d_lat = math.radians(lat2 - lat1)
        d_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(d_lat / 2) ** 2 + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
             math.sin(d_lng / 2) ** 2)
             
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @classmethod
    def get_best_worker(cls, service_id: str, zone_id: str, lat: float, lng: float) -> Optional[str]:
        """
        Finds the absolute best worker for a job based on:
        Score = (0.4 * proximity) + (0.3 * rating) + (0.2 * workload) + (0.1 * response_rate)
        """
        try:
            # 1. Fetch active, approved workers who support this zone & are ONLINE
            workers_ref = db.collection("users")\
                .where("role", "==", "worker")\
                .where("isOnline", "==", True)\
                .where("isApproved", "==", True)\
                .stream()

            candidates = []
            for w_doc in workers_ref:
                w_data = w_doc.to_dict()
                skills = w_data.get("skills", [])
                zones = w_data.get("serviceZones", [])
                
                # Verify skill and zone eligibility
                if service_id in skills and zone_id in zones:
                    candidates.append((w_doc.id, w_data))

            if not candidates:
                logger.info(f"No active, approved, online workers found with skill '{service_id}' in zone '{zone_id}'.")
                return None

            scored_workers = []
            for w_id, w_data in candidates:
                # A. Proximity Score
                loc = w_data.get("currentLocation")
                if loc and "lat" in loc and "lng" in loc:
                    dist = cls.calculate_haversine_distance(lat, lng, loc["lat"], loc["lng"])
                    # Closer distance -> higher score. Maximum score is 1.0 for dist = 0.
                    proximity_score = 1.0 / (1.0 + dist)
                else:
                    dist = 999.0
                    proximity_score = 0.0

                # B. Rating Score
                rating = float(w_data.get("rating", 0.0))
                rating_score = rating / 5.0

                # C. Workload Score (Check active jobs count in Firestore)
                active_jobs = db.collection("bookings")\
                    .where("workerId", "==", w_id)\
                    .where("status", "in", ["confirmed", "worker_assigned", "en_route", "in_progress"])\
                    .get()
                
                jobs_count = len(active_jobs)
                # Less active jobs -> higher score. 0 jobs = 1.0 score.
                workload_score = 1.0 / (1.0 + jobs_count)

                # D. Response Rate Score
                # Grab or default response rate (can be level-based or profile-based)
                xp = int(w_data.get("xpPoints", 0))
                # Expert levels get higher base response rates
                response_rate = 0.95 if xp > 2000 else 0.85
                response_rate_score = response_rate

                # Combined Score Calculation
                total_score = (
                    (0.4 * proximity_score) + 
                    (0.3 * rating_score) + 
                    (0.2 * workload_score) + 
                    (0.1 * response_rate_score)
                )

                scored_workers.append({
                    "workerId": w_id,
                    "score": total_score,
                    "distance": dist,
                    "jobsCount": jobs_count,
                    "rating": rating
                })

            # Sort workers by highest score descending
            scored_workers.sort(key=lambda x: x["score"], reverse=True)
            
            logger.info(f"Worker evaluation list for service '{service_id}' in zone '{zone_id}': {scored_workers}")
            
            if scored_workers:
                best_match = scored_workers[0]
                logger.info(f"Assigned Best Worker: {best_match['workerId']} with score {best_match['score']:.4f}")
                return best_match["workerId"]
            
            return None
        except Exception as e:
            logger.error(f"Error during worker auto-assignment scoring: {e}")
            return None

worker_assignment_service = WorkerAssignmentService()
