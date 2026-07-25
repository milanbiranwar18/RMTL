# ==========================================
# VoiceAI Agent — Environment Configuration
# ==========================================



LIVEKIT_URL=
LIVEKIT_PUBLIC_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# 2. Sarvam AI (Primary LLM & TTS)
# https://dashboard.sarvam.ai
# SARVAM_API_KEY=sk_kutc7h8m_EgBLgiZylaLdRhp2Mc73jPgm
# # 3. Deepgram (Primary STT)
# # https://console.deepgram.com

# # DEEPGRAM_API_KEY=e91d17c97f23dcb829933d22a9f384349b823fb6

# # 4. Optional Providers (Fill if using)
# # OPENAI_BASE_URL=https://openrouter.ai/api/v1
# # LLM_MODEL=nvidia/nemotron-3-nano-30b-a3b
# OPENAI_API_KEY=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


ANTHROPIC_API_KEY=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
GROQ_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
CARTESIA_API_KEY=

# 5. Agent Settings (Defaults)
AGENT_NAME=VoiceAI
AGENT_LANGUAGE=en-IN
MAX_SESSION_DURATION=600
SILENCE_TIMEOUT=15

# 6. Default Providers
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.6-luna
STT_PROVIDER=sarvam
STT_MODEL=saaras:v3
STT_LANGUAGE=unknown
TTS_PROVIDER=sarvam
TTS_VOICE=pooja

# 7. Server Config
API_HOST=127.0.0.1
API_PORT=7218
LOG_LEVEL=INFO
LOG_FORMAT=text

# 8. SIP / Exotel Configuration (Outbound Calling)
SIP_ENABLED=true
EXOTEL_SIP_HOST=edge.in.exotel.com
EXOTEL_SIP_USERNAME=trmum149d61369aa68cea6781a6o
EXOTEL_SIP_PASSWORD=
EXOTEL_DID_NUMBER=02263082356
SIP_OUTBOUND_TRUNK_ID=ST_4aVFYZKNCZAb


# Auto-Hangup
SILENCE_DISCONNECT_TIMEOUT=25
GOODBYE_GRACE_SECONDS=2.0
GOODBYE_PHRASES="goodbye,bye,good bye,alvida,dhanyavaad,thank you goodbye,have a good day,take care"

# Custom Silence Prompt
SILENCE_PROMPT_MESSAGE="The user has been silent for a while. Gently ask if they're still there or if they need any help. Keep it brief and natural."

# 9. Database (OVH Cloud PostgreSQL)
DATABASE_HOST=postgresql-37e80a4b-o923e7dc6.database.cloud.ovh.net
DATABASE_PORT=20184
DATABASE_NAME=realestatemedium2402test
DATABASE_USER=avnadmin
DATABASE_PASSWORD=98h7wmiB46uxoFWdHXpn
DATABASE_SSL_MODE=require

# 10. Demo Page Auth
DEMO_TOKEN_SECRET=voiceai_demo_secret_change_in_production
DEMO_BASE_URL=https://ai1.strategicerpcloud.com/voiceai
DEMO_TOKEN_EXPIRY_MINUTES=30
DEMO_DASHBOARD_USERNAME=admin
DEMO_DASHBOARD_PASSWORD=strategic2026
