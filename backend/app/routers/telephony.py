import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from twilio.rest import Client as TwilioClient

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import integration_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telephony", tags=["telephony"])


def _get_user_twilio_credentials(db: Session, user: User) -> dict:
    creds = integration_service.get_credentials(db, user.id, "telephony", "twilio")
    if not creds or not creds.get("account_sid") or not creds.get("auth_token"):
        raise HTTPException(
            status_code=400,
            detail="Save your Twilio Account SID + Auth Token in Integrations first, then come back to search/buy a number.",
        )
    return creds


@router.get("/twilio/available-numbers")
def search_twilio_numbers(
    country: str = Query("US", description="ISO country code, e.g. US, GB, IN"),
    area_code: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for purchasable Twilio local numbers using the current user's own saved
    Twilio credentials (never the platform-wide key)."""
    creds = _get_user_twilio_credentials(db, current_user)
    try:
        client = TwilioClient(creds["account_sid"], creds["auth_token"])
        kwargs = {"limit": 10}
        if area_code:
            kwargs["area_code"] = area_code
        numbers = client.available_phone_numbers(country).local.list(**kwargs)
        return [
            {
                "phone_number": n.phone_number,
                "friendly_name": n.friendly_name,
                "locality": getattr(n, "locality", None),
                "region": getattr(n, "region", None),
            }
            for n in numbers
        ]
    except Exception as e:
        logger.error(f"Twilio number search failed: {e}")
        raise HTTPException(status_code=400, detail=f"Twilio number search failed: {e}")


class BuyNumberRequest(BaseModel):
    phone_number: str


@router.post("/twilio/buy-number")
def buy_twilio_number(
    payload: BuyNumberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Purchases the given Twilio number for the current user and saves it back onto their
    Twilio Integration record, so agents using the 'twilio' telephony provider immediately
    start calling from it."""
    creds = _get_user_twilio_credentials(db, current_user)
    try:
        client = TwilioClient(creds["account_sid"], creds["auth_token"])
        purchased = client.incoming_phone_numbers.create(phone_number=payload.phone_number)
    except Exception as e:
        logger.error(f"Twilio number purchase failed: {e}")
        raise HTTPException(status_code=400, detail=f"Twilio number purchase failed: {e}")

    creds["phone_number"] = purchased.phone_number
    integration_service.upsert_integration(db, current_user.id, "telephony", "twilio", creds)
    return {"phone_number": purchased.phone_number, "sid": purchased.sid}
