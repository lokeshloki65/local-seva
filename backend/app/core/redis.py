import redis
import logging
from app.core.config import settings

logger = logging.getLogger("servalocal.redis")

try:
    # Initialize connection pool
    redis_pool = redis.ConnectionPool.from_url(
        settings.REDIS_URL, 
        max_connections=20, 
        decode_responses=True
    )
    redis_client = redis.Redis(connection_pool=redis_pool)
    
    # Ping Redis to test connection
    redis_client.ping()
    logger.info("Connected to Redis server successfully.")
except Exception as e:
    logger.error(f"Failed to connect to Redis server at {settings.REDIS_URL}: {e}")
    # Fallback to dummy or mock client to prevent crash in mock environments
    class MockRedis:
        def __init__(self):
            self.store = {}
        def get(self, key): return self.store.get(key)
        def set(self, key, val, ex=None): self.store[key] = val; return True
        def delete(self, key): self.store.pop(key, None); return True
        def ping(self): return True
    redis_client = MockRedis()
