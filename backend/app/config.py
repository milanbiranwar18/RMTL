from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost/dbname"
    SECRET_KEY: str = "your-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Symmetric key (Fernet, 32 url-safe base64 bytes) used to encrypt BYOK provider
    # credentials at rest. If left empty, a key is auto-generated on first run and
    # persisted to backend/.encryption_key for dev convenience — see crypto_service.py.
    # In production, set this explicitly via env var / secret manager instead.
    ENCRYPTION_KEY: str = ""
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "rmtl-bucket"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    SARVAM_API_KEY: str = ""
    
    # STT Providers
    DEEPGRAM_API_KEY: str = ""
    
    # TTS Providers
    ELEVENLABS_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""
    
    # Telephony Providers - Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # Telephony Providers - Exotel
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_SID: str = ""
    EXOTEL_SUBDOMAIN: str = ""
    EXOTEL_CALLER_ID: str = ""
    EXOTEL_SIP_USERNAME: str = ""
    EXOTEL_SIP_PASSWORD: str = ""
    EXOTEL_SIP_HOST: str = ""
    
    # Telephony Providers - Plivo
    PLIVO_AUTH_ID: str = ""
    PLIVO_AUTH_TOKEN: str = ""
    
    # Telephony Providers - Bandwidth
    BANDWIDTH_ACCOUNT_ID: str = ""
    BANDWIDTH_USERNAME: str = ""
    BANDWIDTH_PASSWORD: str = ""
    
    # WhatsApp Providers - Exotel
    EXOTEL_WHATSAPP_NUMBER: str = ""
    EXOTEL_API_TOKEN: str = ""
    
    # WhatsApp Providers - AISENSY (Popular in India)
    AISENSY_API_KEY: str = ""
    
    # WhatsApp Providers - Gupshup
    GUPSHUP_API_KEY: str = ""
    GUPSHUP_APP_NAME: str = ""
    
    # WhatsApp Providers - 360Dialog (Official WhatsApp BSP)
    DIALOG360_API_KEY: str = ""
    
    # WhatsApp Providers - Interakt
    INTERAKT_API_KEY: str = ""
    
    # Email/SMTP Configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    
    # OAuth Configuration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/google/callback"

    # Publicly reachable base URL for this backend (e.g. an ngrok tunnel in dev, or your real
    # domain in prod). Telephony providers (Twilio/Exotel/etc.) call back into our own
    # `/calls/{id}/twiml` + `/calls/{id}/stream` endpoints over the public internet — they can
    # never reach `localhost`, so this must be set for outbound calling to actually work.
    PUBLIC_BASE_URL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
