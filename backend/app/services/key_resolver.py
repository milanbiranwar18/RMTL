"""Resolves the actual credential to use for one (agent, provider) pair, honoring the full BYOK
precedence chain that the Agent forms promise in the UI ("Use platform default" vs "Use my own
key"):

    1. The agent's own explicit key field — set only when the user flipped the toggle to
       "Use my own key" and typed one in, for THIS agent specifically.
    2. The owning user's saved credential in their account-wide Integrations vault — this is
       what "platform default" actually means for a logged-in BYOK user: the key they connected
       once on the Integrations page, reused across every agent they own.
    3. The platform-wide fallback key from the backend's own .env — a demo/dev convenience so a
       fresh install still works before anyone has connected anything.

Step 2 deliberately checks the *same provider id across all three categories* (llm/stt/tts),
not just the exact category being resolved. Providers like Sarvam or Deepgram sell one account
key that authenticates every one of their endpoints (chat, transcription, speech) — asking a
user to paste the identical key into three separate Integrations cards would be pure friction for
no security benefit. See AGENT_CHANGELOG.md for the reasoning.
"""
import logging

from app.database import SessionLocal
from app.services import integration_service

logger = logging.getLogger(__name__)

_ALL_CATEGORIES = ("llm", "stt", "tts")


def _lookup_vault_key(user_id: int, provider_id: str) -> str:
    if not user_id:
        return ""
    db = SessionLocal()
    try:
        for category in _ALL_CATEGORIES:
            creds = integration_service.get_credentials(db, user_id, category, provider_id)
            if creds:
                key = creds.get("api_key") or next((v for v in creds.values() if v), None)
                if key:
                    return key
        return ""
    except Exception as e:
        logger.warning(f"Integrations vault lookup failed for user_id={user_id} provider={provider_id}: {e}")
        return ""
    finally:
        db.close()


def resolve_key(agent, own_key_field: str, provider_id: str, platform_key: str = "") -> str:
    """`own_key_field` is the Agent column (e.g. 'sarvam_api_key') the user's per-agent override,
    if any, lives in. `provider_id` is the vendor id as used in provider_catalog.py (e.g.
    'openai', 'sarvam', 'deepgram') — used to look up the owner's Integrations vault."""
    own = getattr(agent, own_key_field, None) if agent else None
    if own and str(own).strip():
        return str(own).strip()

    user_id = getattr(agent, "user_id", None) if agent else None
    vault_key = _lookup_vault_key(user_id, provider_id)
    if vault_key:
        return vault_key

    return platform_key or ""
