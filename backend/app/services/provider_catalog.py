"""Single source of truth for every BYOK provider we support, per category.

The frontend fetches this via GET /integrations/catalog to render the Integrations page
(provider cards, "Recommended" badges, and the right input fields per provider) without
duplicating this list in JS. The backend also uses it to validate incoming credentials.

A handful of vendors sell ONE account key that authenticates every one of their APIs
(chat/completions + transcription + speech, in OpenAI's and Sarvam's case; transcription +
speech for Deepgram). For those we don't show a separate "connect" card per category — one
provider entry is marked `"primary_category"` and the others carry `"shares_key_with"` pointing
back at it, purely so the UI can say "uses the same key you already connected" instead of asking
twice. The actual runtime key lookup (services/key_resolver.py) always checks all three
categories for a given provider id regardless of this metadata — it's UI sugar, not a security
boundary.
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
            "shares_key_with": "sarvam",
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
            "shares_key_with": "sarvam",
        },
        # No standalone "OpenAI Whisper" card — it's the exact same OpenAI account key already
        # connected on the LLM tab. See module docstring.
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
            "shares_key_with": "sarvam",
        },
        {
            "id": "deepgram",
            "name": "Deepgram Aura",
            "recommended": False,
            "description": "Good pick if you're already on Deepgram for STT — same account key.",
            "docs_url": "https://console.deepgram.com/",
            "fields": _API_KEY_FIELD,
            "shares_key_with": "deepgram",
        },
        # No standalone "OpenAI TTS" card — same OpenAI account key already connected on the LLM tab.
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
                "numbers. One-time setup: in Exotel's App Bazaar, build a Flow with a Voicebot "
                "Applet whose URL is the static stream URL shown below (same for every agent/call — "
                "Exotel resolves the right call via its own call_sid) — then paste that Flow's "
                "App ID into 'Voicebot Flow/App ID' below. Docs: "
                "developer.exotel.com/docs/agentstream/stream-voicebot-applet"
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
            "description": (
                "Lowest per-minute cost, private IP backbone for lowest latency. Fully wired — "
                "one-time setup: create a Call Control Application in the Telnyx portal (Voice → "
                "Programmable Voice → Call Control Applications), leave its Webhook URL blank/any "
                "value (we set per-call webhook/stream URLs ourselves), then paste its Application "
                "ID below as 'Connection ID'. Docs: developers.telnyx.com/docs/voice/programmable-voice"
            ),
            "docs_url": "https://portal.telnyx.com/#/app/api-keys",
            "fields": [
                {"key": "api_key", "label": "API Key (v2, from Mission Control Portal)", "type": "password"},
                {"key": "connection_id", "label": "Connection ID (Call Control Application ID)", "type": "text"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
        {
            "id": "plivo",
            "name": "Plivo",
            "recommended": False,
            "description": (
                "Cheapest easy migration if you already know Twilio's API shape. Fully wired — "
                "just save your Auth ID/Token and a Plivo voice-enabled number below, no separate "
                "app/webhook setup needed (we pass a fresh answer_url per call)."
            ),
            "docs_url": "https://console.plivo.com/dashboard/",
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
            "description": (
                "Best enterprise SLAs and geographic coverage in EMEA/APAC. Fully wired — one-time "
                "setup: create a Voice application in the Vonage dashboard (Applications → Create "
                "application → Voice capability, no answer/event URLs required, we supply an NCCO "
                "per call), download its generated private key, link your number to it, then paste "
                "the Application ID + the private key's full contents (including the "
                "-----BEGIN/END PRIVATE KEY----- lines) below. Docs: developer.vonage.com/en/voice/voice-api"
            ),
            "docs_url": "https://dashboard.nexmo.com/applications",
            "fields": [
                {"key": "application_id", "label": "Application ID", "type": "text"},
                {"key": "private_key", "label": "Private Key (paste full .pem contents)", "type": "textarea"},
                {"key": "phone_number", "label": "Phone Number (E.164)", "type": "text"},
            ],
        },
    ],
}
