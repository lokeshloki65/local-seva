import os
from celery import Celery
from app.core.config import settings

# Initialize Celery app instance
celery_app = Celery(
    "servalocal_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Configuration overrides
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    imports=(
        "app.tasks.notification_tasks",
        "app.tasks.forecast_tasks"
    )
)
