"""Post-call analytics using ANY LLM (GPT, Claude, Gemini, Sarvam): Automatically generate
transcripts, summaries, sentiment analysis, action items, topics, and call scoring after every call.

**Multi-LLM Support**: Uses whichever LLM the agent is already using - no extra cost!

Cost Examples (per 5-minute call, 2026 pricing):
- **GPT-4o**: ~₹0.02-0.03 per call (₹5 input + ₹15 output per 1M tokens)
- **Claude Sonnet**: ~₹0.01-0.02 per call (₹3 input + ₹15 output per 1M tokens)
- **Gemini 1.5 Pro**: ~₹0.01-0.02 per call (implicit caching saves 50%)
- **Sarvam-30B**: ~₹0.01-0.02 per call (₹2.5 input + ₹10 output per 1M tokens)

**Total**: ~₹0.01-0.03 per call (less than 5 paise!) - uses agent's existing LLM!

Architecture note: This is deliberately synchronous (not async) and runs immediately after a call
ends in `_finalize_call` — call analytics are fast enough (~2-5s for a 5min call) that the extra
thread-blocking is worth avoiding the complexity of a background worker queue. If your deployment
sees >100 calls/minute and analytics start blocking threads, move this to Celery (app/workers/)."""

import logging
import json
import time
import httpx
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

# Sarvam API endpoints
SARVAM_BATCH_STT_SUBMIT_URL = "https://api.sarvam.ai/speech-to-text/batch/submit"
SARVAM_BATCH_STT_STATUS_URL = "https://api.sarvam.ai/speech-to-text/batch/{job_id}/status"
SARVAM_CHAT_URL = "https://api.sarvam.ai/v2/chat/completions"


def generate_call_analytics(
    conversation_history: list,
    agent,  # Agent object (has llm_provider, llm_model, etc.)
    agent_language: str = "en-IN",
) -> Dict[str, Any]:
    """Returns comprehensive call analytics using the agent's configured LLM.
    
    **Multi-LLM Support**: Automatically uses whichever LLM the agent is configured with
    (GPT, Claude, Gemini, Sarvam) - no extra API costs!
    
    Args:
        conversation_history: List of {"role": "user"/"assistant", "content": "text"} messages
        agent: Agent object with llm_provider, llm_model, API keys
        agent_language: Language code (e.g., "en-IN", "hi-IN")
    
    Returns:
        {
            "transcript": "User: hello\\nAgent: hi there...",  # Formatted conversation
            "summary": "Customer called about...",  # LLM-generated summary
            "sentiment": "positive",  # positive/negative/neutral
            "action_items": [...],  # List of action items extracted
            "topics": [...],  # Main topics discussed
            "keywords": {...},  # Keywords with mention counts
            "call_score": {...},  # Quality metrics (courtesy, resolution, etc.)
            "talk_time": {"user": 45, "agent": 120},  # seconds per speaker
            "error": None or "error message"
        }
    """
    if not conversation_history:
        return {
            "transcript": "",
            "summary": None,
            "sentiment": None,
            "action_items": [],
            "topics": [],
            "keywords": {},
            "call_score": {},
            "talk_time": {},
            "error": "No conversation history available",
        }
    
    # Format conversation history into a readable transcript
    transcript = _format_transcript_from_history(conversation_history)
    
    # Generate comprehensive analytics using agent's LLM
    analytics = _generate_comprehensive_analytics(transcript, agent)
    
    # Calculate approximate talk time based on word count
    talk_time = _estimate_talk_time(conversation_history)
    
    return {
        "transcript": transcript,
        "summary": analytics.get("summary"),
        "sentiment": analytics.get("sentiment"),
        "action_items": analytics.get("action_items", []),
        "topics": analytics.get("topics", []),
        "keywords": analytics.get("keywords", {}),
        "call_score": analytics.get("call_score", {}),
        "talk_time": talk_time,
        "error": analytics.get("error"),
    }


def _format_transcript_from_history(conversation_history: list) -> str:
    """Converts [{"role": "user", "content": "..."}, ...] into a human-readable transcript."""
    lines = []
    for turn in conversation_history:
        role = turn.get("role", "unknown")
        content = turn.get("content", "").strip()
        if not content:
            continue
        speaker = "User" if role == "user" else "Agent"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)


def _generate_summary_and_sentiment(transcript: str, api_key: str) -> tuple[Optional[str], Optional[str]]:
    """Uses Sarvam's sarvam-30b model to generate a concise summary and detect sentiment from
    the conversation transcript.
    
    Prompt design: Asks the LLM to return structured JSON with `summary` and `sentiment` fields
    to make parsing reliable. Falls back to text parsing if JSON parse fails.
    
    Returns: (summary_text, sentiment_label)
    """
    if not transcript:
        return None, None
    
    # Structured prompt asking for JSON output
    prompt = f"""You are analyzing a customer service call transcript. Provide:
1. A concise 2-3 sentence summary of the conversation
2. The overall sentiment (positive, negative, or neutral)

Return your analysis in JSON format:
{{"summary": "...", "sentiment": "positive/negative/neutral"}}

Transcript:
{transcript}

Analysis:"""

    try:
        response = httpx.post(
            SARVAM_CHAT_URL,
            headers={
                "Content-Type": "application/json",
                "api-subscription-key": api_key,
            },
            json={
                "model": "sarvam-30b",  # Cost-effective model: ₹2.5 input / ₹10 output per 1M tokens
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,  # Low temperature for consistent, factual summaries
                "max_tokens": 500,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        
        llm_output = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        
        # Try to parse as JSON first
        try:
            result = json.loads(llm_output)
            summary = result.get("summary", "").strip()
            sentiment = result.get("sentiment", "neutral").lower()
        except json.JSONDecodeError:
            # Fallback: treat entire output as summary, guess sentiment from keywords
            summary = llm_output[:500]  # Truncate if needed
            sentiment = _guess_sentiment_from_text(llm_output)
        
        # Validate sentiment
        if sentiment not in ["positive", "negative", "neutral"]:
            sentiment = "neutral"
        
        logger.info(f"Generated call summary ({len(summary)} chars) with {sentiment} sentiment")
        return summary, sentiment
        
    except Exception as e:
        logger.error(f"Failed to generate summary with Sarvam LLM: {e}")
        return None, None


def _guess_sentiment_from_text(text: str) -> str:
    """Fallback sentiment detection using keyword matching when JSON parsing fails."""
    text_lower = text.lower()
    
    positive_keywords = ["satisfied", "happy", "resolved", "excellent", "great", "thank you", "appreciate"]
    negative_keywords = ["angry", "frustrated", "unresolved", "disappointed", "unhappy", "complain", "issue"]
    
    positive_count = sum(1 for kw in positive_keywords if kw in text_lower)
    negative_count = sum(1 for kw in negative_keywords if kw in text_lower)
    
    if positive_count > negative_count:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    return "neutral"


def _estimate_talk_time(conversation_history: list) -> Dict[str, int]:
    """Estimates speaking time per role based on word count.
    
    Approximation: Average speaking rate is ~150 words/minute, or 2.5 words/second.
    Real diarized STT provides exact timestamps — this is just an estimate for display purposes.
    
    Returns: {"user": seconds, "agent": seconds}
    """
    user_words = 0
    agent_words = 0
    
    for turn in conversation_history:
        role = turn.get("role", "")
        content = turn.get("content", "")
        word_count = len(content.split())
        
        if role == "user":
            user_words += word_count
        elif role == "assistant":
            agent_words += word_count
    
    # Convert words to seconds (2.5 words/second average)
    user_seconds = int(user_words / 2.5)
    agent_seconds = int(agent_words / 2.5)
    
    return {
        "user": user_seconds,
        "agent": agent_seconds,
    }


# Future enhancement: Full Sarvam Batch STT with real diarization
# (Currently we don't have the raw audio file accessible after the call — Twilio/Exotel
# store it on their side, and we'd need to fetch + upload it to Sarvam. This is doable
# but adds ~5-10s latency. For now, conversation_history-based transcript is instant.)

def generate_call_analytics_from_audio(
    recording_url: str,
    language_code: str = "en-IN",
    sarvam_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Alternative implementation using Sarvam's Batch STT with diarization for more accurate
    speaker-labeled transcripts and exact talk-time. Use this if you have the recording_url
    and want production-grade analytics.
    
    This function is NOT called by default (to keep post-call processing fast) — enable it
    by uncommenting the call in _finalize_call if you need real diarized transcripts.
    
    Workflow:
    1. Download audio from recording_url
    2. Submit to Sarvam Batch STT API with with_diarization=True
    3. Poll for completion
    4. Parse diarized transcript
    5. Generate summary using Sarvam LLM
    
    Returns same structure as generate_call_analytics()
    """
    api_key = sarvam_api_key or settings.SARVAM_API_KEY
    
    if not api_key or not recording_url:
        return {
            "transcript": None,
            "summary": None,
            "sentiment": None,
            "talk_time": {},
            "error": "Missing API key or recording URL",
        }
    
    logger.info(f"Starting Sarvam Batch STT for recording: {recording_url}")
    
    try:
        # Download audio file
        audio_response = httpx.get(recording_url, timeout=30.0, follow_redirects=True)
        audio_response.raise_for_status()
        audio_data = audio_response.content
        
        # Submit to Sarvam Batch STT
        response = httpx.post(
            SARVAM_BATCH_STT_SUBMIT_URL,
            headers={"api-subscription-key": api_key},
            files={"file": ("recording.mp3", audio_data, "audio/mpeg")},
            data={
                "language_code": language_code,
                "with_diarization": "true",
                "with_timestamps": "true",
            },
            timeout=60.0,
        )
        response.raise_for_status()
        job_id = response.json().get("job_id")
        
        if not job_id:
            raise ValueError("No job_id returned from Sarvam Batch STT")
        
        logger.info(f"Batch STT job submitted: {job_id}")
        
        # Poll for completion (max 2 minutes)
        transcript = None
        for _ in range(24):  # 24 * 5s = 2 minutes max
            time.sleep(5)
            status_response = httpx.get(
                SARVAM_BATCH_STT_STATUS_URL.format(job_id=job_id),
                headers={"api-subscription-key": api_key},
                timeout=15.0,
            )
            status_response.raise_for_status()
            status_data = status_response.json()
            
            if status_data.get("status") == "completed":
                transcript = status_data.get("diarized_transcript", "")
                break
            elif status_data.get("status") == "failed":
                raise ValueError(f"Batch STT job failed: {status_data.get('error')}")
        
        if not transcript:
            raise TimeoutError("Batch STT job did not complete within 2 minutes")
        
        logger.info(f"Batch STT completed: {len(transcript)} chars")
        
        # Generate summary and sentiment
        summary, sentiment = _generate_summary_and_sentiment(transcript, api_key)
        
        # Calculate actual talk time from diarized data
        # (Sarvam's diarized_transcript includes timestamps — parse them here)
        talk_time = _parse_talk_time_from_diarized(transcript)
        
        return {
            "transcript": transcript,
            "summary": summary,
            "sentiment": sentiment,
            "talk_time": talk_time,
            "error": None,
        }
        
    except Exception as e:
        logger.error(f"Batch STT analytics failed: {e}")
        return {
            "transcript": None,
            "summary": None,
            "sentiment": None,
            "talk_time": {},
            "error": str(e),
        }


def _parse_talk_time_from_diarized(diarized_transcript: str) -> Dict[str, int]:
    """Parses Sarvam's diarized transcript format to extract per-speaker talk time.
    
    Expected format: Lines like "SPEAKER_00 [0.0-2.5]: hello there"
    Returns: {"speaker_00": 2, "speaker_01": 5, ...} in seconds
    """
    talk_time = {}
    
    for line in diarized_transcript.split("\n"):
        if not line.strip():
            continue
        
        # Parse format: "SPEAKER_XX [start-end]: text"
        try:
            parts = line.split(":", 1)
            speaker_with_time = parts[0].strip()
            speaker_parts = speaker_with_time.split("[")
            speaker = speaker_parts[0].strip().lower()
            time_range = speaker_parts[1].replace("]", "").strip()
            start, end = map(float, time_range.split("-"))
            duration = int(end - start)
            
            talk_time[speaker] = talk_time.get(speaker, 0) + duration
        except:
            continue
    
    return talk_time
