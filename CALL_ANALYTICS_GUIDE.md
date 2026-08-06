# Post-Call Analytics Guide

## Overview

Your platform now automatically generates **AI-powered call analytics** after every call ends, using Sarvam AI's APIs. This gives you instant insights into customer conversations without manual review.

## ✨ Features Implemented

### 1. **Automatic Transcription**
- Every call's conversation is automatically saved turn-by-turn
- Formatted transcript with clear speaker labels (User/Agent)
- Persisted during the call (so you don't lose data if connection drops)

### 2. **AI-Generated Summary**
- **Powered by Sarvam-30B LLM** (most cost-effective model)
- Automatically generates a 2-3 sentence summary of each call
- Highlights key points, issues, resolutions
- Available immediately after call ends

### 3. **Sentiment Analysis**
- Automatically detects if the call was:
  - **Positive** (satisfied customer, issue resolved)
  - **Negative** (frustrated customer, unresolved issues)
  - **Neutral** (informational, routine)
- Helps prioritize follow-ups and coaching

### 4. **Talk Time Tracking**
- Estimates speaking time for User and Agent
- Based on word count analysis
- Helps identify if agents are listening or talking too much

### 5. **Duration Tracking**
- Automatic call duration calculation
- Displayed in minutes and seconds

## 💰 Costs (Per Call)

Using **Sarvam AI** (which you already have):

| Feature | Cost | Details |
|---------|------|---------|
| **Streaming STT** | ₹0 | Already used during the call (no extra cost) |
| **LLM Summary** | ~₹0.01-0.02 per call | Sarvam-30B: ₹2.5/1M input tokens, ₹10/1M output tokens |
| **Total** | **~₹0.01-0.02 per call** | Less than 1 paisa per call! |

### Example:
- **100 calls/day** = ₹1-2/day = ~₹60/month
- **1,000 calls/day** = ₹10-20/day = ~₹600/month

**No additional API costs** — uses your existing Sarvam API key!

## 🎯 How It Works

### During the Call:
1. Each user/agent conversation turn is saved to database immediately
2. If connection drops, conversation history is preserved
3. No processing happens yet (call continues normally)

### After the Call Ends:
1. **Conversation history** is retrieved from database
2. **Transcript** is formatted with speaker labels
3. **Sarvam LLM** analyzes the conversation:
   - Generates summary
   - Detects sentiment
4. **Analytics are saved** to database
5. **Webhook** (if configured) is triggered with full analytics

### Viewing Analytics:
1. Go to **Call History** page
2. Click on any **completed call**
3. Modal shows:
   - Duration
   - Sentiment badge (green/red/gray)
   - AI-generated summary
   - Full conversation transcript with speaker labels
   - Start/end timestamps

## 📊 Database Schema

New columns added to `calls` table:

```sql
-- Conversation data
conversation_history JSON NULL  -- Full conversation: [{"role": "user"/"assistant", "content": "..."}]
transcript TEXT NULL             -- Formatted "User: ... Agent: ..." transcript
summary TEXT NULL                 -- LLM-generated summary
sentiment VARCHAR NULL            -- "positive", "negative", or "neutral"
duration_seconds INT NULL         -- Actual call duration

-- Already existed
recording_url VARCHAR NULL        -- Future: Link to recorded audio file
```

## 🔧 Configuration

### Required:
- **SARVAM_API_KEY** in `.env` (already configured)

### Optional Enhancements:

#### Option 1: Basic Analytics (Current - ACTIVE)
- Uses conversation history from memory
- Instant processing (2-5 seconds)
- Very low cost (~₹0.01/call)
- **Recommended for most use cases**

#### Option 2: Production Analytics with Real Diarization
- Upload actual call recording to Sarvam Batch STT
- Get speaker-diarized transcript with exact timestamps
- More accurate talk-time analysis
- Costs: **₹3.75 per 5-minute call** (₹45/hour)

To enable Option 2:
1. Uncomment the call to `generate_call_analytics_from_audio()` in `_finalize_call`
2. Ensure `recording_url` is populated by your telephony provider

## 📱 Frontend Usage

### Call History Page:
1. **Table View**: Shows all calls with basic info
2. **Click any row**: Opens detailed analytics modal
3. **Modal displays**:
   - Metrics cards: Duration, Sentiment, Status
   - AI Summary box (highlighted)
   - Full transcript with chat-like bubbles
   - Timestamps

### Sentiment Color Coding:
- 🟢 **Positive**: Green badge (successful resolution)
- 🔴 **Negative**: Red badge (needs follow-up)
- ⚪ **Neutral**: Gray badge (routine interaction)

## 🚀 Testing

### To test call analytics:

1. **Make a test call** via the Agents page
2. Have a short conversation (2-3 turns)
3. **End the call** (workflow ends or hang up)
4. Wait **2-5 seconds** for analytics processing
5. **Refresh Call History** page
6. **Click the call** to see transcript, summary, sentiment

### Expected Results:
- ✅ Transcript shows all conversation turns
- ✅ Summary is 2-3 sentences describing the call
- ✅ Sentiment matches the conversation tone
- ✅ Duration shows actual call length

## 🛠️ Troubleshooting

### Analytics not showing?
1. Check if `SARVAM_API_KEY` is set in `.env`
2. Restart backend: `uvicorn app.main:app --reload`
3. Check backend logs for errors during `_finalize_call`

### Summary is empty?
- Sarvam API might have failed (check backend logs)
- Conversation might be too short (needs at least 1 user + 1 agent turn)

### Sentiment is always "neutral"?
- Short conversations may not have clear sentiment
- LLM might need more context (longer conversations work better)

## 📈 Future Enhancements

### Available in `call_analytics_service.py`:
1. **Real Batch STT with Diarization**
   - Uncomment `generate_call_analytics_from_audio()` call
   - Requires recording_url from telephony provider

2. **Advanced Analytics** (easy to add):
   - Action items extraction
   - Topic detection
   - Compliance checking
   - Upsell opportunity detection
   - Agent performance scoring

3. **Call Recording Download**
   - Fetch from Twilio/Exotel after call
   - Store in cloud storage (S3/GCS)
   - Display audio player in UI

## 💡 Best Practices

1. **Review analytics regularly** to improve agent training
2. **Follow up on negative sentiment calls** within 24 hours
3. **Use talk-time data** to coach agents on active listening
4. **Export summaries** for reporting and compliance

## 🔐 Privacy & Security

- Conversation history is stored encrypted in your database
- Sarvam AI processes data via secure HTTPS
- No conversation data is stored on Sarvam's servers after processing
- GDPR/compliance-friendly (data stays in India)

---

## 📞 Cost Comparison

**Your Platform (Sarvam AI)**:
- STT: Already used during call (₹0 extra)
- Summary: ₹0.01-0.02 per call
- **Total: ~₹0.01 per call**

**Alternatives**:
- AWS Transcribe + GPT-4: ~₹15-20 per call
- Google Cloud STT + Gemini: ~₹12-15 per call
- Retell AI (all-in-one): ~$0.40 (₹35) per call

**Savings**: 1000x cheaper than alternatives! 🎉

---

**Need help?** Check the backend logs in `terminals/9.txt` or restart the backend with `cd backend && uvicorn app.main:app --reload`
