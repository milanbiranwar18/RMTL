"""Usage tracking and cost calculation service.

Tracks API usage across all providers and calculates costs in real-time.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.usage import UsageRecord, PricingConfig

logger = logging.getLogger(__name__)

# Default pricing (2026 rates in INR)
# These are fallback values if pricing_configs table is empty
DEFAULT_PRICING = {
    # LLM Pricing (per 1 million tokens)
    "llm": {
        "gpt": {
            "gpt-4o": {"input": 5.0, "output": 15.0, "cached": 2.5},
            "gpt-4o-mini": {"input": 1.5, "output": 6.0, "cached": 0.75},
        },
        "claude": {
            "claude-opus": {"input": 15.0, "output": 75.0, "cached": 7.5},
            "claude-sonnet": {"input": 3.0, "output": 15.0, "cached": 1.5},
        },
        "gemini": {
            "gemini-1.5-pro": {"input": 3.5, "output": 10.5, "cached": 1.75},
            "gemini-1.5-flash": {"input": 0.35, "output": 1.05, "cached": 0.175},
        },
        "sarvam": {
            "sarvam-105b": {"input": 4.0, "output": 16.0, "cached": 2.5},
            "sarvam-30b": {"input": 2.5, "output": 10.0, "cached": 1.5},
        },
    },
    
    # STT Pricing (per hour of audio)
    "stt": {
        "deepgram": {"per_hour": 80.0},  # Nova-2 model
        "openai": {"per_hour": 60.0},  # Whisper
        "sarvam": {"per_hour": 30.0},  # Saaras v3
    },
    
    # TTS Pricing (per 10k characters)
    "tts": {
        "elevenlabs": {"per_10k_chars": 180.0},  # Turbo v2.5
        "openai": {"per_10k_chars": 120.0},  # TTS-1
        "sarvam": {"per_10k_chars": 30.0},  # Bulbul v3
        "google": {"per_10k_chars": 130.0},  # WaveNet
        "azure": {"per_10k_chars": 140.0},  # Neural voices
    },
    
    # Telephony Pricing (per minute)
    "telephony": {
        "twilio": {"per_minute": 8.5},  # Voice calls (India)
        "exotel": {"per_minute": 5.0},  # Voice calls (India)
        "telnyx": {"per_minute": 6.0},  # Voice calls (India)
        "plivo": {"per_minute": 5.5},  # Voice calls (India)
        "vonage": {"per_minute": 7.0},  # Voice calls (India)
    },
    
    # WhatsApp Pricing (per message)
    "whatsapp": {
        "twilio_whatsapp": {"session": 0.0, "template": 2.5},
        "exotel_whatsapp": {"session": 0.0, "template": 2.0},
        "aisensy": {"session": 0.0, "template": 0.25},
        "gupshup": {"session": 0.0, "template": 0.35},
        "360dialog": {"session": 0.0, "template": 0.45},
        "interakt": {"session": 0.0, "template": 0.30},
    },
    
    # SMS Pricing (per message)
    "sms": {
        "twilio": {"per_message": 0.60},  # India
        "exotel": {"per_message": 0.18},  # Transactional SMS (India)
        "telnyx": {"per_message": 0.50},
        "plivo": {"per_message": 0.45},
        "vonage": {"per_message": 0.55},
    },
}


class UsageTrackingService:
    """Service for tracking API usage and calculating costs."""
    
    @staticmethod
    def create_usage_record(
        db: Session,
        call_id: int,
        user_id: Optional[int] = None,
        agent_id: Optional[int] = None,
    ) -> UsageRecord:
        """Create a new usage record for a call."""
        usage = UsageRecord(
            call_id=call_id,
            user_id=user_id,
            agent_id=agent_id,
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)
        return usage
    
    @staticmethod
    def track_llm_usage(
        db: Session,
        call_id: int,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
    ):
        """Track LLM usage and calculate cost."""
        usage = db.query(UsageRecord).filter(UsageRecord.call_id == call_id).first()
        if not usage:
            logger.warning(f"No usage record found for call {call_id}")
            return
        
        # Get pricing
        pricing = UsageTrackingService._get_llm_pricing(db, provider, model)
        
        # Calculate cost (pricing is per 1M tokens, so divide by 1,000,000)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        cached_cost = (cached_tokens / 1_000_000) * pricing.get("cached", pricing["input"] * 0.5)
        
        # Update usage record
        usage.llm_provider = provider
        usage.llm_model = model
        usage.llm_input_tokens = (usage.llm_input_tokens or 0) + input_tokens
        usage.llm_output_tokens = (usage.llm_output_tokens or 0) + output_tokens
        usage.llm_cached_tokens = (usage.llm_cached_tokens or 0) + cached_tokens
        usage.llm_cost = (usage.llm_cost or 0) + input_cost + output_cost + cached_cost
        usage.calculate_total_cost()
        
        db.commit()
        logger.info(f"Tracked LLM usage for call {call_id}: {input_tokens} in + {output_tokens} out = ₹{input_cost + output_cost:.4f}")
    
    @staticmethod
    def track_stt_usage(
        db: Session,
        call_id: int,
        provider: str,
        duration_seconds: int,
    ):
        """Track STT usage and calculate cost."""
        usage = db.query(UsageRecord).filter(UsageRecord.call_id == call_id).first()
        if not usage:
            logger.warning(f"No usage record found for call {call_id}")
            return
        
        # Get pricing (per hour)
        pricing = UsageTrackingService._get_stt_pricing(db, provider)
        per_hour = pricing["per_hour"]
        
        # Calculate cost
        hours = duration_seconds / 3600
        cost = hours * per_hour
        
        # Update usage record
        usage.stt_provider = provider
        usage.stt_duration_seconds = (usage.stt_duration_seconds or 0) + duration_seconds
        usage.stt_cost = (usage.stt_cost or 0) + cost
        usage.calculate_total_cost()
        
        db.commit()
        logger.info(f"Tracked STT usage for call {call_id}: {duration_seconds}s = ₹{cost:.4f}")
    
    @staticmethod
    def track_tts_usage(
        db: Session,
        call_id: int,
        provider: str,
        characters: int,
    ):
        """Track TTS usage and calculate cost."""
        usage = db.query(UsageRecord).filter(UsageRecord.call_id == call_id).first()
        if not usage:
            logger.warning(f"No usage record found for call {call_id}")
            return
        
        # Get pricing (per 10k characters)
        pricing = UsageTrackingService._get_tts_pricing(db, provider)
        per_10k = pricing["per_10k_chars"]
        
        # Calculate cost
        cost = (characters / 10000) * per_10k
        
        # Update usage record
        usage.tts_provider = provider
        usage.tts_characters = (usage.tts_characters or 0) + characters
        usage.tts_cost = (usage.tts_cost or 0) + cost
        usage.calculate_total_cost()
        
        db.commit()
        logger.info(f"Tracked TTS usage for call {call_id}: {characters} chars = ₹{cost:.4f}")
    
    @staticmethod
    def track_telephony_usage(
        db: Session,
        call_id: int,
        provider: str,
        duration_seconds: int,
    ):
        """Track telephony usage and calculate cost."""
        usage = db.query(UsageRecord).filter(UsageRecord.call_id == call_id).first()
        if not usage:
            logger.warning(f"No usage record found for call {call_id}")
            return
        
        # Get pricing (per minute)
        pricing = UsageTrackingService._get_telephony_pricing(db, provider)
        per_minute = pricing["per_minute"]
        
        # Calculate cost
        minutes = duration_seconds / 60
        cost = minutes * per_minute
        
        # Update usage record
        usage.telephony_provider = provider
        usage.telephony_duration_seconds = (usage.telephony_duration_seconds or 0) + duration_seconds
        usage.telephony_cost = (usage.telephony_cost or 0) + cost
        usage.calculate_total_cost()
        
        db.commit()
        logger.info(f"Tracked telephony usage for call {call_id}: {duration_seconds}s = ₹{cost:.4f}")
    
    @staticmethod
    def get_usage_summary(
        db: Session,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get usage summary for a user or globally.
        
        Returns aggregated usage and costs for the specified period.
        """
        query = db.query(UsageRecord)
        
        if user_id:
            query = query.filter(UsageRecord.user_id == user_id)
        
        if start_date:
            query = query.filter(UsageRecord.created_at >= start_date)
        
        if end_date:
            query = query.filter(UsageRecord.created_at <= end_date)
        
        records = query.all()
        
        # Aggregate data
        summary = {
            "total_calls": len(records),
            "total_cost": sum(r.total_cost or 0 for r in records),
            "llm": {
                "total_input_tokens": sum(r.llm_input_tokens or 0 for r in records),
                "total_output_tokens": sum(r.llm_output_tokens or 0 for r in records),
                "total_cached_tokens": sum(r.llm_cached_tokens or 0 for r in records),
                "total_cost": sum(r.llm_cost or 0 for r in records),
            },
            "stt": {
                "total_duration_seconds": sum(r.stt_duration_seconds or 0 for r in records),
                "total_cost": sum(r.stt_cost or 0 for r in records),
            },
            "tts": {
                "total_characters": sum(r.tts_characters or 0 for r in records),
                "total_cost": sum(r.tts_cost or 0 for r in records),
            },
            "telephony": {
                "total_duration_seconds": sum(r.telephony_duration_seconds or 0 for r in records),
                "total_cost": sum(r.telephony_cost or 0 for r in records),
            },
            "whatsapp": {
                "total_messages": sum(r.whatsapp_messages or 0 for r in records),
                "total_cost": sum(r.whatsapp_cost or 0 for r in records),
            },
            "sms": {
                "total_messages": sum(r.sms_messages or 0 for r in records),
                "total_cost": sum(r.sms_cost or 0 for r in records),
            },
            "breakdown_by_provider": UsageTrackingService._get_provider_breakdown(records),
        }
        
        return summary
    
    @staticmethod
    def _get_provider_breakdown(records: list) -> Dict[str, Any]:
        """Get cost breakdown by provider."""
        breakdown = {}
        
        for record in records:
            # LLM
            if record.llm_provider:
                key = f"llm_{record.llm_provider}"
                if key not in breakdown:
                    breakdown[key] = {"cost": 0, "count": 0}
                breakdown[key]["cost"] += record.llm_cost or 0
                breakdown[key]["count"] += 1
            
            # STT
            if record.stt_provider:
                key = f"stt_{record.stt_provider}"
                if key not in breakdown:
                    breakdown[key] = {"cost": 0, "count": 0}
                breakdown[key]["cost"] += record.stt_cost or 0
                breakdown[key]["count"] += 1
            
            # TTS
            if record.tts_provider:
                key = f"tts_{record.tts_provider}"
                if key not in breakdown:
                    breakdown[key] = {"cost": 0, "count": 0}
                breakdown[key]["cost"] += record.tts_cost or 0
                breakdown[key]["count"] += 1
            
            # Telephony
            if record.telephony_provider:
                key = f"telephony_{record.telephony_provider}"
                if key not in breakdown:
                    breakdown[key] = {"cost": 0, "count": 0}
                breakdown[key]["cost"] += record.telephony_cost or 0
                breakdown[key]["count"] += 1
        
        return breakdown
    
    @staticmethod
    def _get_llm_pricing(db: Session, provider: str, model: str) -> Dict[str, float]:
        """Get LLM pricing from database or defaults."""
        # Try to get from database first
        config = db.query(PricingConfig).filter(
            PricingConfig.provider_type == "llm",
            PricingConfig.provider_name == provider,
            PricingConfig.model_name == model,
            PricingConfig.is_active == 1,
        ).first()
        
        if config and config.pricing:
            return config.pricing
        
        # Fallback to defaults
        return DEFAULT_PRICING["llm"].get(provider, {}).get(model, {"input": 5.0, "output": 15.0, "cached": 2.5})
    
    @staticmethod
    def _get_stt_pricing(db: Session, provider: str) -> Dict[str, float]:
        """Get STT pricing from database or defaults."""
        config = db.query(PricingConfig).filter(
            PricingConfig.provider_type == "stt",
            PricingConfig.provider_name == provider,
            PricingConfig.is_active == 1,
        ).first()
        
        if config and config.pricing:
            return config.pricing
        
        return DEFAULT_PRICING["stt"].get(provider, {"per_hour": 50.0})
    
    @staticmethod
    def _get_tts_pricing(db: Session, provider: str) -> Dict[str, float]:
        """Get TTS pricing from database or defaults."""
        config = db.query(PricingConfig).filter(
            PricingConfig.provider_type == "tts",
            PricingConfig.provider_name == provider,
            PricingConfig.is_active == 1,
        ).first()
        
        if config and config.pricing:
            return config.pricing
        
        return DEFAULT_PRICING["tts"].get(provider, {"per_10k_chars": 100.0})
    
    @staticmethod
    def _get_telephony_pricing(db: Session, provider: str) -> Dict[str, float]:
        """Get telephony pricing from database or defaults."""
        config = db.query(PricingConfig).filter(
            PricingConfig.provider_type == "telephony",
            PricingConfig.provider_name == provider,
            PricingConfig.is_active == 1,
        ).first()
        
        if config and config.pricing:
            return config.pricing
        
        return DEFAULT_PRICING["telephony"].get(provider, {"per_minute": 7.0})


# Convenience function
def track_usage(db: Session, call_id: int, usage_type: str, **kwargs):
    """Convenience function to track usage.
    
    Examples:
        track_usage(db, call_id, "llm", provider="gpt", model="gpt-4o", input_tokens=100, output_tokens=50)
        track_usage(db, call_id, "stt", provider="deepgram", duration_seconds=180)
        track_usage(db, call_id, "tts", provider="elevenlabs", characters=500)
        track_usage(db, call_id, "telephony", provider="twilio", duration_seconds=300)
    """
    service = UsageTrackingService()
    
    if usage_type == "llm":
        service.track_llm_usage(db, call_id, **kwargs)
    elif usage_type == "stt":
        service.track_stt_usage(db, call_id, **kwargs)
    elif usage_type == "tts":
        service.track_tts_usage(db, call_id, **kwargs)
    elif usage_type == "telephony":
        service.track_telephony_usage(db, call_id, **kwargs)
    else:
        logger.warning(f"Unknown usage type: {usage_type}")
