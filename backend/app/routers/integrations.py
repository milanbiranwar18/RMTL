from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.integration import Integration
from app.models.user import User
from app.schemas.integration import IntegrationCreate, IntegrationResponse
from app.services import crypto_service, integration_service
from app.services.provider_catalog import PROVIDER_CATALOG

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _to_response(integration: Integration) -> dict:
    credentials = crypto_service.decrypt_dict(integration.encrypted_credentials)
    return {
        "id": integration.id,
        "category": integration.category,
        "provider": integration.provider,
        "masked_credentials": integration_service.mask_credentials(credentials),
        "is_active": integration.is_active,
        "created_at": integration.created_at,
        "updated_at": integration.updated_at,
    }


@router.get("/catalog")
def get_catalog():
    """Every supported provider per category, with recommended defaults — drives the
    Integrations settings page on the frontend so the provider list lives in one place."""
    return PROVIDER_CATALOG


@router.get("/", response_model=List[IntegrationResponse])
def list_my_integrations(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    integrations = integration_service.list_integrations(db, current_user.id)
    return [_to_response(i) for i in integrations]


@router.post("/", response_model=IntegrationResponse)
def save_integration(
    payload: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.category not in PROVIDER_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown category '{payload.category}'")

    valid_providers = {p["id"] for p in PROVIDER_CATALOG[payload.category]}
    if payload.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{payload.provider}' for category '{payload.category}'",
        )

    if not payload.credentials or not any(str(v).strip() for v in payload.credentials.values()):
        raise HTTPException(status_code=400, detail="Credentials cannot be empty")

    integration = integration_service.upsert_integration(
        db, current_user.id, payload.category, payload.provider, payload.credentials
    )
    return _to_response(integration)


@router.delete("/{integration_id}")
def remove_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = integration_service.delete_integration(db, current_user.id, integration_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True}
