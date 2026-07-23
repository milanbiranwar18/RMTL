"""Shared STT -> LLM -> TTS turn logic for a given Agent.

Used by both `routers/testing.py` (the Workflow Builder's test panel) and
`routers/calls.py` (the live Twilio call stream), so both paths resolve the same
provider/key/language behavior for an Agent instead of drifting apart — which is exactly
what had happened before: `calls.py` had its own hardcoded, platform-key-only, Hindi-only
Sarvam calls that ignored the agent's own configured provider/key/language entirely.
"""

import logging

from app.config import settings
from app.services.voice_service import VoiceService, ELEVENLABS_VOICE_IDS, DEFAULT_ELEVENLABS_VOICE_ID
from app.services.workflow_engine import WorkflowEngine
from app.services.language_catalog import language_name, sarvam_code_for

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
    """STT for one turn, routed by the agent's `stt_provider` (independent of TTS/`voice_provider`) —
    Sarvam is the one exception: choosing Sarvam as the *voice* provider also drives STT via Sarvam,
    matching how the feature originally shipped. Every path falls back to Whisper on failure/no-key."""
    voice_provider = _get(agent, "voice_provider", "elevenlabs")
    stt_provider = "sarvam" if voice_provider == "sarvam" else _get(agent, "stt_provider", "whisper")
    _, sarvam_lang = resolve_agent_language(agent)

    try:
        if stt_provider == "sarvam":
            key = _get(agent, "sarvam_api_key") or settings.SARVAM_API_KEY
            if key:
                text = await voice_service.transcribe_audio_sarvam_custom(audio_bytes, sarvam_lang, api_key=key)
                if text:
                    return text
        elif stt_provider == "deepgram":
            key = _get(agent, "deepgram_api_key") or settings.DEEPGRAM_API_KEY
            if key:
                text = await voice_service.transcribe_audio_deepgram_custom(audio_bytes, api_key=key)
                if text:
                    return text
        elif stt_provider == "assemblyai":
            key = _get(agent, "assemblyai_api_key")
            if key:
                text = await voice_service.transcribe_audio_assemblyai_custom(audio_bytes, api_key=key)
                if text:
                    return text
    except Exception as e:
        logger.warning(f"{stt_provider} STT failed, falling back to Whisper: {e}")

    try:
        openai_key = _get(agent, "openai_api_key") or None
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
    default ElevenLabs/OpenAI TTS chain on failure/no-key."""
    voice_provider = _get(agent, "voice_provider", "elevenlabs")
    _, sarvam_lang = resolve_agent_language(agent)
    speaker = _get(agent, "voice_name") or "meera"

    if voice_provider == "sarvam":
        key = _get(agent, "sarvam_api_key") or settings.SARVAM_API_KEY
        if key:
            return await voice_service.generate_audio_sarvam_custom(text, sarvam_lang, speaker, api_key=key)
    elif voice_provider == "cartesia":
        key = _get(agent, "cartesia_api_key")  # no platform-wide fallback key for Cartesia
        if key:
            return await voice_service.generate_audio_cartesia_custom(text, api_key=key)
    elif voice_provider == "deepgram_aura":
        key = _get(agent, "deepgram_api_key") or settings.DEEPGRAM_API_KEY
        if key:
            return await voice_service.generate_audio_deepgram_custom(text, api_key=key)
    elif voice_provider == "openai_tts":
        key = _get(agent, "openai_api_key") or settings.OPENAI_API_KEY
        if key:
            return await voice_service.generate_audio_openai_tts_custom(text, api_key=key)

    # Default / ElevenLabs / any-provider-failed fallback
    eleven_key = _get(agent, "elevenlabs_api_key") or settings.ELEVENLABS_API_KEY
    openai_key = _get(agent, "openai_api_key") or None
    return await voice_service.generate_audio(
        text, api_key=eleven_key, voice_id=_resolve_elevenlabs_voice_id(agent), openai_key=openai_key
    )


def generate_reply(agent, user_input: str, conversation_history: list = None) -> str:
    """LLM reply for one turn, using the agent's own prompt, provider/key and configured
    language — regardless of which voice provider is doing STT/TTS."""
    target_language, _ = resolve_agent_language(agent)
    prompt = (agent.agent_prompt if agent else None) or "You are a helpful assistant."
    return workflow_engine.generate_response(prompt, user_input, conversation_history or [], target_language, agent)
