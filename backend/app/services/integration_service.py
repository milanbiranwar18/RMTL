from typing import Optional

from sqlalchemy.orm import Session

from app.models.integration import Integration
from app.services import crypto_service


def _mask(value: str) -> str:
    value = str(value)
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * (len(value) - 4) + value[-4:]


def mask_credentials(credentials: dict) -> dict:
    return {k: _mask(v) for k, v in credentials.items()}


def upsert_integration(
    db: Session, user_id: int, category: str, provider: str, credentials: dict
) -> Integration:
    existing = (
        db.query(Integration)
        .filter(
            Integration.user_id == user_id,
            Integration.category == category,
            Integration.provider == provider,
        )
        .first()
    )
    encrypted = crypto_service.encrypt_dict(credentials)

    if existing:
        existing.encrypted_credentials = encrypted
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    integration = Integration(
        user_id=user_id,
        category=category,
        provider=provider,
        encrypted_credentials=encrypted,
        is_active=True,
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def list_integrations(db: Session, user_id: int):
    return db.query(Integration).filter(Integration.user_id == user_id).all()


def get_credentials(
    db: Session, user_id: int, category: str, provider: str
) -> Optional[dict]:
    """Decrypt and return raw credentials — for internal server-side use only.
    Never expose the return value of this function directly via an API response.
    """
    integration = (
        db.query(Integration)
        .filter(
            Integration.user_id == user_id,
            Integration.category == category,
            Integration.provider == provider,
            Integration.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not integration:
        return None
    return crypto_service.decrypt_dict(integration.encrypted_credentials)


def delete_integration(db: Session, user_id: int, integration_id: int) -> bool:
    integration = (
        db.query(Integration)
        .filter(Integration.id == integration_id, Integration.user_id == user_id)
        .first()
    )
    if not integration:
        return False
    db.delete(integration)
    db.commit()
    return True
