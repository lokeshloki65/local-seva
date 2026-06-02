import logging
from app.tasks.celery_app import celery_app
from app.services.notification_service import notification_service
from app.core.firebase import db

logger = logging.getLogger("servalocal.tasks.notifications")

@celery_app.task(name="tasks.send_async_sms")
def send_async_sms(phone: str, body: str) -> bool:
    """Task to send Twilio SMS in background."""
    logger.info(f"Triggering background SMS dispatch to {phone}")
    return notification_service.send_sms(to_phone=phone, message_body=body)

@celery_app.task(name="tasks.send_async_email")
def send_async_email(email: str, subject: str, html_body: str) -> bool:
    """Task to send SendGrid email in background."""
    logger.info(f"Triggering background email dispatch to {email}")
    return notification_service.send_email(to_email=email, subject=subject, html_content=html_body)

@celery_app.task(name="tasks.send_async_push")
def send_async_push(user_id: str, title: str, body: str, data: dict = None) -> bool:
    """Task to fetch user FCM tokens and broadcast push notification."""
    logger.info(f"Triggering background FCM Push dispatch to user {user_id}")
    try:
        user_ref = db.collection("users").document(user_id).get()
        if not user_ref.exists:
            return False
            
        user_data = user_ref.to_dict()
        tokens = user_data.get("fcmTokens", [])
        
        success = False
        for token in tokens:
            if notification_service.send_push(token=token, title=title, body=body, data=data):
                success = True
        return success
    except Exception as e:
        logger.error(f"Failed in async push task: {e}")
        return False
