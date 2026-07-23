"""Dispatches an outbound call to whichever telephony provider the calling Agent is
configured to use, with credentials resolved from the calling user's Integrations vault.

- **Twilio**: fully wired end-to-end. The call's callback URL points at our own
  `/calls/{id}/twiml`, which returns TwiML connecting the call to our own
  `/calls/{id}/stream` websocket — so a Twilio call actually talks to our AI voice pipeline.
- **Exotel**: requires one manual one-time step in the *user's own* Exotel dashboard — build a
  Flow with a Voicebot/Stream applet pointed at `wss://<PUBLIC_BASE_URL>/calls/{id}/stream`,
  and save that Flow's App ID as `app_id`. Exotel's Connect API only accepts pre-configured
  Flow URLs, not arbitrary external URLs — see
  https://docs.exotel.com/exotel-agentstream/connect-voice-ai-with-flow-api
- **Telnyx / Plivo / Vonage**: not implemented yet — returns a clear error instead of silently
  pretending to place the call.
"""

import logging
import httpx
from twilio.rest import Client as TwilioClient

from app.config import settings

logger = logging.getLogger(__name__)

UNSUPPORTED_PROVIDERS = {"telnyx", "plivo", "vonage"}


def _twiml_url(call_id: int) -> str:
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/calls/{call_id}/twiml"


def _status_callback_url(call_id: int) -> str:
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/calls/{call_id}/status"


def initiate_twilio_call(call_id: int, to_phone: str, credentials: dict) -> dict:
    account_sid = credentials.get("account_sid") or credentials.get("account_sid".upper())
    auth_token = credentials.get("auth_token")
    from_number = credentials.get("phone_number")
    if not (account_sid and auth_token and from_number):
        return {"success": False, "error": "Missing Twilio Account SID / Auth Token / Phone Number."}
    if not settings.PUBLIC_BASE_URL:
        return {
            "success": False,
            "error": (
                "PUBLIC_BASE_URL is not configured on the backend — Twilio can't reach "
                "localhost to fetch call instructions. Set PUBLIC_BASE_URL to a publicly "
                "reachable URL (e.g. an ngrok tunnel) in the backend .env, then try again."
            ),
        }
    try:
        client = TwilioClient(account_sid, auth_token)
        call = client.calls.create(
            to=to_phone,
            from_=from_number,
            url=_twiml_url(call_id),
            status_callback=_status_callback_url(call_id),
        )
        logger.info(f"Twilio call initiated: sid={call.sid} status={call.status}")
        return {"success": True, "call_sid": call.sid, "status": call.status}
    except Exception as e:
        logger.error(f"Twilio call failed: {e}")
        return {"success": False, "error": str(e)}


def initiate_exotel_call(call_id: int, to_phone: str, credentials: dict) -> dict:
    api_key = credentials.get("api_key")
    token = credentials.get("token")
    sid = credentials.get("sid")
    subdomain = credentials.get("subdomain") or "api.exotel.com"
    virtual_number = credentials.get("virtual_number")
    app_id = credentials.get("app_id")

    if not (api_key and token and sid and virtual_number and app_id):
        return {
            "success": False,
            "error": (
                "Missing Exotel API Key / API Token / Account SID / ExoPhone / Voicebot Flow App ID. "
                "The App ID comes from a Voicebot Flow you build once in your Exotel dashboard, "
                f"pointed at wss://<your-domain>/calls/{call_id}/stream — see "
                "docs.exotel.com/exotel-agentstream/connect-voice-ai-with-flow-api."
            ),
        }
    try:
        url = f"https://{subdomain}/v1/Accounts/{sid}/Calls/connect"
        data = {
            "From": to_phone,
            "CallerId": virtual_number,
            "Url": f"http://my.exotel.com/{sid}/exoml/start_voice/{app_id}",
            "StatusCallback": _status_callback_url(call_id) if settings.PUBLIC_BASE_URL else None,
        }
        data = {k: v for k, v in data.items() if v}
        resp = httpx.post(url, data=data, auth=(api_key, token), timeout=15)
        resp.raise_for_status()
        logger.info(f"Exotel call initiated for call_id={call_id}")
        return {"success": True, "raw": resp.text[:500]}
    except Exception as e:
        logger.error(f"Exotel call failed: {e}")
        return {"success": False, "error": str(e)}


def initiate_call(provider: str, call_id: int, to_phone: str, credentials: dict) -> dict:
    if provider == "twilio":
        return initiate_twilio_call(call_id, to_phone, credentials or {})
    if provider == "exotel":
        return initiate_exotel_call(call_id, to_phone, credentials or {})
    if provider in UNSUPPORTED_PROVIDERS:
        return {
            "success": False,
            "error": (
                f"{provider.title()} isn't wired up for outbound calling yet — Twilio and Exotel "
                "are supported today. Save your key in Integrations and switch this agent's "
                "Telephony provider to one of those."
            ),
        }
    return {"success": False, "error": f"Unknown telephony provider '{provider}'"}
