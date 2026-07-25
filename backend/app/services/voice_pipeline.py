"""Shared STT -> LLM -> TTS turn logic for a given Agent.

Used by both `routers/testing.py` (the Workflow Builder's test panel) and
`routers/calls.py` (the live Twilio call stream), so both paths resolve the same
provider/key/language behavior for an Agent instead of drifting apart — which is exactly
what had happened before: `calls.py` had its own hardcoded, platform-key-only, Hindi-only
Sarvam calls that ignored the agent's own configured provider/key/language entirely.
"""

import logging

from app.config import settings
from app.services import key_resolver
from app.services.voice_service import VoiceService, ELEVENLABS_VOICE_IDS, DEFAULT_ELEVENLABS_VOICE_ID
from app.services.workflow_engine import WorkflowEngine
from app.services.language_catalog import language_name, sarvam_code_for, is_sarvam_compatible

logger = logging.getLogger(__name__)

voice_service = VoiceService()
workflow_engine = WorkflowEngine()


def resolve_agent_language(agent):
    """Returns (human_readable_target_language_or_None, sarvam_language_code) for an Agent."""
    if not agent or not agent.language:
        return None, "hi-IN"
    return language_name(agent.language), sarvam_code_for(agent.language)


def _get(agent, field, default=None):
    return getattr(agent, field, default) if agent else default


async def transcribe(agent, audio_bytes: bytes) -> str:
    """STT for one turn.

    Mirrors how Retell AI itself handles this (confirmed against their docs): most users never
    pick an ASR/STT provider at all — it's auto-routed based on the agent's language, with manual
    provider choice reserved for an "Advanced"/custom mode. So `stt_provider` defaults to
    `"auto"`, which tries providers in best-fit-for-this-language order and skips straight past
    any that have no resolvable key, ending at Whisper (always available via the platform's own
    OpenAI key). Sarvam is the one hardcoded exception: choosing Sarvam as the *voice* (TTS)
    provider also drives STT via Sarvam even outside of auto mode, matching how the feature
    originally shipped."""
    voice_provider = _get(agent, "voice_provider", "elevenlabs")
    configured_stt = _get(agent, "stt_provider") or "auto"
    lang_code = _get(agent, "language", "en-US")
    _, sarvam_lang = resolve_agent_language(agent)

    if voice_provider == "sarvam":
        candidates = ["sarvam"]
    elif configured_stt != "auto":
        candidates = [configured_stt]
    elif is_sarvam_compatible(lang_code):
        candidates = ["sarvam", "deepgram", "assemblyai"]
    else:
        candidates = ["deepgram", "assemblyai"]

    for stt_provider in candidates:
        try:
            if stt_provider == "sarvam":
                key = key_resolver.resolve_key(agent, "sarvam_api_key", "sarvam", settings.SARVAM_API_KEY)
                if key:
                    text = await voice_service.transcribe_audio_sarvam_custom(audio_bytes, sarvam_lang, api_key=key)
                    if text:
                        return text
            elif stt_provider == "deepgram":
                key = key_resolver.resolve_key(agent, "deepgram_api_key", "deepgram", settings.DEEPGRAM_API_KEY)
                if key:
                    text = await voice_service.transcribe_audio_deepgram_custom(audio_bytes, api_key=key)
                    if text:
                        return text
            elif stt_provider == "assemblyai":
                key = key_resolver.resolve_key(agent, "assemblyai_api_key", "assemblyai")
                if key:
                    text = await voice_service.transcribe_audio_assemblyai_custom(audio_bytes, api_key=key)
                    if text:
                        return text
        except Exception as e:
            logger.warning(f"{stt_provider} STT failed, trying next candidate: {e}")

    try:
        openai_key = key_resolver.resolve_key(agent, "openai_api_key", "openai", settings.OPENAI_API_KEY) or None
        return await voice_service.transcribe_audio(audio_bytes, api_key=openai_key)
    except Exception as e:
        logger.error(f"Whisper STT fallback failed: {e}")
        return ""


def _resolve_elevenlabs_voice_id(agent) -> str:
    explicit_id = _get(agent, "voice_id")
    if explicit_id:
        return explicit_id
    name = (_get(agent, "voice_name") or "").strip().lower()
    return ELEVENLABS_VOICE_IDS.get(name, DEFAULT_ELEVENLABS_VOICE_ID)


async def synthesize(agent, text: str) -> str:
    """TTS for one turn, routed by the agent's `voice_provider`. Every path falls back to the
    default ElevenLabs/OpenAI TTS chain on failure/no-key.

    `voice_name` is whatever the user picked (curated dropdown choice, or their own custom
    voice/speaker ID typed in from the provider's voice library) — it MUST be threaded through
    to each provider call below, or every agent silently gets that provider's hardcoded default
    voice no matter what was configured."""
    voice_provider = _get(agent, "voice_provider", "elevenlabs")
    _, sarvam_lang = resolve_agent_language(agent)
    voice_name = (_get(agent, "voice_name") or "").strip()

    if voice_provider == "sarvam":
        key = key_resolver.resolve_key(agent, "sarvam_api_key", "sarvam", settings.SARVAM_API_KEY)
        if key:
            return await voice_service.generate_audio_sarvam_custom(text, sarvam_lang, voice_name or "shubh", api_key=key)
    elif voice_provider == "cartesia":
        key = key_resolver.resolve_key(agent, "cartesia_api_key", "cartesia")  # no platform-wide fallback key for Cartesia
        if key:
            return await voice_service.generate_audio_cartesia_custom(text, api_key=key, voice_id=voice_name or None)
    elif voice_provider == "deepgram_aura":
        key = key_resolver.resolve_key(agent, "deepgram_api_key", "deepgram", settings.DEEPGRAM_API_KEY)
        if key:
            return await voice_service.generate_audio_deepgram_custom(text, api_key=key, voice=voice_name or "aura-asteria-en")
    elif voice_provider == "openai_tts":
        key = key_resolver.resolve_key(agent, "openai_api_key", "openai", settings.OPENAI_API_KEY)
        if key:
            return await voice_service.generate_audio_openai_tts_custom(text, api_key=key, voice=voice_name or "alloy")

    # Default / ElevenLabs / any-provider-failed fallback
    eleven_key = key_resolver.resolve_key(agent, "elevenlabs_api_key", "elevenlabs", settings.ELEVENLABS_API_KEY)
    openai_key = key_resolver.resolve_key(agent, "openai_api_key", "openai", settings.OPENAI_API_KEY) or None
    return await voice_service.generate_audio(
        text, api_key=eleven_key, voice_id=_resolve_elevenlabs_voice_id(agent), openai_key=openai_key
    )


def generate_reply(agent, user_input: str, conversation_history: list = None) -> str:
    """LLM reply for one turn, using the agent's own prompt, provider/key and configured
    language — regardless of which voice provider is doing STT/TTS."""
    target_language, _ = resolve_agent_language(agent)
    prompt = (agent.agent_prompt if agent else None) or "You are a helpful assistant."
    return workflow_engine.generate_response(prompt, user_input, conversation_history or [], target_language, agent)
