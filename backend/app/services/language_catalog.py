"""Single source of truth for every spoken language an agent can be configured to use.

The frontend fetches this via `GET /agents/languages` (mirrors how `provider_catalog.py`
feeds the Integrations page) instead of hardcoding its own list, so backend and frontend
never drift apart again.

Codes for Indian languages intentionally match Sarvam AI's own language codes exactly, so
a Sarvam-backed agent's STT/TTS calls can use `agent.language` directly with zero translation.
For any other language, Sarvam isn't supported (it's an India-focused provider) — `sarvam_code_for()`
below falls back to Hindi rather than failing outright.
"""

INDIA_LANGUAGES = [
    {"code": "hi-IN", "name": "Hindi"},
    {"code": "en-IN", "name": "English (India)"},
    {"code": "bn-IN", "name": "Bengali"},
    {"code": "ta-IN", "name": "Tamil"},
    {"code": "te-IN", "name": "Telugu"},
    {"code": "kn-IN", "name": "Kannada"},
    {"code": "ml-IN", "name": "Malayalam"},
    {"code": "mr-IN", "name": "Marathi"},
    {"code": "gu-IN", "name": "Gujarati"},
    {"code": "or-IN", "name": "Odia"},
    {"code": "pa-IN", "name": "Punjabi"},
]

GLOBAL_LANGUAGES = [
    {"code": "en-US", "name": "English (US)"},
    {"code": "en-GB", "name": "English (UK)"},
    {"code": "es-ES", "name": "Spanish"},
    {"code": "fr-FR", "name": "French"},
    {"code": "de-DE", "name": "German"},
    {"code": "it-IT", "name": "Italian"},
    {"code": "pt-BR", "name": "Portuguese (Brazil)"},
    {"code": "nl-NL", "name": "Dutch"},
    {"code": "zh-CN", "name": "Chinese (Mandarin)"},
    {"code": "ja-JP", "name": "Japanese"},
    {"code": "ko-KR", "name": "Korean"},
    {"code": "ar-SA", "name": "Arabic"},
    {"code": "ru-RU", "name": "Russian"},
    {"code": "tr-TR", "name": "Turkish"},
    {"code": "vi-VN", "name": "Vietnamese"},
    {"code": "id-ID", "name": "Indonesian"},
    {"code": "th-TH", "name": "Thai"},
    {"code": "pl-PL", "name": "Polish"},
]

LANGUAGE_GROUPS = [
    {"group": "India", "languages": INDIA_LANGUAGES},
    {"group": "Global", "languages": GLOBAL_LANGUAGES},
]

_ALL_LANGUAGES = INDIA_LANGUAGES + GLOBAL_LANGUAGES
_NAME_BY_CODE = {lang["code"]: lang["name"] for lang in _ALL_LANGUAGES}
_SARVAM_COMPATIBLE_CODES = {lang["code"] for lang in INDIA_LANGUAGES}

DEFAULT_LANGUAGE_CODE = "en-US"


def language_name(code: str) -> str:
    """Human-readable name for a language code, used in the LLM's "respond in X" instruction."""
    return _NAME_BY_CODE.get(code, _NAME_BY_CODE[DEFAULT_LANGUAGE_CODE])


def sarvam_code_for(code: str) -> str:
    """Best-effort Sarvam-compatible code for the given language; Hindi is the safe fallback
    since Sarvam only covers Indian languages."""
    return code if code in _SARVAM_COMPATIBLE_CODES else "hi-IN"


def is_sarvam_compatible(code: str) -> bool:
    return code in _SARVAM_COMPATIBLE_CODES
