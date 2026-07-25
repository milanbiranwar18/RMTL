"""Dispatches an outbound call to whichever telephony provider the calling Agent is
configured to use, with credentials resolved from the calling user's Integrations vault.

- **Twilio**: fully wired end-to-end. The call's callback URL points at our own
  `/calls/{id}/twiml`, which returns TwiML connecting the call to our own
  `/calls/{id}/stream` websocket (per-call URL, since Twilio fetches TwiML fresh for every
  call) — so a Twilio call actually talks to our AI voice pipeline.
- **Exotel**: fundamentally different shape from Twilio. A Voicebot/Stream Applet's WebSocket
  URL is baked into a Flow *once*, in the user's own Exotel dashboard (App Bazaar) — it is
  **not** re-fetched per call like Twilio's TwiML, so it can never contain our internal
  `call_id`. Instead, the applet must point at our *generic* `wss://<PUBLIC_BASE_URL>/calls/exotel/stream`
  endpoint, and we identify which `Call` row a given websocket connection belongs to by
  matching the `call_sid` Exotel reports in its `start` event against `Call.provider_call_sid`
  — which we capture right here, synchronously, from the Connect API's JSON response
  (`{"Call": {"Sid": "..."}}`). See
  https://developer.exotel.com/docs/voice-v1/quickstart and
  https://developer.exotel.com/docs/agentstream/stream-voicebot-applet
- **Telnyx**: like Twilio, the per-call `stream_url` (and `webhook_url`) can be set directly
  on the Dial request itself — no static-URL workaround needed. Bidirectional Media Streaming
  is requested at Dial-time (`stream_bidirectional_mode=rtp`), see
  https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming and the
  WebSocket schema at
  https://developers.telnyx.com/api-reference/websockets/stream-call-media-over-websocket
- **Plivo**: same shape as Twilio — `answer_url` is fetched fresh per call, so it carries our
  `call_id`; that endpoint returns Plivo XML with a bidirectional `<Stream>` element pointing
  back at our own per-call websocket. See
  https://plivo.com/docs/voice-agents/audio-streaming/overview
- **Vonage**: authenticates via a short-lived JWT signed with a Voice Application's RSA
  private key (not the account API key/secret) — see
  https://developer.vonage.com/en/voice/voice-api/guides/private-key. We pass the call's NCCO
  directly in the create-call body (rather than a fetched `answer_url`) with a `connect`
  action of type `websocket`, so it can point straight at our per-call stream endpoint. See
  https://developer.vonage.com/en/voice/voice-api/concepts/websockets — audio there is raw
  16-bit/16kHz PCM binary frames with **no** JSON envelope, unlike the other three providers.
"""

import json
import logging
import time
import uuid

import httpx
from twilio.rest import Client as TwilioClient
from jose import jwt as jose_jwt

from app.config import settings

logger = logging.getLogger(__name__)

UNSUPPORTED_PROVIDERS: set = set()


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
        return {"success": True, "call_sid": call.sid, "provider_call_sid": call.sid, "status": call.status}
    except Exception as e:
        logger.error(f"Twilio call failed: {e}")
        return {"success": False, "error": str(e)}


def exotel_stream_url() -> str:
    """The single, static WebSocket URL every Exotel user pastes into their Voicebot Applet
    once, in their own Exotel dashboard Flow. Not per-call — see module docstring."""
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    scheme = "wss" if base.startswith("https://") else "ws"
    host = base.split("://", 1)[-1]
    return f"{scheme}://{host}/calls/exotel/stream"


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
                "The App ID comes from a Voicebot Flow you build once in your Exotel dashboard "
                "(App Bazaar) whose Voicebot Applet points at "
                f"{exotel_stream_url() if settings.PUBLIC_BASE_URL else 'wss://<your-domain>/calls/exotel/stream'} "
                "— see docs.exotel.com/exotel-agentstream/stream-voicebot-applet."
            ),
        }
    try:
        # `.json` suffix asks Exotel for a JSON body (`{"Call": {"Sid": ...}}`) instead of XML —
        # we need that Sid to route the Voicebot Applet's websocket `start` event back to this
        # call once the bidirectional stream connects (see exotel_stream_url() above).
        url = f"https://{subdomain}/v1/Accounts/{sid}/Calls/connect.json"
        data = {
            "From": to_phone,
            "CallerId": virtual_number,
            "Url": f"http://my.exotel.com/{sid}/exoml/start_voice/{app_id}",
            "StatusCallback": _status_callback_url(call_id) if settings.PUBLIC_BASE_URL else None,
        }
        data = {k: v for k, v in data.items() if v}
        resp = httpx.post(url, data=data, auth=(api_key, token), timeout=15, headers={"Accept": "application/json"})
        resp.raise_for_status()
        provider_call_sid = None
        try:
            body = resp.json()
            provider_call_sid = (body.get("Call") or {}).get("Sid")
        except Exception:
            logger.warning(f"Exotel response for call_id={call_id} wasn't JSON — can't auto-route the Voicebot stream: {resp.text[:300]}")
        logger.info(f"Exotel call initiated for call_id={call_id}, provider_call_sid={provider_call_sid}")
        return {"success": True, "provider_call_sid": provider_call_sid, "raw": resp.text[:500]}
    except Exception as e:
        logger.error(f"Exotel call failed: {e}")
        return {"success": False, "error": str(e)}


def _require_public_base_url() -> str:
    if not settings.PUBLIC_BASE_URL:
        raise ValueError(
            "PUBLIC_BASE_URL is not configured on the backend — this provider needs a publicly "
            "reachable URL to call back (e.g. an ngrok tunnel in dev). Set it in the backend .env."
        )
    return settings.PUBLIC_BASE_URL.rstrip("/")


def _ws_url(path: str) -> str:
    base = _require_public_base_url()
    scheme = "wss" if base.startswith("https://") else "ws"
    host = base.split("://", 1)[-1]
    return f"{scheme}://{host}{path}"


def initiate_telnyx_call(call_id: int, to_phone: str, credentials: dict) -> dict:
    api_key = credentials.get("api_key")
    connection_id = credentials.get("connection_id")
    from_number = credentials.get("phone_number")
    if not (api_key and connection_id and from_number):
        return {
            "success": False,
            "error": (
                "Missing Telnyx API Key / Connection ID / Phone Number. The Connection ID comes "
                "from a Call Control Application you create once in the Telnyx portal — see "
                "developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals."
            ),
        }
    try:
        base = _require_public_base_url()
    except ValueError as e:
        return {"success": False, "error": str(e)}
    try:
        resp = httpx.post(
            "https://api.telnyx.com/v2/calls",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "connection_id": connection_id,
                "to": to_phone,
                "from": from_number,
                "webhook_url": f"{base}/calls/{call_id}/telnyx/webhook",
                # Requested directly at Dial-time (no separate "answer" webhook round-trip needed,
                # unlike Twilio/Plivo) — see module docstring for the WS message schema this opens.
                "stream_url": _ws_url(f"/calls/{call_id}/telnyx/stream"),
                "stream_track": "both_tracks",
                "stream_bidirectional_mode": "rtp",
                "stream_bidirectional_codec": "PCMU",
                "stream_bidirectional_sampling_rate": 8000,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        call_control_id = data.get("call_control_id")
        logger.info(f"Telnyx call initiated for call_id={call_id}, call_control_id={call_control_id}")
        return {"success": True, "provider_call_sid": call_control_id}
    except Exception as e:
        logger.error(f"Telnyx call failed: {e}")
        return {"success": False, "error": str(e)}


def initiate_plivo_call(call_id: int, to_phone: str, credentials: dict) -> dict:
    auth_id = credentials.get("auth_id")
    auth_token = credentials.get("auth_token")
    from_number = credentials.get("phone_number")
    if not (auth_id and auth_token and from_number):
        return {"success": False, "error": "Missing Plivo Auth ID / Auth Token / Phone Number."}
    try:
        base = _require_public_base_url()
    except ValueError as e:
        return {"success": False, "error": str(e)}
    try:
        resp = httpx.post(
            f"https://api.plivo.com/v1/Account/{auth_id}/Call/",
            auth=(auth_id, auth_token),
            json={
                "from": from_number,
                "to": to_phone,
                # Plivo fetches this fresh per call (like Twilio's TwiML URL), so it can carry
                # our own call_id straight through to the per-call stream endpoint.
                "answer_url": f"{base}/calls/{call_id}/plivo/answer",
                "answer_method": "GET",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        provider_call_sid = data.get("request_uuid")
        logger.info(f"Plivo call initiated for call_id={call_id}, request_uuid={provider_call_sid}")
        return {"success": True, "provider_call_sid": provider_call_sid}
    except Exception as e:
        logger.error(f"Plivo call failed: {e}")
        return {"success": False, "error": str(e)}


def _vonage_jwt(application_id: str, private_key: str) -> str:
    """Vonage's Voice API authenticates via a short-lived JWT signed with the Voice
    Application's own RSA private key — NOT the account-wide API key/secret used by Vonage's
    other APIs. See https://developer.vonage.com/en/voice/voice-api/guides/private-key."""
    now = int(time.time())
    claims = {
        "application_id": application_id,
        "iat": now,
        "exp": now + 60,
        "jti": str(uuid.uuid4()),
    }
    return jose_jwt.encode(claims, private_key, algorithm="RS256")


def initiate_vonage_call(call_id: int, to_phone: str, credentials: dict) -> dict:
    application_id = credentials.get("application_id")
    private_key = credentials.get("private_key")
    from_number = credentials.get("phone_number")
    if not (application_id and private_key and from_number):
        return {
            "success": False,
            "error": (
                "Missing Vonage Application ID / Private Key / Phone Number. Both come from a "
                "Voice Application you create once in the Vonage dashboard — see "
                "developer.vonage.com/en/voice/voice-api/guides/private-key."
            ),
        }
    try:
        token = _vonage_jwt(application_id, private_key)
    except Exception as e:
        return {"success": False, "error": f"Failed to sign Vonage JWT — check the private key is a valid PEM: {e}"}
    try:
        stream_ws = _ws_url(f"/calls/{call_id}/vonage/stream")
    except ValueError as e:
        return {"success": False, "error": str(e)}
    try:
        resp = httpx.post(
            "https://api.nexmo.com/v1/calls",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "to": [{"type": "phone", "number": to_phone.lstrip("+")}],
                "from": {"type": "phone", "number": from_number.lstrip("+")},
                # NCCO passed inline (call_id already known — see call_service.create_call)
                # instead of a fetched answer_url, so it can point straight at our own
                # per-call websocket without a second round-trip.
                "ncco": [
                    {
                        "action": "connect",
                        "endpoint": [
                            {"type": "websocket", "uri": stream_ws, "content-type": "audio/l16;rate=16000"}
                        ],
                    }
                ],
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        provider_call_sid = data.get("uuid")
        logger.info(f"Vonage call initiated for call_id={call_id}, uuid={provider_call_sid}")
        return {"success": True, "provider_call_sid": provider_call_sid}
    except httpx.HTTPStatusError as e:
        logger.error(f"Vonage call failed: {e.response.text[:300]}")
        return {"success": False, "error": f"Vonage call failed: {e.response.text[:300]}"}
    except Exception as e:
        logger.error(f"Vonage call failed: {e}")
        return {"success": False, "error": str(e)}


def transfer_twilio_call(provider_call_sid: str, credentials: dict, target_number: str, message: str = None) -> dict:
    """Redirects an already-in-progress Twilio call to fresh TwiML that `<Dial>`s the transfer
    target — the standard "warm handoff" technique for Media Streams calls, since there's no
    way to inject a `<Dial>` directly over the stream itself. Used by the workflow builder's
    Call Transfer node; see routers/calls.py's `_perform_call_action`."""
    account_sid = credentials.get("account_sid")
    auth_token = credentials.get("auth_token")
    if not (account_sid and auth_token and provider_call_sid and target_number):
        return {"success": False, "error": "Missing Twilio Account SID/Auth Token, call SID, or transfer target number."}
    try:
        from twilio.twiml.voice_response import VoiceResponse
        client = TwilioClient(account_sid, auth_token)
        twiml = VoiceResponse()
        if message:
            twiml.say(message)
        twiml.dial(target_number)
        client.calls(provider_call_sid).update(twiml=str(twiml))
        logger.info(f"Twilio call {provider_call_sid} transferred to {target_number}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Twilio call transfer failed: {e}")
        return {"success": False, "error": str(e)}


def send_twilio_sms(credentials: dict, to_phone: str, message: str) -> dict:
    """Sends an in-call SMS via Twilio's REST API — used by the workflow builder's In-Call SMS
    node. Twilio-only for now; other providers each have their own separate SMS API that hasn't
    been wired up yet (same phased-rollout pattern as the rest of this module)."""
    account_sid = credentials.get("account_sid")
    auth_token = credentials.get("auth_token")
    from_number = credentials.get("phone_number")
    if not (account_sid and auth_token and from_number and to_phone and message):
        return {"success": False, "error": "Missing Twilio credentials, sender number, recipient phone, or message body."}
    try:
        client = TwilioClient(account_sid, auth_token)
        msg = client.messages.create(to=to_phone, from_=from_number, body=message)
        logger.info(f"Twilio SMS sent mid-call: sid={msg.sid}")
        return {"success": True, "message_sid": msg.sid}
    except Exception as e:
        logger.error(f"Twilio in-call SMS failed: {e}")
        return {"success": False, "error": str(e)}


def initiate_call(provider: str, call_id: int, to_phone: str, credentials: dict) -> dict:
    if provider == "twilio":
        return initiate_twilio_call(call_id, to_phone, credentials or {})
    if provider == "exotel":
        return initiate_exotel_call(call_id, to_phone, credentials or {})
    if provider == "telnyx":
        return initiate_telnyx_call(call_id, to_phone, credentials or {})
    if provider == "plivo":
        return initiate_plivo_call(call_id, to_phone, credentials or {})
    if provider == "vonage":
        return initiate_vonage_call(call_id, to_phone, credentials or {})
    return {"success": False, "error": f"Unknown telephony provider '{provider}'"}
