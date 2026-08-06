# Usage Tracking & Cost Analytics Guide

Complete guide to understanding, tracking, and optimizing your API costs on the RMVox platform.

---

## Table of Contents

1. [Overview](#overview)
2. [What Gets Tracked](#what-gets-tracked)
3. [Pricing Information](#pricing-information)
4. [Using the Dashboard](#using-the-dashboard)
5. [Cost Optimization](#cost-optimization)
6. [Integration Guide](#integration-guide)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The **Usage Tracking & Cost Analytics** system provides complete transparency into your API spending across all services. Every API call is tracked in real-time, costs are calculated based on actual provider pricing, and intelligent optimization suggestions help you reduce costs without sacrificing quality.

### Key Features

- **Real-Time Tracking**: Every API call is tracked and costed immediately
- **Complete Transparency**: See exactly what each service costs
- **Cost Breakdown**: Understand spending by provider, service type, and time period
- **Optimization Engine**: Get AI-powered suggestions to reduce costs
- **Historical Analysis**: View trends and patterns over time
- **Zero Markup**: Pass-through pricing with no hidden fees

### Why This Matters

1. **Budget Control**: Know exactly what you're spending
2. **Cost Optimization**: Identify expensive services and find cheaper alternatives
3. **Trust**: Complete transparency builds confidence
4. **ROI**: Make informed decisions about provider choices
5. **Scaling**: Understand costs before scaling up

---

## What Gets Tracked

### 1. LLM (Large Language Model) Usage

**Tracked Metrics:**
- Input tokens (user messages + system prompt)
- Output tokens (assistant responses)
- Cached tokens (if provider supports prompt caching)
- Provider (gpt, claude, gemini, sarvam)
- Model (gpt-4o, claude-sonnet, etc.)

**Cost Calculation:**
- Based on per-million-token pricing
- Separate rates for input/output/cached tokens
- Aggregated per call

**Example:**
```
Input: 1,000 tokens × ₹5/1M = ₹0.005
Output: 500 tokens × ₹15/1M = ₹0.0075
Total LLM Cost: ₹0.0125 (~1.25 paisa)
```

### 2. STT (Speech-to-Text) Usage

**Tracked Metrics:**
- Audio duration in seconds
- Provider (deepgram, openai, sarvam)

**Cost Calculation:**
- Based on per-hour pricing
- Prorated for actual duration
- Example: 3 minutes = 0.05 hours

**Example:**
```
Duration: 180 seconds (3 minutes)
Provider: Sarvam (₹30/hour)
Cost: (180/3600) × ₹30 = ₹1.50
```

### 3. TTS (Text-to-Speech) Usage

**Tracked Metrics:**
- Character count (text to synthesize)
- Provider (elevenlabs, openai, sarvam, google, azure)

**Cost Calculation:**
- Based on per-10k-characters pricing
- Prorated for actual characters

**Example:**
```
Characters: 1,500
Provider: ElevenLabs (₹180/10k)
Cost: (1500/10000) × ₹180 = ₹27
```

### 4. Telephony Usage

**Tracked Metrics:**
- Call duration in seconds
- Provider (twilio, exotel, telnyx, plivo, vonage)

**Cost Calculation:**
- Based on per-minute pricing
- Prorated for actual duration

**Example:**
```
Duration: 300 seconds (5 minutes)
Provider: Exotel (₹5/minute)
Cost: (300/60) × ₹5 = ₹25
```

### 5. Messaging Usage

**WhatsApp:**
- Message count
- Message type (session/template)
- Provider-specific pricing

**SMS:**
- Message count
- Per-message pricing

**Email:**
- Message count
- Usually free via SMTP

---

## Pricing Information

All prices are in **INR (Indian Rupees)** and reflect 2026 market rates.

### LLM Pricing (per 1 million tokens)

| Provider | Model | Input | Output | Cached |
|----------|-------|-------|--------|--------|
| **GPT** | gpt-4o | ₹5 | ₹15 | ₹2.5 |
| **GPT** | gpt-4o-mini | ₹1.5 | ₹6 | ₹0.75 |
| **Claude** | claude-opus | ₹15 | ₹75 | ₹7.5 |
| **Claude** | claude-sonnet | ₹3 | ₹15 | ₹1.5 |
| **Gemini** | gemini-1.5-pro | ₹3.5 | ₹10.5 | ₹1.75 |
| **Gemini** | gemini-1.5-flash | ₹0.35 | ₹1.05 | ₹0.175 |
| **Sarvam** | sarvam-105b | ₹4 | ₹16 | ₹2.5 |
| **Sarvam** | sarvam-30b | ₹2.5 | ₹10 | ₹1.5 |

**Key Insights:**
- Gemini Flash is **14x cheaper** than GPT-4o for input tokens
- Cached tokens cost ~50% less on most providers
- Sarvam offers competitive pricing for Indian users

### STT Pricing (per hour)

| Provider | Model | Cost/Hour |
|----------|-------|-----------|
| **Deepgram** | Nova-2 | ₹80 |
| **OpenAI** | Whisper | ₹60 |
| **Sarvam** | Saaras v3 | ₹30 |

**Key Insights:**
- Sarvam is **62.5% cheaper** than Deepgram
- Sarvam excels at Indian languages
- Most calls use 1-5 minutes (₹0.50-₹2.50 on Sarvam)

### TTS Pricing (per 10,000 characters)

| Provider | Model | Cost/10k |
|----------|-------|----------|
| **ElevenLabs** | Turbo v2.5 | ₹180 |
| **OpenAI** | TTS-1 | ₹120 |
| **Google** | WaveNet | ₹130 |
| **Azure** | Neural | ₹140 |
| **Sarvam** | Bulbul v3 | ₹30 |

**Key Insights:**
- Sarvam is **83% cheaper** than ElevenLabs
- Quality difference is minimal for most use cases
- 10k characters ≈ 1,500-2,000 words ≈ 15-20 minutes of audio

### Telephony Pricing (per minute)

| Provider | Cost/Minute |
|----------|-------------|
| **Twilio** | ₹8.5 |
| **Exotel** | ₹5.0 |
| **Telnyx** | ₹6.0 |
| **Plivo** | ₹5.5 |
| **Vonage** | ₹7.0 |

**Key Insights:**
- Exotel is most cost-effective for India
- 10-minute call costs ₹50-₹85 depending on provider

### WhatsApp Pricing (per message)

| Provider | Session (24h) | Template |
|----------|---------------|----------|
| **Twilio** | Free | ₹2.50 |
| **Exotel** | Free | ₹2.00 |
| **AISENSY** | Free | ₹0.25 |
| **Gupshup** | Free | ₹0.35 |
| **360Dialog** | Free | ₹0.45 |
| **Interakt** | Free | ₹0.30 |

**Key Insights:**
- Session messages (replies within 24h) are FREE
- AISENSY is **10x cheaper** than Twilio for templates
- Use session messages whenever possible

### SMS Pricing (per message)

| Provider | Cost/Message |
|----------|--------------|
| **Twilio** | ₹0.60 |
| **Exotel** | ₹0.18 |
| **Telnyx** | ₹0.50 |
| **Plivo** | ₹0.45 |
| **Vonage** | ₹0.55 |

**Key Insights:**
- Exotel is cheapest for India
- SMS requires DLT registration in India

---

## Using the Dashboard

Navigate to **Usage & Costs** in the main menu to access the dashboard.

### Period Selector

Choose from:
- **Today**: Current day's usage
- **This Week**: Monday to now
- **This Month**: 1st of month to now

### Summary Cards

Four cards show high-level metrics:

1. **Total Cost** (Purple gradient card):
   - Sum of all API costs for the period
   - Includes LLM, STT, TTS, telephony, messaging
   - Shows trending indicator

2. **Total Calls**:
   - Number of calls placed
   - Click to view Call History

3. **LLM Cost**:
   - Total spent on LLM tokens
   - Usually 5-15% of total cost

4. **Telephony Cost**:
   - Total spent on call minutes
   - Usually 60-80% of total cost

### Detailed Breakdown

**LLM Usage Card:**
- Input tokens used
- Output tokens generated
- Cached tokens saved
- Total LLM cost

**Voice Services Card:**
- STT: Minutes processed + cost
- TTS: Characters generated + cost

### Cost Optimization Panel

**Green gradient panel showing:**
- Current monthly cost
- Potential monthly savings
- Estimated annual savings
- List of specific suggestions:
  - Service type (TTS, LLM, STT)
  - Current cost
  - Estimated new cost
  - Monthly savings
  - Recommendation text

**Example Suggestion:**
```
Switch to Sarvam TTS to save 50-80%
Sarvam Bulbul v3 offers excellent quality at ₹30/10k 
characters vs ElevenLabs at ₹180/10k

Current: ₹540/month
New: ₹108/month
Save: ₹432/month (₹5,184/year)
```

### Daily Cost Trend Chart

- Last 14 days of activity
- Animated bars show cost per day
- Displays call count per day
- Gradient purple bars
- Hover for exact values

---

## Cost Optimization

### Automatic Optimization Suggestions

The system analyzes your usage patterns and suggests optimizations when:

**TTS Spending > ₹100/month:**
- Suggests switching to Sarvam TTS
- Shows 50-80% savings potential
- Maintains quality for most use cases

**LLM Spending > ₹50/month:**
- Suggests Gemini Flash for simple queries
- Shows 10x cost reduction
- Maintains quality for routine conversations

**STT Spending > ₹200/month:**
- Suggests Sarvam STT
- Shows 60% savings
- Better for Indian languages

### Manual Optimization Strategies

#### 1. Use Gemini Flash for Simple Conversations

**When:**
- Simple Q&A
- Information retrieval
- Routine conversations
- No complex reasoning needed

**Savings:**
- 10x cheaper than GPT-4o
- ₹0.35/1M input vs ₹5/1M

**How:**
- Set agent's LLM to "gemini"
- Use "gemini-1.5-flash" model

#### 2. Switch to Sarvam for Voice

**When:**
- Indian language support needed
- Cost is a concern
- High call volumes

**Savings:**
- TTS: 83% cheaper (₹30 vs ₹180 per 10k chars)
- STT: 62.5% cheaper (₹30 vs ₹80 per hour)

**How:**
- Set agent's TTS to "sarvam"
- Set agent's STT to "sarvam"

#### 3. Use Session Messages on WhatsApp

**When:**
- Replying to user messages
- Within 24-hour window
- Conversational use case

**Savings:**
- FREE vs ₹0.25-₹2.50 per template message
- 100% savings

**How:**
- Use "Send WhatsApp" node with message_type="session"
- Only use templates for business-initiated messages

#### 4. Implement Prompt Caching

**When:**
- Long system prompts
- Repeated context
- High message volumes

**Savings:**
- 50% off cached tokens
- Significant for long prompts

**How:**
- Use providers that support caching (GPT, Claude)
- Structure prompts for maximum cache hits

#### 5. Choose Exotel for Telephony (India)

**When:**
- Operating in India
- High call volumes
- Cost-sensitive

**Savings:**
- 41% cheaper than Twilio (₹5 vs ₹8.5 per minute)
- 10-minute call: Save ₹35

**How:**
- Set up Exotel integration
- Configure Exotel credentials in Integrations

### Cost Per Call Estimates

**Low-Cost Configuration** (Gemini Flash + Sarvam):
- LLM: ₹0.005-₹0.01
- STT (3 min): ₹1.50
- TTS (1,500 chars): ₹4.50
- Telephony (5 min): ₹25
- **Total: ₹31 per call**

**Mid-Range Configuration** (GPT-4o mini + Deepgram + OpenAI TTS):
- LLM: ₹0.02-₹0.04
- STT (3 min): ₹4.00
- TTS (1,500 chars): ₹18
- Telephony (5 min): ₹42.50
- **Total: ₹64.50 per call**

**High-Quality Configuration** (GPT-4o + Deepgram + ElevenLabs):
- LLM: ₹0.05-₹0.10
- STT (3 min): ₹4.00
- TTS (1,500 chars): ₹27
- Telephony (5 min): ₹42.50
- **Total: ₹73.60 per call**

**Key Insight:**
You can reduce cost per call by **57%** (₹73.60 → ₹31) by switching to Gemini Flash + Sarvam without significant quality loss.

---

## Integration Guide

### For Backend Developers

#### 1. Create Usage Record at Call Start

```python
from app.services.usage_tracking_service import UsageTrackingService

# When a call starts
usage = UsageTrackingService.create_usage_record(
    db=db,
    call_id=call.id,
    user_id=call.user_id,
    agent_id=call.agent_id
)
```

#### 2. Track LLM Usage

```python
from app.services.usage_tracking_service import track_usage

# After LLM completion
track_usage(
    db=db,
    call_id=call_id,
    usage_type="llm",
    provider="gpt",  # gpt, claude, gemini, sarvam
    model="gpt-4o",
    input_tokens=1500,
    output_tokens=800,
    cached_tokens=500  # optional
)
```

#### 3. Track STT Usage

```python
# After transcription
track_usage(
    db=db,
    call_id=call_id,
    usage_type="stt",
    provider="deepgram",  # deepgram, openai, sarvam
    duration_seconds=180
)
```

#### 4. Track TTS Usage

```python
# After synthesis
track_usage(
    db=db,
    call_id=call_id,
    usage_type="tts",
    provider="elevenlabs",  # elevenlabs, openai, sarvam, google, azure
    characters=1500
)
```

#### 5. Track Telephony Usage

```python
# After call ends
track_usage(
    db=db,
    call_id=call_id,
    usage_type="telephony",
    provider="twilio",  # twilio, exotel, telnyx, plivo, vonage
    duration_seconds=300
)
```

### Token Counting

For LLM usage tracking, you need to count tokens:

**Option 1: Use Provider Response**
```python
response = openai.chat.completions.create(...)
input_tokens = response.usage.prompt_tokens
output_tokens = response.usage.completion_tokens
```

**Option 2: Use tiktoken (for OpenAI)**
```python
import tiktoken

encoding = tiktoken.encoding_for_model("gpt-4o")
input_tokens = len(encoding.encode(prompt))
output_tokens = len(encoding.encode(response))
```

**Option 3: Estimate (rough)**
```python
# 1 token ≈ 0.75 words ≈ 4 characters
input_tokens = len(prompt) // 4
output_tokens = len(response) // 4
```

---

## Database Schema

### `usage_records` Table

Stores all usage data per call.

```sql
CREATE TABLE usage_records (
    id INTEGER PRIMARY KEY,
    call_id INTEGER REFERENCES calls(id),
    user_id INTEGER REFERENCES users(id),
    agent_id INTEGER REFERENCES agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- LLM Usage
    llm_provider VARCHAR,
    llm_model VARCHAR,
    llm_input_tokens INTEGER DEFAULT 0,
    llm_output_tokens INTEGER DEFAULT 0,
    llm_cached_tokens INTEGER DEFAULT 0,
    llm_cost FLOAT DEFAULT 0.0,
    
    -- STT Usage
    stt_provider VARCHAR,
    stt_duration_seconds INTEGER DEFAULT 0,
    stt_cost FLOAT DEFAULT 0.0,
    
    -- TTS Usage
    tts_provider VARCHAR,
    tts_characters INTEGER DEFAULT 0,
    tts_cost FLOAT DEFAULT 0.0,
    
    -- Telephony Usage
    telephony_provider VARCHAR,
    telephony_duration_seconds INTEGER DEFAULT 0,
    telephony_cost FLOAT DEFAULT 0.0,
    
    -- Messaging Usage
    whatsapp_messages INTEGER DEFAULT 0,
    whatsapp_cost FLOAT DEFAULT 0.0,
    sms_messages INTEGER DEFAULT 0,
    sms_cost FLOAT DEFAULT 0.0,
    email_messages INTEGER DEFAULT 0,
    email_cost FLOAT DEFAULT 0.0,
    
    -- Total
    total_cost FLOAT DEFAULT 0.0,
    metadata JSON
);

CREATE INDEX idx_usage_call_id ON usage_records(call_id);
CREATE INDEX idx_usage_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_created_at ON usage_records(created_at);
CREATE INDEX idx_usage_total_cost ON usage_records(total_cost);
```

### `pricing_configs` Table

Stores provider pricing configurations.

```sql
CREATE TABLE pricing_configs (
    id INTEGER PRIMARY KEY,
    provider_type VARCHAR,  -- llm, stt, tts, telephony, whatsapp, sms
    provider_name VARCHAR,  -- openai, sarvam, twilio, etc.
    model_name VARCHAR,     -- gpt-4o, claude-sonnet, etc.
    pricing JSON,           -- {"input_tokens_per_million": 5.0, ...}
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE INDEX idx_pricing_type ON pricing_configs(provider_type);
CREATE INDEX idx_pricing_provider ON pricing_configs(provider_name);
CREATE INDEX idx_pricing_active ON pricing_configs(is_active);
```

---

## API Reference

### Get Usage Summary

```http
GET /usage/summary?period=this_month
```

**Query Parameters:**
- `period` (optional): "today", "this_week", "this_month", "custom"
- `start_date` (optional): For custom period (YYYY-MM-DD)
- `end_date` (optional): For custom period (YYYY-MM-DD)

**Response:**
```json
{
  "period": "This Month",
  "total_calls": 150,
  "total_cost": 4650.50,
  "llm": {
    "total_input_tokens": 500000,
    "total_output_tokens": 250000,
    "total_cached_tokens": 100000,
    "total_cost": 12.50
  },
  "stt": {
    "total_duration_seconds": 9000,
    "total_cost": 75.00
  },
  "tts": {
    "total_characters": 45000,
    "total_cost": 135.00
  },
  "telephony": {
    "total_duration_seconds": 45000,
    "total_cost": 3750.00
  }
}
```

### Get Daily Usage

```http
GET /usage/daily?days=30
```

**Query Parameters:**
- `days` (optional): Number of days to fetch (default: 30)

**Response:**
```json
{
  "period": "Last 30 days",
  "data": [
    {
      "date": "2026-07-26",
      "calls": 12,
      "cost": 372.50
    },
    ...
  ]
}
```

### Get Provider Breakdown

```http
GET /usage/providers?period=this_month
```

**Response:**
```json
{
  "period": "this_month",
  "providers": {
    "llm_gpt": {"cost": 8.50, "count": 100},
    "llm_gemini": {"cost": 4.00, "count": 50},
    "stt_sarvam": {"cost": 75.00, "count": 150},
    "tts_sarvam": {"cost": 135.00, "count": 150},
    "telephony_exotel": {"cost": 3750.00, "count": 150}
  }
}
```

### Get Cost Optimization Suggestions

```http
GET /usage/cost-optimization
```

**Response:**
```json
{
  "current_monthly_cost": 4650.50,
  "potential_monthly_savings": 1860.20,
  "estimated_annual_savings": 22322.40,
  "suggestions": [
    {
      "type": "tts",
      "title": "Switch to Sarvam TTS to save 50-80%",
      "current_cost": 270.00,
      "estimated_new_cost": 54.00,
      "savings": 216.00,
      "recommendation": "Sarvam Bulbul v3 offers excellent quality at ₹30/10k characters vs ElevenLabs at ₹180/10k"
    }
  ]
}
```

---

## Best Practices

### 1. Monitor Usage Regularly

- Check dashboard weekly
- Review cost trends monthly
- Set up alerts for unusual spikes

### 2. Implement Cost Optimization Suggestions

- Review suggestions monthly
- Test new providers in staging first
- Measure quality before full rollout
- Monitor customer satisfaction after changes

### 3. Use Appropriate Models for Tasks

**Simple Tasks** (FAQs, routing, data extraction):
- Use Gemini Flash
- 10x cheaper than GPT-4o
- Good quality for routine tasks

**Complex Tasks** (reasoning, analysis, creative writing):
- Use GPT-4o or Claude Sonnet
- Better quality justifies higher cost
- Use sparingly for high-value interactions

### 4. Optimize Prompt Length

- Keep system prompts concise
- Remove unnecessary examples
- Use prompt caching for long prompts
- Template common sections

### 5. Choose Regional Providers

**India:**
- Use Sarvam for STT/TTS (better pricing + language support)
- Use Exotel for telephony (₹5/min vs ₹8.5/min)

**Global:**
- Use Gemini Flash for LLM (global availability, low cost)
- Use Deepgram for STT (multi-language support)

### 6. Batch Operations When Possible

- Combine multiple TTS requests
- Use streaming for real-time needs
- Cache common responses

### 7. Monitor Token Usage

- Implement token counting
- Set max_tokens limits
- Monitor input/output ratio
- Optimize for brevity

### 8. Use Session Messages on WhatsApp

- Reply within 24-hour window (FREE)
- Avoid templates unless necessary
- Save ₹0.25-₹2.50 per message

### 9. Set Usage Budgets

- Define monthly budget
- Monitor spending vs budget
- Implement alerts at 50%, 80%, 100%
- Pause non-critical operations if exceeded

### 10. Review Pricing Quarterly

- Provider pricing changes frequently
- New providers offer better rates
- Technology improves (lower costs)
- Update pricing_configs table

---

## Troubleshooting

### Usage Not Showing

**Check:**
1. Is usage tracking integrated in your code?
2. Are you calling `track_usage()` after each API call?
3. Is the `call_id` valid?
4. Check backend logs for errors

**Fix:**
```python
# Add tracking after each API call
track_usage(db, call_id, "llm", provider="gpt", model="gpt-4o", input_tokens=100, output_tokens=50)
```

### Costs Seem Incorrect

**Check:**
1. Is pricing up-to-date in `pricing_configs`?
2. Are token counts accurate?
3. Is duration measured correctly?
4. Check `usage_records` table directly

**Fix:**
```sql
-- Check actual usage
SELECT * FROM usage_records WHERE call_id = 123;

-- Verify pricing
SELECT * FROM pricing_configs WHERE provider_type = 'llm' AND is_active = 1;
```

### Missing Historical Data

**Cause:**
- Usage tracking wasn't integrated earlier
- Database migration issue

**Fix:**
- Historical data cannot be recovered
- Start tracking from now
- Estimate past costs manually if needed

### Dashboard Loading Slowly

**Cause:**
- Large amount of data
- Missing database indexes

**Fix:**
```sql
-- Add indexes
CREATE INDEX idx_usage_created_at ON usage_records(created_at);
CREATE INDEX idx_usage_total_cost ON usage_records(total_cost);
CREATE INDEX idx_usage_user_id ON usage_records(user_id);
```

### Optimization Suggestions Not Appearing

**Cause:**
- Spending below thresholds
- Not enough data

**Thresholds:**
- TTS: ₹100/month
- LLM: ₹50/month
- STT: ₹200/month

**Fix:**
- Lower thresholds in `usage.py`:
```python
if tts_cost > 50:  # Changed from 100
    suggestions.append(...)
```

---

## Summary

The **Usage Tracking & Cost Analytics** system provides:

✅ **Complete Transparency**: Know exactly what you're spending
✅ **Real-Time Tracking**: See costs as they happen
✅ **Intelligent Optimization**: AI-powered savings suggestions
✅ **Beautiful Dashboard**: Intuitive charts and breakdowns
✅ **Zero Markup**: Pass-through pricing, no hidden fees
✅ **Historical Analysis**: Trends and patterns over time

**Key Savings Opportunities:**
- Switch to Gemini Flash: **10x cheaper** for LLM
- Switch to Sarvam TTS: **83% cheaper** than ElevenLabs
- Switch to Sarvam STT: **62.5% cheaper** than Deepgram
- Use WhatsApp session messages: **100% free** vs templates
- Use Exotel in India: **41% cheaper** than Twilio

**Potential Savings:**
For 1,000 calls/month, switching to cost-optimized providers can save **₹20,000-30,000/month** or **₹2.4-3.6 lakhs/year** while maintaining excellent quality.

**Get Started:**
1. Navigate to "Usage & Costs" in the menu
2. Review your current spending
3. Check optimization suggestions
4. Test new providers in staging
5. Roll out optimizations gradually
6. Monitor quality and costs
7. Iterate monthly

**Questions?**
- Check the [API Reference](#api-reference)
- Review [Best Practices](#best-practices)
- See [Troubleshooting](#troubleshooting)
- Contact support if stuck

---

*Last Updated: July 26, 2026*
*Version: 1.0.0*
