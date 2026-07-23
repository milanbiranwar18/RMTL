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
    
    # LLM & Voice Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    SARVAM_API_KEY: str = ""
    
    # Twilio (platform-wide fallback — prefer each user's own Twilio Integration instead)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Publicly reachable base URL for this backend (e.g. an ngrok tunnel in dev, or your real
    # domain in prod). Telephony providers (Twilio/Exotel/etc.) call back into our own
    # `/calls/{id}/twiml` + `/calls/{id}/stream` endpoints over the public internet — they can
    # never reach `localhost`, so this must be set for outbound calling to actually work.
    PUBLIC_BASE_URL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
