import socketio
import logging
import datetime
from app.core.firebase import db

logger = logging.getLogger("servalocal.socket")

# Create Async Socket.io server instance
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" # Handled separately from FastAPI CORS
)

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.io client connected. Session ID: {sid}")
    # Connection handshake: Query parameters can specify user ID & role
    query_auth = environ.get("HTTP_SEC_WEBSOCKET_PROTOCOL") or ""
    # Optional handshake protocol mapping can be set here

@sio.event
async def disconnect(sid):
    logger.info(f"Socket.io client disconnected. Session ID: {sid}")

@sio.on("join_room")
async def handle_join_room(sid, data: dict):
    """
    Subscribes a client to dynamic rooms:
    - 'booking:{bookingId}' for live chat / progress updates
    - 'worker:{workerId}' for personal job dispatch queues
    - 'admin:live' for global system telemetry feed
    """
    room = data.get("room")
    if room:
        await sio.enter_room(sid, room)
        logger.info(f"Client {sid} subscribed to room '{room}' successfully.")
        await sio.emit("room_joined", {"status": "success", "room": room}, to=sid)

@sio.on("leave_room")
async def handle_leave_room(sid, data: dict):
    room = data.get("room")
    if room:
        await sio.leave_room(sid, room)
        logger.info(f"Client {sid} left room '{room}'.")

@sio.on("worker:location_update")
async def handle_location_update(sid, data: dict):
    """
    Echoes GPS streams to active booking rooms for client mapping
    and stores locations inside user profiles.
    """
    worker_id = data.get("workerId")
    booking_id = data.get("bookingId")
    lat = float(data.get("lat", 0.0))
    lng = float(data.get("lng", 0.0))
    
    if worker_id and lat and lng:
        logger.debug(f"Location update from worker {worker_id}: Lat {lat}, Lng {lng}")
        
        # 1. Update worker profile coordinates in Firestore
        db.collection("users").document(worker_id).update({
            "currentLocation": {"lat": lat, "lng": lng},
            "updatedAt": datetime.datetime.now(datetime.timezone.utc)
        })
        
        # 2. Broadcast coordinates to booking room for real-time tracking widget
        if booking_id:
            await sio.emit(
                "worker:location_changed", 
                {"workerId": worker_id, "lat": lat, "lng": lng, "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}, 
                room=f"booking:{booking_id}"
            )
            
            # Simple Geofencing: trigger automatic arrival check (within 100 meters of target coordinate)
            booking_ref = db.collection("bookings").document(booking_id).get()
            if booking_ref.exists:
                b_data = booking_ref.to_dict()
                dest = b_data.get("address", {})
                d_lat = float(dest.get("lat", 0.0))
                d_lng = float(dest.get("lng", 0.0))
                
                # Haversine check
                dist = calculate_haversine(lat, lng, d_lat, d_lng)
                if dist <= 0.1: # Less than 100 meters
                    if b_data.get("status") == "en_route":
                        logger.info(f"Geofence breach! Worker {worker_id} arrived at booking {booking_id}.")
                        
                        db.collection("bookings").document(booking_id).update({
                            "status": "in_progress",
                            "startedAt": datetime.datetime.now(datetime.timezone.utc),
                            "updatedAt": datetime.datetime.now(datetime.timezone.utc),
                            "timeline": db.collection("bookings").document(booking_id).get().to_dict().get("timeline", []) + [{
                                "status": "in_progress",
                                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                            }]
                        })
                        await sio.emit("booking:status_update", {"bookingId": booking_id, "status": "in_progress"}, room=f"booking:{booking_id}")
                        await sio.emit("admin:feed_update", {"bookingId": booking_id, "status": "in_progress", "event": "worker_arrived"}, room="admin:live")

@sio.on("booking:new_message")
async def handle_new_message(sid, data: dict):
    """Handles real-time customer-worker chat & appends to Firestore conversation timelines."""
    booking_id = data.get("bookingId")
    sender_id = data.get("senderId")
    sender_name = data.get("senderName", "User")
    message_text = data.get("text")

    if booking_id and sender_id and message_text:
        msg_record = {
            "id": f"msg_{datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S%f')}",
            "senderId": sender_id,
            "senderName": sender_name,
            "text": message_text,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        # 1. Update conversation array in Firestore booking
        db.collection("bookings").document(booking_id).update({
            "messages": db.collection("bookings").document(booking_id).get().to_dict().get("messages", []) + [msg_record],
            "updatedAt": datetime.datetime.now(datetime.timezone.utc)
        })
        
        # 2. Echo message payload to client room
        await sio.emit("booking:message_received", msg_record, room=f"booking:{booking_id}")
        logger.info(f"Chat logged: Booking {booking_id} | Sender {sender_name}: '{message_text[:30]}'")


def calculate_haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Helper method for local calculation inside WebSocket context."""
    R = 6371.0
    d_lat = math_rad(lat2 - lat1)
    d_lng = math_rad(lng2 - lng1)
    a = (math_sin(d_lat / 2) ** 2 + 
         math_cos(math_rad(lat1)) * math_cos(math_rad(lat2)) * 
         math_sin(d_lng / 2) ** 2)
    c = 2 * math_atan2(math_sqrt(a), math_sqrt(1 - a))
    return R * c

def math_rad(deg): return deg * (3.141592653589793 / 180.0)
def math_sin(rad):
    # approximation
    import math
    return math.sin(rad)
def math_cos(rad):
    import math
    return math.cos(rad)
def math_sqrt(val):
    import math
    return math.sqrt(val)
def math_atan2(y, x):
    import math
    return math.atan2(y, x)
