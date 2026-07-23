"""Single source of truth for every BYOK provider we support, per category.

The frontend fetches this via GET /integrations/catalog to render the Integrations page
(provider cards, "Recommended" badges, and the right input fields per provider) without
duplicating this list in JS. The backend also uses it to validate incoming credentials.
"""

_API_KEY_FIELD = [{"key": "api_key", "label": "API Key", "type": "password"}]

PROVIDER_CATALOG = {
    "llm": [
        {
            "id": "openai",
            "name": "OpenAI",
            "recommended": True,
            "description": "GPT-4o / GPT-4.1 — best tool-calling reliability and latency. Recommended default.",
            "docs_url": "https://platform.openai.com/api-keys",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "anthropic",
            "name": "Anthropic Claude",
            "recommended": False,
            "description": "Claude 3.5 — strong reasoning and instruction-following.",
            "docs_url": "https://console.anthropic.com/settings/keys",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "gemini",
            "name": "Google Gemini",
            "recommended": False,
            "description": "Gemini 2.5 Flash — cheap, fast, good fallback model.",
            "docs_url": "https://aistudio.google.com/apikey",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "sarvam",
            "name": "Sarvam AI (Indic LLM)",
            "recommended": False,
            "description": "sarvam-30b/105b — native reasoning across Indian languages, OpenAI-compatible tool calling.",
            "docs_url": "https://dashboard.sarvam.ai/",
            "fields": _API_KEY_FIELD,
        },
    ],
    "stt": [
        {
            "id": "deepgram",
            "name": "Deepgram",
            "recommended": True,
            "description": "Nova-3 / Flux — sub-300ms streaming with built-in end-of-turn detection. Recommended default.",
            "docs_url": "https://console.deepgram.com/",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "assemblyai",
            "name": "AssemblyAI",
            "recommended": False,
            "description": "Best accuracy + speaker diarization / PII redaction.",
            "docs_url": "https://www.assemblyai.com/dashboard",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "sarvam",
            "name": "Sarvam AI (Indic STT)",
            "recommended": False,
            "description": "Saaras v3 — best accuracy for Indian languages/accents. Recommended for India-first agents.",
            "docs_url": "https://dashboard.sarvam.ai/",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "whisper",
            "name": "OpenAI Whisper",
            "recommended": False,
            "description": "Simple, cheap, batch-only — good fallback.",
            "docs_url": "https://platform.openai.com/api-keys",
            "fields": _API_KEY_FIELD,
        },
    ],
    "tts": [
        {
            "id": "elevenlabs",
            "name": "ElevenLabs",
            "recommended": True,
            "description": "Flash v2.5 — most natural voices, ~75-150ms latency. Recommended default.",
            "docs_url": "https://elevenlabs.io/app/settings/api-keys",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "cartesia",
            "name": "Cartesia",
            "recommended": False,
            "description": "Sonic-3 — lowest latency TTS in the market (40-90ms).",
            "docs_url": "https://play.cartesia.ai/keys",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "sarvam",
            "name": "Sarvam AI (Indic TTS)",
            "recommended": False,
            "description": "Bulbul v3 — most natural voices across 11+ Indian languages. Recommended for India-first agents.",
            "docs_url": "https://dashboard.sarvam.ai/",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "deepgram_aura",
            "name": "Deepgram Aura",
            "recommended": False,
            "description": "Good pick if you're already on Deepgram for STT (single vendor).",
            "docs_url": "https://console.deepgram.com/",
            "fields": _API_KEY_FIELD,
        },
        {
            "id": "openai_tts",
            "name": "OpenAI TTS",
            "recommended": False,
            "description": "Cheapest, simplest fallback voice.",
            "docs_url": "https://platform.openai.com/api-keys",
            "fields": _API_KEY_FIELD,
        },
    ],
    "telephony": [
        {
            "id": "twilio",
            "name": "Twilio",
            "recommended": True,
            "description": "Best docs, most mature SIP/LiveKit integration, global reach. Recommended default.",
            "docs_url": "https://console.twilio.com/",
            "fields": [
                {"key": "account_sid", "label": "Account SID", "type": "text"},
                {"key": "auth_token", "label": "Auth Token", "type": "password"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
        {
            "id": "exotel",
            "name": "Exotel",
            "recommended": True,
            "description": (
                "Required for India-compliant PSTN calling (licensed VNO). Recommended for Indian "
                "numbers. Exotel requires a one-time Voicebot Flow set up in your Exotel dashboard "
                "(App Bazaar) pointed at our call-stream URL — see docs.exotel.com/exotel-agentstream "
                "— its App ID goes in 'Voicebot Flow/App ID' below."
            ),
            "docs_url": "https://my.exotel.com/",
            "fields": [
                {"key": "api_key", "label": "API Key", "type": "text"},
                {"key": "token", "label": "API Token", "type": "password"},
                {"key": "sid", "label": "Account SID", "type": "text"},
                {"key": "subdomain", "label": "API Subdomain (e.g. api.exotel.com or api.in.exotel.com)", "type": "text"},
                {"key": "virtual_number", "label": "ExoPhone Number", "type": "text"},
                {"key": "app_id", "label": "Voicebot Flow/App ID", "type": "text"},
            ],
        },
        {
            "id": "telnyx",
            "name": "Telnyx",
            "recommended": False,
            "description": "Lowest per-minute cost, private IP backbone for lowest latency.",
            "docs_url": "https://portal.telnyx.com/",
            "fields": [
                {"key": "api_key", "label": "API Key", "type": "password"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
        {
            "id": "plivo",
            "name": "Plivo",
            "recommended": False,
            "description": "Cheapest easy migration if you already know Twilio's API shape.",
            "docs_url": "https://console.plivo.com/",
            "fields": [
                {"key": "auth_id", "label": "Auth ID", "type": "text"},
                {"key": "auth_token", "label": "Auth Token", "type": "password"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
        {
            "id": "vonage",
            "name": "Vonage",
            "recommended": False,
            "description": "Best enterprise SLAs and geographic coverage in EMEA/APAC.",
            "docs_url": "https://dashboard.nexmo.com/",
            "fields": [
                {"key": "api_key", "label": "API Key", "type": "text"},
                {"key": "api_secret", "label": "API Secret", "type": "password"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
    ],
}
