# Agent Changelog

This file is the persistent memory of every change made to this project by the AI agent, across sessions.
Every time a change is made (even after the chat is closed and restarted), a new dated entry is added below
**before or right after** the change, describing:
- What was changed
- Which file(s) were touched
- Why it was changed

Newest entries go on top. Do not delete old entries — this is the audit trail of the project's history.

---

## 2026-07-23 — Full multi-provider LLM/STT/TTS matrix + real telephony wiring (buy-a-number, Twilio/Exotel)

**Type:** Major functional build-out across backend + all 3 agent-editing frontend surfaces

**Why:** User's Create Agent screenshots showed the Model tab only supported OpenAI/Claude/Gemini
with no per-provider key field (just a link to Integrations), the Voice tab only offered
ElevenLabs/Sarvam/Whisper, and there was no "Calling" setup anywhere despite Twilio/Exotel already
existing in the Integrations catalog — and even if configured there, outbound calls never actually
used those saved credentials or reached our own AI pipeline. Explicit instruction: prioritize making
everything *actually work* end-to-end over UI polish for now.

**Root causes found:**
- `Agent.llm_provider` only supported gpt/claude/gemini, Claude was never actually implemented (no
  Anthropic API call existed anywhere), and there was no per-agent OpenAI/Anthropic/Gemini key field
  — the dialogue LLM call was hardcoded to platform-key-OpenAI-then-Gemini regardless of what an
  agent's `llm_provider`/`llm_model` said.
- Voice only exposed 3 combined STT+TTS providers; Deepgram, AssemblyAI, Cartesia (already in the
  Integrations catalog) had zero implementation in `voice_service.py`.
- ElevenLabs `voice_name` (e.g. "Josh") was stored but **never used** — TTS always hardcoded Rachel's
  voice ID regardless of selection.
- Twilio/Exotel credentials saved on the Integrations page were never read by the actual call flow:
  `call_service.create_call` → `twilio_service.initiate_call` used only the platform `.env` Twilio
  keys and pointed calls at Twilio's own demo TwiML URL — never our own `/calls/{id}/twiml` →
  `/calls/{id}/stream` pipeline. A configured Twilio number would never actually reach our AI agent.
- No number-buying flow existed at all, and no telephony-provider selection existed per agent.

**What was built (backend):**
- `models/agent.py` + `migrate_agent_providers.py`: added `openai_api_key`, `anthropic_api_key`,
  `gemini_api_key`, `cartesia_api_key`, `assemblyai_api_key`, `deepgram_api_key`, `stt_provider`
  (independent of `voice_provider`, which is now TTS-only), `telephony_provider`. Added `user_id` to
  `Call` for resolving whose Integrations vault to use.
- `services/workflow_engine.py`: added real `_call_anthropic` (Messages API) and `_call_sarvam_llm`
  (`api.sarvam.ai/v1/chat/completions`, OpenAI-compatible) alongside existing OpenAI/Gemini. Threaded
  `agent` through `execute_workflow`/`generate_response` so the dialogue node resolves the *agent's*
  provider + own-key-then-platform-key, with Gemini as the universal fallback if the primary fails.
- `services/voice_service.py`: added Deepgram (Nova STT + Aura TTS), AssemblyAI STT (upload+poll),
  Cartesia TTS, explicit OpenAI TTS. Added `ELEVENLABS_VOICE_IDS` name→id map so `voice_name` actually
  selects the right ElevenLabs voice instead of always using Rachel's.
- `services/voice_pipeline.py`: generalized `transcribe`/`synthesize` to route across all STT/TTS
  providers with per-agent-key-then-platform-key resolution and graceful fallback to Whisper/default.
- `services/telephony_service.py` (new): real Twilio dispatch (uses our own `/calls/{id}/twiml`
  callback + new `PUBLIC_BASE_URL` setting) and Exotel Connect API dispatch (requires a one-time
  Voicebot Flow the user builds in their own Exotel dashboard — Exotel doesn't accept dynamic
  external URLs). Telnyx/Plivo/Vonage return a clear "not wired up yet" error instead of pretending.
- `services/call_service.py` + `routers/calls.py`: `POST /calls/` now resolves the *calling user's*
  own saved telephony Integration (via new `get_current_user_optional` dependency) for the agent's
  `telephony_provider`, falling back to platform Twilio env vars only.
- `routers/telephony.py` (new) + registered in `main.py`: `GET /telephony/twilio/available-numbers`
  and `POST /telephony/twilio/buy-number`, both scoped to the current user's own Twilio credentials.
- `services/provider_catalog.py`: Exotel fields expanded (`api_key`, `app_id` for the Voicebot Flow).
- `schemas/agent.py`: exposed all new fields on `AgentBase`/`AgentUpdate`.

**What was built (frontend):**
- `lib/voiceProviders.js` (new) — single source of truth for `LLM_PROVIDERS` (gpt/claude/gemini/
  sarvam), `TTS_PROVIDERS` (elevenlabs/sarvam/cartesia/deepgram_aura/openai_tts), `STT_PROVIDERS`
  (whisper/deepgram/assemblyai/sarvam), `TELEPHONY_PROVIDERS` (twilio/exotel supported; telnyx/plivo/
  vonage marked coming-soon) — used by all 3 editing surfaces so they can't drift again.
- `components/AgentForm.jsx`, `pages/AgentSettings.jsx`, `components/AgentSettingsPanel.jsx`: Model
  tab now shows an API-key field for whichever LLM provider is selected (incl. Sarvam); Voice tab
  split into independent "Voice (TTS)" and "Transcription (STT)" pickers, each with their own
  API-key field + `ConnectionStatus`; new "Calling" tab/section for picking `telephony_provider`
  with a link to Integrations for credentials/number management.
- `pages/Integrations.jsx`: added inline "Search & buy a number" flow on the Twilio card (country +
  area code search via the new `/telephony/twilio/available-numbers`, buy via `buy-number`, which
  saves the purchased number back onto the Twilio Integration automatically).

**Known follow-ups (flagged, not yet done):**
- Per-agent BYOK keys are the primary mechanism (matches how ElevenLabs/Sarvam already worked); the
  account-level Integrations vault is *not yet* auto-consulted as a fallback for LLM/STT/TTS keys
  (only for telephony, since that needed user-scoping anyway) — would need `Agent.user_id` + auth on
  the Agents/Workflows routers to resolve safely, which is a bigger scoping change.
- Telnyx/Plivo/Vonage outbound calling still unimplemented (clear error shown, not silently broken).
- UI visual polish intentionally deferred — user will provide Retell AI reference screenshots.

---

## 2026-07-23 — Unified, comprehensive language support + wired it into the actual call pipeline

**Type:** Backend architecture fix (real functional bug) + frontend consistency fix across 3 components

**Why:** User pointed out the Language dropdown on Create Agent only had ~12 generic options
(no Indian regional languages beyond Hindi), while a *separate* "Sarvam Language" field only
appeared when Sarvam was picked as the voice provider — confusing and incomplete. More importantly,
they asked for the selection to **actually work**, not just be cosmetic.

**Root cause found (bigger than just the dropdown list):**
- `agent.language` (the general field) was stored on save but **never read anywhere** in the
  actual voice/call pipeline — it had zero effect on what language the agent spoke.
- `agent.sarvam_language` *was* wired, but only inside `routers/testing.py` (the Workflow
  Builder's test panel), and only when `voice_provider == 'sarvam'`. ElevenLabs/Whisper-based
  agents had no language wiring at all.
- The **real live call path** (`routers/calls.py` → `/calls/{id}/stream` websocket, used by the
  "Start Call" button) was even further behind: it always used the *platform* Sarvam key
  (ignoring any key saved on the agent), always defaulted to Hindi, and didn't call the LLM at
  all — it just echoed back `"You said: {transcript}"`.
- A third, separate component (`components/AgentSettingsPanel.jsx`, used inside the Workflow
  Builder) had its own third copy of hardcoded language lists, already drifting out of sync with
  the other two.

**What was built:**
1. **`backend/app/services/language_catalog.py` (new)** — single source of truth for every
   language an agent can speak, grouped as `India` (all 11 Sarvam-supported Indian languages:
   Hindi, English-India, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Odia,
   Punjabi) and `Global` (18 major world languages/locales). Exposes `language_name(code)` and
   `sarvam_code_for(code)` (falls back to Hindi for non-Indian languages, since Sarvam only
   covers India).
2. **`GET /agents/languages`** (new endpoint in `routers/agents.py`, declared before
   `/{agent_id}` so it isn't swallowed by that route) — serves the catalog above. Frontend now
   fetches this instead of hardcoding its own list (same pattern already used for the
   Integrations provider catalog).
3. **`backend/app/services/voice_pipeline.py` (new)** — shared `transcribe()` / `synthesize()` /
   `generate_reply()` helpers that resolve an Agent's provider, own API key (falling back to the
   platform key), and language *once*, consistently, for whichever code path needs a voice turn.
4. **`workflow_engine.py`**: added `generate_response()` — a thin wrapper around the existing
   dialogue-node logic that works from a raw prompt instead of a full workflow graph, so the live
   call path (which has an Agent + prompt but no saved Workflow) can reuse the same OpenAI→Gemini
   fallback + "respond only in X language" instruction logic.
5. **`routers/testing.py`**: now computes `target_language` from `agent.language` for **every**
   voice provider (not just Sarvam), and delegates STT/TTS to `voice_pipeline`.
6. **`routers/calls.py` — the real call pipeline, rewritten**: the websocket handler now looks up
   the call's actual `Agent`, and for every turn: transcribes via `voice_pipeline.transcribe`
   (agent's own key/provider/language), generates a real LLM reply via
   `voice_pipeline.generate_reply` (agent's prompt, instructed to answer in the agent's
   language, with short in-call conversation history) instead of echoing the transcript, and
   synthesizes via `voice_pipeline.synthesize`. Replaced stray `print()`s with `logger.*`.
7. **Frontend — `AgentForm.jsx`, `pages/AgentSettings.jsx`, `components/AgentSettingsPanel.jsx`**:
   all three now fetch `/agents/languages` and render one grouped (`<optgroup>` India / Global)
   Language dropdown in the General section. Removed the separate, redundant "Sarvam Language"
   selector from all three — Sarvam now just speaks whichever language was picked in General
   (falls back to the default TTS/STT automatically if that language isn't one Sarvam supports).
8. Bumped the default `language` value from the old bare `'en'` to `'en-US'` (schema default +
   all 3 frontend forms) to match the new region-qualified codes; `language_name()` has a safe
   fallback for any pre-existing agent rows still holding the old bare `'en'`.

**Verified:** booted the backend, hit `GET /agents/languages` (11 India + 18 Global), created a
throwaway agent with `language: 'ta-IN'` + `voice_provider: 'sarvam'` and confirmed
`resolve_agent_language()` returns `('Tamil', 'ta-IN')`; confirmed a non-Indian language (French)
correctly falls back to `hi-IN` for Sarvam's STT/TTS while still returning `'French'` as the LLM
instruction language. Deleted the test agent afterward. Full frontend production build passes.

**Known gap flagged, not fixed in this pass:** `AgentSettingsPanel.jsx` also has `openai_api_key` /
`gemini_api_key` fields in its UI that aren't declared anywhere in `schemas/agent.py` — same shape
of bug as the original missing-Sarvam-key issue, currently silently dropped on save. Left alone
since it's outside today's language-specific ask; worth a dedicated fix later.

---

## 2026-07-23 — Agent builder redesign: tabbed layout + fixed missing Sarvam key field

**Type:** Frontend UI/UX redesign + a real backend bug fix

**Why:** User reported the "Create Agent" form required scrolling through one long stacked list
of fields, and that selecting Sarvam AI as the voice provider gave no way to enter a Sarvam API
key at all (unlike ElevenLabs, which already had an optional inline key field).

**Root cause found for the Sarvam bug:** `models/agent.py` already had `sarvam_api_key` and
`sarvam_language` columns (and the SQLite dev DB already had them) — but `schemas/agent.py`
(`AgentBase`/`AgentUpdate`) never declared those fields, so FastAPI/Pydantic silently dropped them
from every request body before they ever reached the frontend form or the database. The frontend
form then had no reason to render a field for them either.

**What was built:**
1. **Backend fix** (`schemas/agent.py`): added `sarvam_api_key` / `sarvam_language` to both
   `AgentBase` and `AgentUpdate`. No DB migration needed — the columns already existed. Verified
   end-to-end with a real POST (created + immediately deleted a throwaway test agent row).
2. **`components/AgentForm.jsx` — full redesign**: replaced the single long scrolling column with
   a Retell-style left tab rail (General / Model / Voice / Advanced) + one section visible at a
   time, so the whole form fits without scrolling. A persistent "Create Agent" footer stays visible
   regardless of which tab is active; submitting with an empty name jumps back to the General tab
   and shows an inline error instead of failing silently.
   - Voice tab now shows a Sarvam API key field (+ a Sarvam language picker) when Sarvam is
     selected, mirroring the existing ElevenLabs pattern.
   - Added a new **`components/ui/ConnectionStatus.jsx`**: a small live indicator, next to the
     Model and Voice provider pickers, that checks the already-built Integrations vault
     (`GET /integrations/`) and shows "✓ key saved in Integrations" or a link to go add one. This
     is informational only — it reflects what's saved in the vault, not whether the call pipeline
     already consumes it (that wiring is still on the roadmap, see below).
3. **`pages/AgentSettings.jsx` — full redesign + bug fixes**: this page had drifted out of sync
   with the create form (offered "Deepgram"/"Google TTS" as voice providers that don't exist
   anywhere else in the app, had no LLM provider selector — just a flat mixed GPT/Claude model
   list, no Sarvam fields at all, and its save handler never sent `llm_provider` to the backend at
   all). Rebuilt with the exact same tabbed layout/fields as `AgentForm.jsx` for consistency, fixed
   the save payload, and made the optional API key fields only overwrite the stored key when the
   user actually types a new one (blank = keep existing).
4. **`pages/Agents.jsx`**: added a settings (gear) button on each agent card linking to
   `/agents/:id/settings` — that route existed already but nothing in the UI linked to it.

**Files touched:**
- `backend/app/schemas/agent.py`
- `frontend/src/components/AgentForm.jsx`, `frontend/src/components/ui/ConnectionStatus.jsx` (new)
- `frontend/src/pages/AgentSettings.jsx`, `frontend/src/pages/Agents.jsx`

**Testing performed:** full `npm run build` (catches import/JSX errors Vite dev mode can hide),
verified every new `lucide-react` icon name actually exists in the installed version before using
it (a real bug from the previous session — see the `PhonePlus` incident), started the backend
against the real dev DB and round-tripped `sarvam_api_key`/`sarvam_language` through a live POST,
then deleted the test row so it doesn't show up in the user's agent list.

**Deferred (by explicit user request/offer, not done in this pass):**
- User offered to share Retell AI reference screenshots for a closer visual match — a follow-up
  pass should incorporate those once provided.
- Login/Register pages and the Workflow builder were left untouched this round; only the
  Agents/Agent Settings pages were in scope here.
- Per-agent inline API key override fields still only exist for ElevenLabs and Sarvam (the two
  providers that already have dedicated columns on the `Agent` model) — OpenAI/Claude/Gemini/
  Whisper rely purely on the Integrations vault for now. Adding per-agent override columns for
  every provider would need a small schema migration; flagged here in case that's wanted later.

---

## 2026-07-23 — UI overhaul: real charts, shared component kit, theme-safe polish

**Type:** Frontend UI/UX improvement (no backend changes except removing a dependency on the
still-missing `/analytics/summary` endpoint)

**Why:** User reviewed the running app and asked for the UI to be made noticeably better than
the previous pass (generic Tailwind defaults, placeholder charts, inconsistent badge colors).

**What was built:**
1. **Shared UI kit** (`components/ui/`, new): `StatCard`, `Badge` (5 semantic variants, all
   opacity-derived from the accent color so they're theme-safe in both light/dark without a
   separate `dark:` class per variant), `EmptyState`, `PageHeader`, `PageTransition`
   (framer-motion fade/slide-in, finally putting the already-installed `framer-motion` dependency
   to use).
2. **`lib/utils.js`** (new): extracted the `cn()` helper out of `components/Layout.jsx` into its
   own module (Layout still re-exports it for backward compatibility with existing imports).
   `Layout.jsx` now wraps routed page content in `PageTransition` keyed by `location.pathname`,
   so every navigation gets a subtle animated entrance.
3. **Dashboard** (`pages/Dashboard.jsx`): replaced the "Chart Placeholder" box with a real
   `recharts` `AreaChart` of the last 7 days of call volume (computed client-side from `/calls/`,
   falls back to an `EmptyState` when there's no data yet). Quick Actions rebuilt as proper
   icon-badge list items instead of plain text links.
4. **Analytics** (`pages/Analytics.jsx`): the page called `GET /analytics/summary`, which never
   existed on the backend (a pre-existing gap noted in the very first review) — replaced with
   client-side aggregation from the already-working `/calls/` and `/agents/` endpoints (total
   calls, total minutes, avg duration, success rate, per-agent call counts, recent activity).
   Added a real 14-day `AreaChart` and wired "Top Performing Agents" / "Recent Activity" to
   actual data instead of static "No data available yet" text.
5. **Agent creation form** (`components/AgentForm.jsx`): regrouped the flat 10-field list into
   labeled sections (Identity / Language Model / Voice / Advanced) with icons and dividers for
   visual hierarchy — no functional/field changes.
6. **Call History** (`pages/CallHistory.jsx`): added a phone-number search box and a status
   filter pill group; status column now uses the shared `Badge` component instead of a raw icon.
7. **Workflows** (`pages/Workflows.jsx`): the "Active/Draft" badge used
   `bg-green-100 text-green-700` with no `dark:` variant (unreadable in dark mode) — replaced
   with the theme-safe `Badge` component; empty state and header also switched to the shared kit.
8. **Agents list + Call Simulator** (`pages/Agents.jsx`, `components/CallSimulator.jsx`): agent
   cards now show LLM/voice provider badges; call simulator's green accent colors made
   dark-mode-safe (`bg-green-500/10` + `dark:text-green-400` instead of fixed `bg-green-100`).
9. **Integrations page**: swapped its hand-rolled recommended/connected pills and page header for
   the new shared `Badge`/`PageHeader` components for consistency across the whole app.
10. Added `recharts` to `frontend/package.json` (installed and verified it resolves correctly
    through Vite's dependency optimizer on the running dev server).

**Files touched (frontend):**
- `lib/utils.js` (new), `components/ui/StatCard.jsx` (new), `components/ui/Badge.jsx` (new),
  `components/ui/EmptyState.jsx` (new), `components/ui/PageHeader.jsx` (new),
  `components/ui/PageTransition.jsx` (new)
- `components/Layout.jsx`, `pages/Dashboard.jsx`, `pages/Analytics.jsx`,
  `components/AgentForm.jsx`, `pages/CallHistory.jsx`, `pages/Workflows.jsx`, `pages/Agents.jsx`,
  `components/CallSimulator.jsx`, `pages/Integrations.jsx`
- `package.json` (added `recharts`)

**Testing performed:** ran both servers locally (backend on :8000, frontend on :5173), confirmed
no lint errors across all edited files, confirmed Vite resolves the new `recharts` import through
its dependency optimizer without errors, confirmed `/agents/` and `/` respond 200.

**Not done yet:**
- A real backend `/analytics/summary` endpoint (worked around client-side for now, but a
  server-side implementation would be more efficient once call volume grows).
- Everything still listed as pending in the previous entry (LiveKit migration, provider pickers,
  wiring the key vault into the actual call pipeline).

---

## 2026-07-23 — Ran backend + frontend locally for a live preview

**Type:** Dev environment / no source code changes

**What was done:**
- Discovered this machine has **no Node.js/npm and no Docker installed system-wide**. Downloaded a
  portable Node v20 into `/tmp/nodejs-local` (not persisted anywhere in the repo) just to install
  frontend deps and run Vite for this session.
- Since no Postgres/Docker is running, created `backend/.env` (gitignored, not committed) pointing
  `DATABASE_URL` at a local SQLite file (`sqlite:///./app.db`) instead of the Postgres the
  `docker-compose.yml` expects, purely for this local preview.
- Started backend: `uvicorn app.main:app --port 8000` (from `backend/.venv`).
- Started frontend: `npm run dev` (Vite) on port 5173.
- Verified both serve pages (`/docs` on backend, `/login` on frontend) with 200 OK.

**Files touched:** none in the repo itself. `backend/.env` was created locally but is gitignored.

**Note for future sessions:** if the backend/frontend aren't running when you pick this up again,
Node.js still won't be installed system-wide on this machine unless the user installs it — check
before assuming `npm` works.

---

## 2026-07-23 — Phase 1 shipped: real auth + encrypted BYOK key vault + Integrations UI

**Type:** Feature — backend foundation + first UI screen (tested end-to-end locally)

**Decisions locked in this session (final, no longer open questions):**
- Voice runtime: migrate to **LiveKit Agents** (confirmed it has official plugins for every
  requested provider: OpenAI/Anthropic/Gemini/Sarvam for LLM, Twilio/Exotel/Telnyx/Plivo/Vonage
  for telephony via generic SIP trunking, Deepgram/AssemblyAI/Sarvam/Whisper for STT,
  ElevenLabs/Cartesia/Sarvam/Deepgram Aura for TTS). Free/open-source (Apache 2.0) to self-host.
- Support **all** requested providers per category — not just the recommended defaults.
- Key scoping: **account-level** "Integrations" page (one key per provider per user, reused by
  all of that user's agents). Per-agent overrides can be layered on later without a redesign.
- Backend-first build order: key vault → Integrations UI → LiveKit migration → provider pickers.

**What was built:**
1. **Real authentication** (previously `routers/auth.py` was an in-memory mock with plaintext
   passwords and fake tokens):
   - `models/user.py` — real `User` table.
   - `services/security_service.py` — bcrypt password hashing + JWT issue/verify.
   - `dependencies.py` — `get_current_user` FastAPI dependency (Bearer token).
   - `routers/auth.py` — rewritten to hit the DB and issue real JWTs; kept the exact same
     request/response shape the frontend already expected, so no frontend auth-flow changes
     were needed beyond attaching the token to requests.
2. **Encrypted BYOK credential vault**:
   - `models/integration.py` — `Integration` table (`user_id`, `category`, `provider`,
     `encrypted_credentials`, unique per user+category+provider).
   - `services/crypto_service.py` — Fernet symmetric encryption; auto-generates and persists
     a local `.encryption_key` (gitignored) if `ENCRYPTION_KEY` isn't set via env, so dev works
     out of the box while production is expected to set the env var explicitly.
   - `services/integration_service.py` — upsert/list/delete + credential masking (e.g. `****cdef`)
     for anything returned over the API — raw keys are only ever decrypted server-side.
   - `services/provider_catalog.py` — single source of truth for every supported provider per
     category (llm/stt/tts/telephony), which fields each needs, docs links, and which one is
     flagged "Recommended". Both backend validation and the frontend UI read from this list.
   - `routers/integrations.py` — `GET /integrations/catalog`, `GET/POST /integrations/`,
     `DELETE /integrations/{id}`, all behind `get_current_user`.
3. **Bug fix (blocking issue found during testing):** `WorkflowEngine` and `VoiceService` used
   to construct an `OpenAI` client eagerly in `__init__`, which crashes on import if no *global*
   `OPENAI_API_KEY` env var is set. Under BYOK there's no reason the app itself should need a
   global OpenAI key. Made both clients lazy (constructed on first real use, inside existing
   try/except call sites) — app now boots fine with zero keys configured.
4. **Bug fix:** pinned `bcrypt==4.0.1` in `requirements.txt` — `passlib[bcrypt]` pulls the latest
   `bcrypt` by default, but `bcrypt>=4.1` removed the `__about__` attribute that `passlib` 1.7.4's
   backend-detection code depends on, crashing every password hash/verify call with a cryptic
   "password cannot be longer than 72 bytes" error that has nothing to do with the real cause.
5. **Frontend — Integrations settings page** (`pages/Integrations.jsx`, new):
   - Tabs for LLM / STT / TTS / Telephony, provider cards per category sourced live from
     `GET /integrations/catalog`, "Recommended" and "Connected" badges, masked credential preview,
     a modal form (fields driven by the catalog, so adding a new provider later needs zero
     frontend changes) to connect/update a key, and remove with confirmation.
   - Wired into `App.jsx` (route `/integrations`) and `components/Layout.jsx` (nav item).
6. **Frontend — fixed a real (silent) bug:** `api/client.js` stored the JWT in `localStorage` on
   login but never actually attached it to outgoing requests. Added a request interceptor to send
   `Authorization: Bearer <token>` on every call, and a response interceptor to log the user out
   and redirect to `/login` on any 401.

**Files touched (backend):**
- `models/user.py` (new), `models/integration.py` (new), `models/__init__.py`
- `services/security_service.py` (new), `services/crypto_service.py` (new),
  `services/integration_service.py` (new), `services/provider_catalog.py` (new)
- `services/workflow_engine.py` (lazy OpenAI client), `services/voice_service.py` (lazy OpenAI client)
- `dependencies.py` (new)
- `schemas/user.py` (new), `schemas/integration.py` (new)
- `routers/auth.py` (rewritten), `routers/integrations.py` (new)
- `main.py` (registered integrations router)
- `config.py` (added `ENCRYPTION_KEY` setting)
- `requirements.txt` (added `cryptography`, pinned `bcrypt==4.0.1`)

**Files touched (frontend):**
- `pages/Integrations.jsx` (new)
- `api/client.js` (auth header + 401 handling — was previously broken/no-op)
- `App.jsx`, `components/Layout.jsx` (route + nav)

**Testing performed:** ran the backend locally (sqlite override), confirmed via curl: register →
real JWT issued, `/auth/me` round-trip, save an OpenAI (llm) and a Twilio (telephony) integration,
listed them back masked, confirmed the raw DB column is Fernet ciphertext (not plaintext),
confirmed unauthenticated requests get 401, confirmed invalid category/provider gets 400.
Frontend could not be build-tested in this sandbox (no Node.js available) — verified via lint
only; user should run `npm run dev` to visually confirm the new Integrations page.

**Not done yet (see `docs/PLATFORM_PLAN.md` for the full roadmap):**
- LiveKit Agents migration (still on raw Twilio Media Streams in `routers/calls.py`).
- Provider pickers inside Agent Settings / Workflow Builder (agents still only know about
  ElevenLabs/Sarvam hardcoded fields on the `Agent` model — not yet reading from `Integration`).
- Actually *using* the saved integrations anywhere in the call pipeline — right now the vault
  stores keys but nothing consumes them yet. That's the next milestone.
- `/analytics/summary` endpoint still missing (pre-existing gap, noted in the first review).

---

## 2026-07-23 — Platform plan: Retell-AI-style BYOK voice agent platform

**Type:** Planning / research only (no app code changes)

**What was done:**
- Researched Retell AI's actual architecture (STT→LLM→TTS pipeline, turn-taking, barge-in, fallback routing).
- Researched current (2026) provider landscape for LLM, STT, TTS, and Telephony, plus LiveKit Agents vs. raw Twilio Media Streams.
- Confirmed LiveKit has an official Sarvam AI plugin (STT/TTS/LLM) and Exotel has an official LiveKit SIP trunking integration for India PSTN compliance.
- Wrote up findings + recommended architecture + open decisions into `docs/PLATFORM_PLAN.md`.

**Files touched:**
- `RMTL/docs/PLATFORM_PLAN.md` (created) — full plan, provider comparison tables, recommended defaults, open questions.

**Recommendation summary:**
- Migrate voice runtime from hand-rolled Twilio WebSocket code (`routers/calls.py`, `services/voice_service.py`) to **LiveKit Agents**.
- Recommended default providers: **OpenAI** (LLM), **Deepgram** (STT), **ElevenLabs** (TTS), **Twilio + Exotel** (Telephony, Exotel required for India PSTN compliance). Sarvam recommended as the India-language alternative for STT/TTS/LLM.
- Build a proper encrypted BYOK key vault (current `Agent` model stores keys like `sarvam_api_key` in plaintext — needs to change).
- Still waiting on user confirmation of: LiveKit migration go-ahead, key scoping (account-level vs per-agent vs both), which telephony providers to support, and where to start (backend vs UI first).

**Next step:** awaiting user's decisions on open questions in `docs/PLATFORM_PLAN.md` §7 before writing implementation code.

---

## 2026-07-23 — Initial review / no code changes

**Type:** Review only (no files modified)

**What was done:**
- Reviewed the full `RMTL` codebase (backend FastAPI app + frontend React/Vite app + infrastructure) to assess current progress.
- Created this `AGENT_CHANGELOG.md` file to track all future changes persistently.

**Files touched:**
- `RMTL/AGENT_CHANGELOG.md` (created)

**Findings summary:** See progress report shared with user in chat on this date. Key gaps identified:
- `TranscriptionService`, `SummarizationService`, `DiarizationService` are stub placeholders returning hardcoded strings.
- Frontend `Analytics.jsx` calls `GET /analytics/summary`, but no `/analytics` router exists in `backend/app/main.py` (only `analysis.py` exists, which is a different, also-stubbed endpoint at `/{call_id}`).
- `routers/analysis.py` returns an empty `{}` analysis object — not implemented.
- Local dev DB is SQLite (`app.db`, `test.db`) while `docker-compose.yml` provisions Postgres — the app isn't actually using the dockerized Postgres by default (`DATABASE_URL` default is a Postgres URL, but empty/committed `.db` files suggest SQLite was used at some point; needs verification of actual `.env`).
- Debug `print()` statements left in `workflow_engine.py` (condition matching, LLM responses) — fine for dev, should be replaced with `logger.debug` before any production use.
- Post-call webhook payload in `calls.py` sends a hardcoded placeholder summary/transcript instead of real data.

---
