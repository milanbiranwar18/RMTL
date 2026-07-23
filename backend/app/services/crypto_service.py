"""Encrypt/decrypt BYOK provider credentials at rest.

Every provider credential set (API key, account SID, tokens, phone numbers, etc.) is
serialized to JSON and encrypted as a single blob with Fernet (symmetric, authenticated
encryption) before being stored in the `integrations.encrypted_credentials` column.
Plaintext credentials must never be written to the database or logs.
"""
import json
import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

# backend/.encryption_key — sibling of the app/ package, gitignored.
_KEY_FILE = Path(__file__).resolve().parent.parent.parent / ".encryption_key"


def _load_or_create_key() -> bytes:
    env_key = (settings.ENCRYPTION_KEY or os.environ.get("ENCRYPTION_KEY", "")).strip()
    if env_key:
        return env_key.encode()

    if _KEY_FILE.exists():
        return _KEY_FILE.read_bytes().strip()

    key = Fernet.generate_key()
    try:
        _KEY_FILE.write_bytes(key)
        logger.warning(
            f"No ENCRYPTION_KEY configured — generated a new one and saved it to {_KEY_FILE}. "
            "Set ENCRYPTION_KEY explicitly in production so encrypted data survives redeploys."
        )
    except OSError as e:
        logger.error(f"Could not persist auto-generated encryption key to disk: {e}")
    return key


_fernet = Fernet(_load_or_create_key())


def encrypt_dict(data: dict) -> str:
    return _fernet.encrypt(json.dumps(data).encode()).decode()


def decrypt_dict(token: str) -> dict:
    try:
        return json.loads(_fernet.decrypt(token.encode()).decode())
    except InvalidToken:
        logger.error("Failed to decrypt credentials — encryption key may have changed.")
        raise
