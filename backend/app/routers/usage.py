"""Usage and cost tracking API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.dependencies import get_current_user_optional
from app.models.user import User
from app.services.usage_tracking_service import UsageTrackingService
from pydantic import BaseModel

router = APIRouter(
    prefix="/usage",
    tags=["usage"],
    responses={404: {"description": "Not found"}},
)


class UsageSummaryResponse(BaseModel):
    """Response model for usage summary."""
    period: str  # "today", "this_week", "this_month", or date range
    total_calls: int
    total_cost: float  # in INR
    llm: dict
    stt: dict
    tts: dict
    telephony: dict
    whatsapp: dict
    sms: dict
    breakdown_by_provider: dict
    
    class Config:
        from_attributes = True


@router.get("/summary", response_model=UsageSummaryResponse)
def get_usage_summary(
    period: str = Query("this_month", description="Period: today, this_week, this_month, or custom"),
    start_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get usage and cost summary for a period.
    
    Query parameters:
    - period: "today", "this_week", "this_month", or "custom"
    - start_date: For custom period (YYYY-MM-DD)
    - end_date: For custom period (YYYY-MM-DD)
    
    Returns aggregated usage and costs.
    """
    # Calculate date range based on period
    now = datetime.now()
    
    if period == "today":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
        period_label = "Today"
    elif period == "this_week":
        start_dt = now - timedelta(days=now.weekday())  # Monday
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
        period_label = "This Week"
    elif period == "this_month":
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
        period_label = "This Month"
    elif period == "custom" and start_date and end_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
        period_label = f"{start_date} to {end_date}"
    else:
        # Default to this month
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
        period_label = "This Month"
    
    # Get user ID if authenticated
    user_id = current_user.id if current_user else None
    
    # Get summary from service
    summary = UsageTrackingService.get_usage_summary(
        db=db,
        user_id=user_id,
        start_date=start_dt,
        end_date=end_dt,
    )
    
    # Add period label
    summary["period"] = period_label
    
    return summary


@router.get("/daily")
def get_daily_usage(
    days: int = Query(30, description="Number of days to fetch"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get daily usage data for charts.
    
    Returns array of daily usage/cost for the last N days.
    """
    from app.models.usage import UsageRecord
    from sqlalchemy import func, cast, Date
    
    user_id = current_user.id if current_user else None
    start_date = datetime.now() - timedelta(days=days)
    
    query = db.query(
        cast(UsageRecord.created_at, Date).label('date'),
        func.count(UsageRecord.id).label('calls'),
        func.sum(UsageRecord.total_cost).label('cost'),
    ).filter(
        UsageRecord.created_at >= start_date
    )
    
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    
    results = query.group_by(cast(UsageRecord.created_at, Date)).all()
    
    # Format for frontend
    daily_data = [
        {
            "date": str(row.date),
            "calls": row.calls,
            "cost": float(row.cost or 0),
        }
        for row in results
    ]
    
    return {
        "period": f"Last {days} days",
        "data": daily_data,
    }


@router.get("/providers")
def get_provider_usage(
    period: str = Query("this_month", description="Period: today, this_week, this_month"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get usage breakdown by provider.
    
    Returns cost and usage per provider for charts.
    """
    # Calculate date range
    now = datetime.now()
    
    if period == "today":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_week":
        start_dt = now - timedelta(days=now.weekday())
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    else:  # this_month
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    user_id = current_user.id if current_user else None
    
    summary = UsageTrackingService.get_usage_summary(
        db=db,
        user_id=user_id,
        start_date=start_dt,
        end_date=now,
    )
    
    return {
        "period": period,
        "providers": summary.get("breakdown_by_provider", {}),
    }


@router.get("/cost-optimization")
def get_cost_optimization_suggestions(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get cost optimization suggestions based on usage patterns.
    
    Analyzes usage and suggests cheaper alternatives.
    """
    user_id = current_user.id if current_user else None
    
    # Get this month's usage
    now = datetime.now()
    start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    summary = UsageTrackingService.get_usage_summary(
        db=db,
        user_id=user_id,
        start_date=start_dt,
        end_date=now,
    )
    
    suggestions = []
    
    # Analyze TTS usage
    tts_cost = summary.get("tts", {}).get("total_cost", 0)
    if tts_cost > 100:  # If spending more than ₹100/month on TTS
        suggestions.append({
            "type": "tts",
            "title": "Switch to Sarvam TTS to save 50-80%",
            "current_cost": tts_cost,
            "estimated_new_cost": tts_cost * 0.2,  # Sarvam is ~80% cheaper
            "savings": tts_cost * 0.8,
            "recommendation": "Sarvam Bulbul v3 offers excellent quality at ₹30/10k characters vs ElevenLabs at ₹180/10k",
        })
    
    # Analyze LLM usage
    llm_cost = summary.get("llm", {}).get("total_cost", 0)
    if llm_cost > 50:  # If spending more than ₹50/month on LLM
        suggestions.append({
            "type": "llm",
            "title": "Consider using Gemini Flash for simple queries",
            "current_cost": llm_cost,
            "estimated_new_cost": llm_cost * 0.7,
            "savings": llm_cost * 0.3,
            "recommendation": "Gemini 1.5 Flash is 10x cheaper than GPT-4o for routine conversations",
        })
    
    # Analyze STT usage
    stt_cost = summary.get("stt", {}).get("total_cost", 0)
    if stt_cost > 200:
        suggestions.append({
            "type": "stt",
            "title": "Switch to Sarvam STT to save 60%",
            "current_cost": stt_cost,
            "estimated_new_cost": stt_cost * 0.4,
            "savings": stt_cost * 0.6,
            "recommendation": "Sarvam Saaras v3 costs ₹30/hour vs Deepgram at ₹80/hour, with great accuracy for Indian languages",
        })
    
    # Calculate total potential savings
    total_current = summary.get("total_cost", 0)
    total_savings = sum(s["savings"] for s in suggestions)
    
    return {
        "current_monthly_cost": total_current,
        "potential_monthly_savings": total_savings,
        "estimated_annual_savings": total_savings * 12,
        "suggestions": suggestions,
    }
