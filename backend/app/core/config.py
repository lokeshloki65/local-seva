import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

class Settings(BaseSettings):
    # App General Settings
    APP_NAME: str = "ServaLocal API"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # CORS Configuration
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "https://servalocal-prod.firebaseapp.com"]
    
    # Firebase configuration
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = Field(None, description="Stringified service account JSON or path to it")
    
    # AI - OpenAI GPT-4o
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key is required")
    
    # SMS alerts (Twilio)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    
    # Email Delivery (SendGrid)
    SENDGRID_API_KEY: Optional[str] = None
    SENDGRID_FROM_EMAIL: str = "noreply@servalocal.com"
    
    # Caching & Queue (Redis)
    REDIS_URL: str = Field("redis://localhost:6379/0", description="Redis connection string")
    
    # Video Consultations
    DAILY_CO_API_KEY: Optional[str] = None
    
    # JWT security settings
    JWT_SECRET_KEY: str = "servalocal-super-secret-jwt-key-2026-dynamic"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Load from environment variables
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("OPENAI_API_KEY")
    @classmethod
    def validate_openai_key(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("OPENAI_API_KEY must be a valid key and cannot be empty.")
        return v

# Instantiate settings
settings = Settings(_env_file=".env")
