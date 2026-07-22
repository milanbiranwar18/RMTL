from openai import OpenAI
from app.config import settings
import logging
import base64
import io
import httpx

logger = logging.getLogger(__name__)


class VoiceService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # ─────────────────────────────────────────────────────────────
    # STT
    # ─────────────────────────────────────────────────────────────

    async def transcribe_audio(self, audio_file) -> str:
        """STT via OpenAI Whisper (last resort)."""
        try:
            if isinstance(audio_file, bytes):
                if len(audio_file) == 0:
                    return ""
                audio_file = io.BytesIO(audio_file)
            audio_file.name = "audio.webm"
            transcript = self.client.audio.transcriptions.create(
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

    # ─────────────────────────────────────────────────────────────
    # TTS
    # ─────────────────────────────────────────────────────────────

    async def generate_audio(self, text: str) -> str:
        """TTS via ElevenLabs (preferred) or OpenAI (fallback). Returns base64."""
        if settings.ELEVENLABS_API_KEY:
            try:
                from elevenlabs.client import ElevenLabs
                client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
                audio_generator = client.text_to_speech.convert(
                    text=text,
                    voice_id="21m00Tcm4TlvDq8ikWAM",
                    model_id="eleven_multilingual_v2"
                )
                audio_content = b"".join(audio_generator)
                logger.info("Generated audio via ElevenLabs")
                return base64.b64encode(audio_content).decode("utf-8")
            except Exception as e:
                logger.error(f"ElevenLabs TTS failed: {e} — falling back to OpenAI")

        try:
            response = self.client.audio.speech.create(model="tts-1", voice="alloy", input=text)
            logger.info("Generated audio via OpenAI TTS")
            return base64.b64encode(response.content).decode("utf-8")
        except Exception as e:
            logger.error(f"OpenAI TTS also failed: {e}")
            raise e

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
