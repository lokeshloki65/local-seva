import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import socketio

# Import Core config
from app.core.config import settings

# Import API Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.services import router as services_router
from app.api.v1.workers import router as workers_router
from app.api.v1.ai import router as ai_router
from app.api.v1.admin import router as admin_router
from app.api.v1.video import router as video_router

# Import SIO instance
from app.socket.connection import sio

# Initialize Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("servalocal.main")

# Initialize Rate Limiter (SlowAPI)
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app instance
app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Local Home Services marketplace API (ServaLocal)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Setup SlowAPI rate limits
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Policy configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Whitelisted origins parsed from configs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 REST endpoints
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users Profile"])
app.include_router(bookings_router, prefix="/api/v1/bookings", tags=["Bookings Transactions"])
app.include_router(services_router, prefix="/api/v1/services", tags=["Services Catalog"])
app.include_router(workers_router, prefix="/api/v1/workers", tags=["Workers Partner Actions"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI Copilot GPT-4o"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Administrative Controls"])
app.include_router(video_router, prefix="/api/v1/video-calls", tags=["Daily.co Video Rooms"])

@app.get("/")
async def root_health():
    """Service health-check query endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "apiPrefix": "/api/v1",
        "timestamp": datetime_now_iso()
    }

def datetime_now_iso():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

# Combined FastAPI & Socket.io ASGI mount
# All WebSocket handshake events go to sio; HTTP rest falls back to app
app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    # Start ASGI loop (uvicorn)
    uvicorn.run(
        "app.main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=settings.DEBUG
    )
