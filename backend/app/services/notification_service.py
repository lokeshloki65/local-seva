import logging
import os
from typing import Optional, Dict, Any
from twilio.rest import Client as TwilioClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from firebase_admin import messaging
from app.core.config import settings

logger = logging.getLogger("servalocal.notifications")

class NotificationService:
    def __init__(self):
        # Initialize Twilio
        self.twilio_enabled = all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER])
        if self.twilio_enabled:
            try:
                self.twilio_client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            except Exception as e:
                logger.error(f"Failed to initialize Twilio: {e}")
                self.twilio_enabled = False
        else:
            logger.info("Twilio SMS credentials missing. SMS service running in log-only mode.")

        # Initialize SendGrid
        self.sendgrid_enabled = bool(settings.SENDGRID_API_KEY)
        if self.sendgrid_enabled:
            try:
                self.sg_client = SendGridAPIClient(settings.SENDGRID_API_KEY)
            except Exception as e:
                logger.error(f"Failed to initialize SendGrid: {e}")
                self.sendgrid_enabled = False
        else:
            logger.info("SendGrid email credentials missing. Email service running in log-only mode.")

    def send_push(self, token: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> bool:
        """Sends a Firebase Cloud Messaging push notification to a device token."""
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                token=token
            )
            response = messaging.send(message)
            logger.info(f"FCM Push sent successfully. Message ID: {response}")
            return True
        except Exception as e:
            logger.error(f"Failed to send FCM Push: {e}")
            return False

    def send_sms(self, to_phone: str, message_body: str) -> bool:
        """Sends an SMS alert using Twilio or logs it if keys are missing."""
        if self.twilio_enabled:
            try:
                msg = self.twilio_client.messages.create(
                    body=message_body,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=to_phone
                )
                logger.info(f"SMS sent via Twilio to {to_phone}. Msg SID: {msg.sid}")
                return True
            except Exception as e:
                logger.error(f"Twilio API Error sending to {to_phone}: {e}")
                return False
        else:
            logger.info(f"[SMS LOG MOCK] TO: {to_phone} | BODY: {message_body}")
            return True

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Sends an email alert using SendGrid or logs it if keys are missing."""
        if self.sendgrid_enabled:
            try:
                message = Mail(
                    from_email=settings.SENDGRID_FROM_EMAIL,
                    to_emails=to_email,
                    subject=subject,
                    html_content=html_content
                )
                response = self.sg_client.send(message)
                logger.info(f"Email sent via SendGrid to {to_email}. Status code: {response.status_code}")
                return True
            except Exception as e:
                logger.error(f"SendGrid API Error sending to {to_email}: {e}")
                return False
        else:
            logger.info(f"[EMAIL LOG MOCK] TO: {to_email} | SUBJECT: {subject} | CONTENT: {html_content[:150]}...")
            return True

    def broadcast_to_topic(self, topic: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> bool:
        """Sends FCM push to a broad target segment (e.g. 'workers', 'all')."""
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                topic=topic
            )
            response = messaging.send(message)
            logger.info(f"Broadcast to topic '{topic}' sent successfully. Msg ID: {response}")
            return True
        except Exception as e:
            logger.error(f"FCM Topic Broadcast failed: {e}")
            return False

notification_service = NotificationService()
