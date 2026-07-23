from openai import OpenAI
from app.config import settings
import logging
import base64
import io
import httpx
import asyncio

logger = logging.getLogger(__name__)

# Stable, well-known public ElevenLabs premade voice IDs. `voice_name` on the Agent is a
# friendly label (matches the dropdowns in AgentForm/AgentSettings/AgentSettingsPanel) — this
# maps it to the real voice_id ElevenLabs expects. An explicit `agent.voice_id` always wins.
ELEVENLABS_VOICE_IDS = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "bella": "EXAVITQu4vr4xnSDxMaL",
    "emily": "LcfcDJNUP1GQjkzn1xUU",
    "grace": "oWAxZDx7w5VEj9dCyTzz",
    "charlotte": "XB0fDUnXU5powFXDhCwa",
    "alice": "Xb7hH8MSUJpSbSDYk0k2",
    "adam": "pNInz6obpgDQGcFmaJgB",
    "antoni": "ErXwobaYiN019PkySvjV",
    "daniel": "onwK4e9ZLuTAKqWW03F9",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
    "sam": "yoZ06aMxZJJ28mfd3POQ",
}
DEFAULT_ELEVENLABS_VOICE_ID = ELEVENLABS_VOICE_IDS["rachel"]


class VoiceService:
    def __init__(self):
        # Lazy client: constructing OpenAI() eagerly raises if no key is set, which would
        # crash app startup under BYOK (global OpenAI key is no longer guaranteed to exist).
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not settings.OPENAI_API_KEY:
                raise ValueError("No OpenAI API key configured")
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    # ─────────────────────────────────────────────────────────────
    # STT
    # ─────────────────────────────────────────────────────────────

    async def transcribe_audio(self, audio_file, api_key: str = None) -> str:
        """STT via OpenAI Whisper (universal last-resort fallback)."""
        try:
            if isinstance(audio_file, bytes):
                if len(audio_file) == 0:
                    return ""
                audio_file = io.BytesIO(audio_file)
            audio_file.name = "audio.webm"
            client = OpenAI(api_key=api_key) if api_key else self.client
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            return transcript.text
        except Exception as e:
            logger.error(f"Whisper STT failed: {e}")
            return f"user audio was incomprehensible due to microphone issue (Error: {e})"

    async def transcribe_audio_sarvam(self, audio_file) -> str:
        """STT via Sarvam AI (platform key)."""
        return await self.transcribe_audio_sarvam_custom(audio_file, api_key=settings.SARVAM_API_KEY)

    async def transcribe_audio_sarvam_custom(
        self, audio_file, language_code: str = "hi-IN", api_key: str = None
    ) -> str:
        """STT via Sarvam AI with explicit language + api_key."""
        key = api_key or settings.SARVAM_API_KEY
        if not key:
            logger.warning("No Sarvam key for STT — returning empty")
            return ""
        if isinstance(audio_file, bytes) and len(audio_file) == 0:
            return ""
        try:
            url = "https://api.sarvam.ai/speech-to-text"
            headers = {"api-subscription-key": key}
            files = {"file": ("audio.webm", audio_file, "audio/webm")}
            data = {"model": "saaras:v3", "language_code": language_code, "mode": "transcribe"}
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, files=files, data=data)
            if response.status_code == 200:
                result = response.json()
                text = result.get("transcript", "") or result.get("text", "") or ""
                logger.info(f"Sarvam STT OK: '{text}'")
                return text
            else:
                logger.error(f"Sarvam STT error {response.status_code}: {response.text[:300]}")
                return ""
        except Exception as e:
            logger.error(f"Sarvam STT exception: {e}")
            return ""

    async def transcribe_audio_deepgram_custom(
        self, audio_file, api_key: str, content_type: str = "audio/webm"
    ) -> str:
        """STT via Deepgram Nova-3 — https://developers.deepgram.com/reference/speech-to-text-api/listen"""
        if not api_key:
            logger.warning("No Deepgram key for STT — returning empty")
            return ""
        audio_bytes = audio_file if isinstance(audio_file, bytes) else audio_file.read()
        if len(audio_bytes) == 0:
            return ""
        try:
            url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true"
            headers = {"Authorization": f"Token {api_key}", "Content-Type": content_type}
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, content=audio_bytes)
            if response.status_code == 200:
                data = response.json()
                text = (
                    data.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0]
                    .get("transcript", "")
                )
                logger.info(f"Deepgram STT OK: '{text}'")
                return text
            logger.error(f"Deepgram STT error {response.status_code}: {response.text[:300]}")
            return ""
        except Exception as e:
            logger.error(f"Deepgram STT exception: {e}")
            return ""

    async def transcribe_audio_assemblyai_custom(self, audio_file, api_key: str) -> str:
        """STT via AssemblyAI — batch upload + poll (no low-latency streaming in this MVP)."""
        if not api_key:
            logger.warning("No AssemblyAI key for STT — returning empty")
            return ""
        audio_bytes = audio_file if isinstance(audio_file, bytes) else audio_file.read()
        if len(audio_bytes) == 0:
            return ""
        try:
            headers = {"authorization": api_key}
            async with httpx.AsyncClient(timeout=30.0) as client:
                upload_resp = await client.post(
                    "https://api.assemblyai.com/v2/upload", headers=headers, content=audio_bytes
                )
                upload_resp.raise_for_status()
                upload_url = upload_resp.json()["upload_url"]

                create_resp = await client.post(
                    "https://api.assemblyai.com/v2/transcript",
                    headers=headers,
                    json={"audio_url": upload_url},
                )
                create_resp.raise_for_status()
                transcript_id = create_resp.json()["id"]

                for _ in range(15):  # ~15s max wait for a short turn-based clip
                    await asyncio.sleep(1)
                    poll_resp = await client.get(
                        f"https://api.assemblyai.com/v2/transcript/{transcript_id}", headers=headers
                    )
                    poll_resp.raise_for_status()
                    result = poll_resp.json()
                    if result.get("status") == "completed":
                        text = result.get("text", "") or ""
                        logger.info(f"AssemblyAI STT OK: '{text}'")
                        return text
                    if result.get("status") == "error":
                        logger.error(f"AssemblyAI STT error: {result.get('error')}")
                        return ""
                logger.warning("AssemblyAI STT timed out waiting for transcript")
                return ""
        except Exception as e:
            logger.error(f"AssemblyAI STT exception: {e}")
            return ""

    # ─────────────────────────────────────────────────────────────
    # TTS
    # ─────────────────────────────────────────────────────────────

    async def generate_audio(self, text: str, api_key: str = None, voice_id: str = None, openai_key: str = None) -> str:
        """TTS via ElevenLabs (preferred) or OpenAI (fallback). Returns base64.
        `api_key`/`voice_id` override the platform ElevenLabs key/default voice when provided."""
        eleven_key = api_key or settings.ELEVENLABS_API_KEY
        if eleven_key:
            try:
                from elevenlabs.client import ElevenLabs
                client = ElevenLabs(api_key=eleven_key)
                audio_generator = client.text_to_speech.convert(
                    text=text,
                    voice_id=voice_id or DEFAULT_ELEVENLABS_VOICE_ID,
                    model_id="eleven_multilingual_v2"
                )
                audio_content = b"".join(audio_generator)
                logger.info("Generated audio via ElevenLabs")
                return base64.b64encode(audio_content).decode("utf-8")
            except Exception as e:
                logger.error(f"ElevenLabs TTS failed: {e} — falling back to OpenAI")

        try:
            client = OpenAI(api_key=openai_key) if openai_key else self.client
            response = client.audio.speech.create(model="tts-1", voice="alloy", input=text)
            logger.info("Generated audio via OpenAI TTS")
            return base64.b64encode(response.content).decode("utf-8")
        except Exception as e:
            logger.error(f"OpenAI TTS also failed: {e}")
            raise e

    async def generate_audio_openai_tts_custom(self, text: str, api_key: str = None, voice: str = "alloy") -> str:
        """TTS via OpenAI directly (explicit selection — skips ElevenLabs entirely)."""
        client = OpenAI(api_key=api_key) if api_key else self.client
        response = client.audio.speech.create(model="tts-1", voice=voice or "alloy", input=text)
        return base64.b64encode(response.content).decode("utf-8")

    async def generate_audio_sarvam(self, text: str) -> str:
        """TTS via Sarvam AI (platform key, Hindi/meera defaults)."""
        return await self.generate_audio_sarvam_custom(text, api_key=settings.SARVAM_API_KEY)

    async def generate_audio_sarvam_custom(
        self,
        text: str,
        language_code: str = "hi-IN",
        speaker: str = "meera",
        api_key: str = None
    ) -> str:
        """TTS via Sarvam AI with explicit language + speaker + api_key."""
        key = api_key or settings.SARVAM_API_KEY
        if not key:
            logger.warning("No Sarvam key for TTS — falling back to default TTS")
            return await self.generate_audio(text)

        # Enforce valid Sarvam Indian speakers
        valid_speakers = ["anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran", "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", "sumit", "roopa", "kabir", "aayan", "shubh", "ashutosh", "advait"]
        if speaker.lower() not in valid_speakers:
            logger.warning(f"Speaker '{speaker}' not recognized by Sarvam, defaulting to 'anushka'")
            speaker = "anushka"
        try:
            url = "https://api.sarvam.ai/text-to-speech"
            headers = {"api-subscription-key": key, "Content-Type": "application/json"}
            data = {
                "inputs": [text],
                "target_language_code": language_code,
                "speaker": speaker,
                "pitch": 0,
                "pace": 1.05,
                "loudness": 1.5,
                "speech_sample_rate": 8000,
                "enable_preprocessing": True,
                "model": "bulbul:v3"
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=data)
            if response.status_code == 200:
                result = response.json()
                audios = result.get("audios", [])
                if audios:
                    logger.info(f"Sarvam TTS OK [{language_code}/{speaker}]")
                    return audios[0]
            logger.error(f"Sarvam TTS error {response.status_code}: {response.text[:300]}")
            return await self.generate_audio(text)
        except Exception as e:
            logger.error(f"Sarvam TTS exception: {e}")
            return await self.generate_audio(text)

    async def generate_audio_deepgram_custom(self, text: str, api_key: str, voice: str = "aura-asteria-en") -> str:
        """TTS via Deepgram Aura — https://developers.deepgram.com/reference/text-to-speech-api"""
        if not api_key:
            logger.warning("No Deepgram key for TTS — falling back to default TTS")
            return await self.generate_audio(text)
        try:
            url = f"https://api.deepgram.com/v1/speak?model={voice or 'aura-asteria-en'}"
            headers = {"Authorization": f"Token {api_key}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json={"text": text})
            if response.status_code == 200:
                logger.info("Generated audio via Deepgram Aura")
                return base64.b64encode(response.content).decode("utf-8")
            logger.error(f"Deepgram TTS error {response.status_code}: {response.text[:300]}")
            return await self.generate_audio(text)
        except Exception as e:
            logger.error(f"Deepgram TTS exception: {e} — falling back to default TTS")
            return await self.generate_audio(text)

    async def generate_audio_cartesia_custom(self, text: str, api_key: str, voice_id: str = None) -> str:
        """TTS via Cartesia Sonic — https://docs.cartesia.ai/api-reference/tts/bytes"""
        if not api_key:
            logger.warning("No Cartesia key for TTS — falling back to default TTS")
            return await self.generate_audio(text)
        try:
            url = "https://api.cartesia.ai/tts/bytes"
            headers = {
                "X-API-Key": api_key,
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json",
            }
            payload = {
                "model_id": "sonic-2",
                "transcript": text,
                "voice": {"mode": "id", "id": voice_id or "694f9389-aac1-45b6-b726-9d9369183238"},
                "output_format": {"container": "mp3", "sample_rate": 44100, "encoding": "mp3"},
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                logger.info("Generated audio via Cartesia")
                return base64.b64encode(response.content).decode("utf-8")
            logger.error(f"Cartesia TTS error {response.status_code}: {response.text[:300]}")
            return await self.generate_audio(text)
        except Exception as e:
            logger.error(f"Cartesia TTS exception: {e} — falling back to default TTS")
            return await self.generate_audio(text)
