# RMTL → "Retell AI clone with BYOK" — Platform Plan

Status: IN PROGRESS — Phase 1 (key vault + Integrations UI) shipped. See §7/§8 for what's next.
Last updated: 2026-07-23

## 1. Goal

Turn RMTL into a self-serve voice AI agent platform (like Retell AI / Vapi / Bland AI) where
**users bring their own API keys** for every provider category (LLM, STT, TTS, Telephony) instead
of us paying for/reselling usage. We pick sane recommended defaults, but the user can swap providers.

## 2. How Retell AI actually works (reference model)

Every call is a loop: **caller audio → STT → LLM (+ tool calls) → TTS → audio back to caller.**
Wrapped around that pipeline:
- **Turn-taking / endpointing** — deciding when the caller finished a thought.
- **Barge-in** — instantly stopping TTS + flushing buffers when the caller interrupts.
- **Fallback routing** — never trust a single LLM/ASR provider/deployment; auto-switch on failure or quota.
- **Visual flow builder + function calling** — no-code conversation design, agent decides when to call tools (book, transfer, end call, webhook).

RMTL already has the right shape for the flow builder + workflow engine + OpenAI→Gemini fallback.
What's missing/weak: real turn-taking, barge-in, and a clean multi-provider abstraction.

## 3. Key architecture decision: LiveKit Agents vs. current raw Twilio Media Streams

**Recommendation: adopt LiveKit Agents (Python) as the voice runtime.**

Reasons:
- LiveKit owns transport, VAD, turn-taking, and barge-in out of the box — this is exactly the
  hard part `backend/app/routers/calls.py` currently hand-rolls badly (fixed 2s buffer, no VAD,
  no interruption handling, blocking `while True` loop).
- LiveKit has a **plugin system per provider** — this literally *is* the BYOK abstraction layer
  we need. Swapping STT/TTS/LLM provider = swapping a plugin instantiation with the user's key.
- **Confirmed: official `livekit-plugins-sarvam` plugin** — STT (Saaras v3), TTS (Bulbul v3),
  and even Sarvam's own LLM (sarvam-30b/105b, OpenAI-compatible tool calling). No more hand-written
  httpx calls like today's `voice_service.py`.
- **Confirmed: Exotel has an official LiveKit SIP trunking integration** — required for
  India-compliant PSTN (Indian telecom regulation requires a licensed VNO like Exotel for
  Indian DIDs; Twilio alone cannot legally terminate Indian PSTN numbers).
- Twilio also has a mature LiveKit SIP trunking path (Elastic SIP Trunking → LiveKit SIP URI).
- Open-source (Apache 2.0) / self-hostable, or LiveKit Cloud managed — no lock-in.

Migration impact: `calls.py`'s `/stream` websocket handler and `voice_service.py` STT/TTS glue
get replaced by a LiveKit Agent worker process. `workflow_engine.py`'s node-walking logic can
mostly be reused as the "brain" driving what the LiveKit agent says.

## 4. Provider landscape & recommended defaults (BYOK — user enters their own key for whichever they pick)

### LLM
| Provider | Notes | Default? |
|---|---|---|
| OpenAI (GPT-4o/4.1) | best tool-calling reliability + latency | **Yes, primary default** |
| Anthropic Claude | strong reasoning, good alternative | optional |
| Google Gemini | cheap, good fallback (already used as fallback in `workflow_engine.py`) | optional / fallback |
| Sarvam-M | native Indic reasoning, OpenAI-compatible tools | optional, India-first agents |

### STT
| Provider | Notes | Default? |
|---|---|---|
| Deepgram (Nova-3 / Flux) | sub-300ms, Flux has built-in end-of-turn detection | **Yes, primary default** |
| AssemblyAI | best accuracy + diarization/PII redaction | optional |
| Sarvam (Saaras) | best Indian language/accent accuracy | optional, India-first agents |
| OpenAI Whisper | batch-only, simplest fallback | fallback only |

### TTS
| Provider | Notes | Default? |
|---|---|---|
| ElevenLabs (Flash v2.5) | most natural voices, ~75-150ms, huge voice library | **Yes, primary default** |
| Cartesia (Sonic-3) | lowest latency in market (40-90ms) | optional, latency-critical |
| Sarvam (Bulbul) | best Indian language voices | optional, India-first agents |
| Deepgram Aura-2 | good if already on Deepgram STT | optional |
| OpenAI TTS | cheapest fallback | fallback only |

### Telephony
| Provider | Notes | Default? |
|---|---|---|
| Twilio | best docs, most mature LiveKit/SIP path, global | **Yes, primary default** |
| Exotel | required for India PSTN compliance, official LiveKit SIP guide | **Yes, India default** |
| Telnyx | cheapest + lowest latency (private IP backbone) | optional, power users |
| Plivo | cheap Twilio-clone migration | optional |

Important finding: Retell AI itself does **not** support BYOK for LLM/STT/TTS providers
(only a custom-LLM-over-websocket escape hatch) — real multi-provider BYOK is a genuine
differentiator for us, not something to copy, but it means we own the security responsibility
(see §5).

## 5. BYOK key vault design (needs decision — see open questions)

- API keys must be **encrypted at rest** (current `Agent` model stores `sarvam_api_key` etc.
  in plaintext columns — this needs to change).
- Keys are **never returned in plaintext** by any API response after initial save (mask e.g. `sk-...abcd`).
- Decrypt only at call/execution time, server-side, never sent to frontend.
- New `Integration` / `ApiKey` model: `provider_category` (llm/stt/tts/telephony), `provider_name`,
  `encrypted_key`, `owner` (account-level and/or agent-level — open question below).
- New service: `credentials_service.py` wrapping encryption (Fernet w/ server-side secret, or KMS
  if we later move to real cloud infra).

## 6. UI work needed

- New **"Integrations" / API Keys settings page**: category tabs (LLM / STT / TTS / Telephony),
  each provider shown as a card with a masked key input, "Test connection" button, and a
  "Recommended" badge on the default provider.
- **Provider picker** inside Agent Settings / Workflow Builder dialogue nodes: dropdown per
  category, defaulting to account-level integration, "Advanced" override per node/agent.
- Redesign polish pass across Dashboard, Agents, Workflow Builder, Analytics, Call History
  to match the more polished multi-provider, BYOK-aware flows (badges for "key missing",
  connection health indicators, etc.)
- Fix the broken `Analytics.jsx` (`GET /analytics/summary` route doesn't exist server-side yet).

## 7. Decisions (resolved 2026-07-23 — no longer open)

1. **LiveKit migration**: YES — confirmed LiveKit has official plugins for every provider we
   want to support (OpenAI/Anthropic/Gemini/Sarvam for LLM; Twilio/Exotel/Telnyx/Plivo/Vonage
   for telephony via generic SIP; Deepgram/AssemblyAI/Sarvam/Whisper for STT;
   ElevenLabs/Cartesia/Sarvam/Deepgram Aura for TTS). Free/open-source, self-hostable.
2. **Key scoping**: account-level "Integrations" page (shipped). Per-agent override can be
   layered on later — the `Integration` model/API already supports adding an optional
   `agent_id` column without breaking the account-level default lookup.
3. **Telephony providers**: support ALL of Twilio, Exotel, Telnyx, Plivo, Vonage (shipped in
   the provider catalog + Integrations UI). Twilio + Exotel flagged "Recommended".
4. **Build order**: backend foundation first (shipped: key vault, encryption, auth, Integrations
   API), then UI (shipped: Integrations settings page), next is LiveKit migration.
5. **Self-host vs. LiveKit Cloud**: start self-hosted via Docker (fits existing docker-compose
   pattern, free), revisit Cloud once call volume justifies managed ops.

## 8. Rollout phases — progress

1. ✅ **Foundation** (2026-07-23): real JWT auth (replacing the mock), encrypted key vault
   model/service, provider catalog, Integrations settings page (UI) + backend CRUD, fixed the
   OpenAI-client-crashes-app-boot bug and the passlib/bcrypt incompatibility.
2. ⬜ **Wire the vault into the call pipeline**: `workflow_engine.py` / `voice_service.py`
   currently still read `OPENAI_API_KEY` / `SARVAM_API_KEY` from global settings and per-agent
   plaintext columns — need to switch to `integration_service.get_credentials(user, category,
   provider)` so saved BYOK keys are actually used end-to-end. This is the natural next step
   before LiveKit, since it's needed either way.
3. ⬜ **Provider abstraction layer**: one interface per category so workflow engine / agent
   config doesn't hardcode "if provider == 'sarvam'" branches — first pass for OpenAI, Deepgram,
   ElevenLabs, Twilio + Sarvam/Exotel for India.
4. ⬜ **LiveKit migration**: stand up a LiveKit Agent worker, wire it to `workflow_engine.py`,
   connect Twilio + Exotel SIP trunks, retire the old `/calls/{id}/stream` websocket code in
   `routers/calls.py`.
5. ⬜ **UI polish pass**: provider pickers in Agent Settings & Workflow Builder reading from
   the user's connected integrations, connection-health indicators ("test key" button), fix the
   still-broken `/analytics/summary` endpoint.
6. ⬜ **Testing & hardening**: end-to-end call testing per provider combo, error handling/fallback
   chains, docs.
