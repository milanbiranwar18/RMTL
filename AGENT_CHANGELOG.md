# Agent Changelog

This file is the persistent memory of every change made to this project by the AI agent, across sessions.
Every time a change is made (even after the chat is closed and restarted), a new dated entry is added below
**before or right after** the change, describing:
- What was changed
- Which file(s) were touched
- Why it was changed

Newest entries go on top. Do not delete old entries — this is the audit trail of the project's history.

---

## 2026-07-25 — Workflow Builder visual cleanup

Reworked the workflow-building screen after comparing it side-by-side with the cleaner Retell
reference:
- Replaced the 72px icon strip and hidden “More” list with a readable 176px searchable node
  library showing every node type.
- Compacted the header, removed confusing duplicate “New Workflow” wording from the empty agent
  selector, and made action labels collapse at narrower browser widths to prevent overlap.
- Reduced the settings dock from 380px to 320px and restyled its tabs for a calmer hierarchy.
- Standardized workflow cards with subtler borders/shadows and switched simple nodes and BEGIN
  to horizontal left-to-right connectors.
- Styled React Flow controls, selected nodes, edges, dot grid, and minimap to properly match dark
  mode; added initial fit-to-view behavior.

Files: `frontend/src/pages/WorkflowBuilder.jsx`,
`frontend/src/components/SettingsDock.jsx`,
`frontend/src/components/nodes/BeginNode.jsx`,
`frontend/src/components/nodes/DialogueNode.jsx`,
`frontend/src/components/nodes/SimpleNode.jsx`,
`frontend/src/components/nodes/LogicSplitNode.jsx`, and `frontend/src/index.css`.

Verification: `npm run build` passes. Vite still reports the existing bundle-size advisory only.

---

## 2026-07-24 — Postgres/Neon readiness (prep only — still blocked on a real connection string)

Hardened `backend/app/database.py` so switching `DATABASE_URL` from SQLite to a real Neon
Postgres connection string is the *only* change needed — no other code changes anywhere in the
app: `psycopg2-binary` is already in `requirements.txt` (confirmed importable), and
`Base.metadata.create_all()` builds the full schema on first startup against whichever database
`DATABASE_URL` points to.
- Added `pool_pre_ping=True` to the engine: serverless Postgres (Neon included) can silently
  close idle connections; without this, the *next* query on a stale connection fails outright
  instead of SQLAlchemy transparently reconnecting first. No-op for SQLite.
- Made `check_same_thread=False` conditional on the URL actually being SQLite (it's meaningless,
  and slightly wrong-looking, for any other database).
- Verified the backend still boots and serves requests correctly against SQLite after this
  change (no regression).

**Still can't actually flip the switch**: this needs a real Neon connection string, which
requires creating a Neon account/project — not something that can be fabricated. Once a
connection string like `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require` is
provided, switching is just: set `DATABASE_URL` to it in `backend/.env`, restart the backend
(it'll create all tables automatically), done.

---

## 2026-07-24 — Flow Assistant: "Conductor"-style chat that edits the workflow graph for you

Adds a chat panel to the Workflow Builder (toggle via the new "Assistant" toolbar button) where
describing an edit in plain English ("add a node that transfers to +1 555 123 4567 if the caller
asks for a refund") gets it actually applied to the canvas — new node, wired up, positioned — no
manual dragging required.

**Design: propose small operations, never regenerate the whole graph.** Asking an LLM to emit an
entire graph back (to add one node) on every request is wasteful and risks it silently dropping
or mutating something it wasn't asked to touch, especially as a flow grows. Instead the backend
returns a short list of structured operations — `add_node` / `update_node` / `delete_node` /
`add_edge` / `delete_edge` — and the frontend applies just those to the live ReactFlow state.
- `backend/app/services/flow_assistant_service.py`: `NODE_SCHEMA_REFERENCE` documents every node
  type's exact `data` shape (kept in sync with `NodePropertiesPanel.jsx`/`workflow_engine.py`) and
  the edge `sourceHandle` conventions (`condition-N` for Dialogue, `branch-N`/`default` for Logic
  Split), embedded in the system prompt alongside the current graph as JSON. Reuses
  `workflow_engine._try_llm_provider` (BYOK — the selected agent's own key, falling back the same
  way every other LLM-assisted node already does) rather than a separate key path.
- `POST /assistant/edit` (`routers/flow_assistant.py`): stateless — takes the canvas's current
  nodes/edges (not necessarily saved yet) + the message + short conversation history, returns
  `{reply, operations}`. The canvas in the browser is always the source of truth; nothing is
  persisted server-side by this endpoint.
- Frontend (`components/FlowAssistantPanel.jsx`, styled like the existing Testing panel, docked
  opposite it): sends the current `nodes`/`edges` on every message, applies returned operations
  via `WorkflowBuilder.jsx`'s new `applyAssistantOperations`. The LLM invents its own short ids
  for new nodes/edges ("transfer-1") — remapped to real unique ids so they can never collide with
  anything already on the canvas, while still resolving same-batch edges that reference a
  just-added node. Refuses to delete the BEGIN node even if asked. Reports back how many changes
  were actually applied (validated against the current graph, not just "how many did the LLM
  propose") alongside the LLM's own one-line explanation.

**Verified with a mocked LLM** (no LLM key configured in this dev sandbox): patched
`WorkflowEngine._try_llm_provider` to return a scripted `add_node`(Call Transfer)+`add_edge`
response and confirmed `edit_workflow()` parses and returns it correctly end-to-end. Also hit the
live endpoint over real HTTP with no key configured and confirmed it degrades gracefully (clear
message, empty operations, no 500) rather than erroring — same convention as every other
LLM-assisted node in this codebase.

---

## 2026-07-24 — Testing panel upgrade: Test LLM / Test Audio / AI Simulate tabs + mock responses

Three related upgrades to the Workflow Builder's Testing panel, all from the same roadmap item:

**1. Renamed the two existing modes to match Retell's naming** — "Text Chat" -> **Test LLM**,
"Voice Call" -> **Test Audio**. No behavior change, just clearer naming (these already did
exactly what those names imply: fast text-only testing vs. the full STT/TTS round trip).

**2. New "AI Simulate" mode** — describe a caller persona ("An impatient customer who wants a
refund"), pick a max number of turns, hit Run: an LLM plays the caller and the real workflow
engine plays the agent, back and forth automatically, until the flow reaches an Ending/Call
Transfer or the turn limit. Lets someone verify a whole flow end-to-end from one click instead
of hand-typing every turn.
- New `POST /test/simulate` endpoint (`routers/testing.py`) runs the whole loop server-side in
  one request/response (bounded by `max_turns`, hard-capped at 20 — this is a test tool, not a
  real call) and returns the full transcript.
- `_generate_simulated_caller_reply()` reuses the exact same plain chat-completions path every
  other LLM-assisted node already uses (`workflow_engine._try_llm_provider`) with the roles
  flipped — from the persona-LLM's point of view, the agent's lines are "user" turns it's
  replying to. Told to reply with exactly `[END]` once the conversation feels naturally resolved,
  which stops the loop early rather than always running to `max_turns`.
- **Verified with a mocked LLM** (no LLM key is configured in this dev sandbox): patched
  `WorkflowEngine._try_llm_provider` with scripted replies and confirmed a full multi-turn
  simulated call — greeting -> simulated customer orders a pizza -> agent confirms -> simulated
  customer declines anything else — runs correctly through a real (self-looping) workflow graph,
  with roles correctly flipped each turn.

**3. Mock responses for Custom Function / MCP Tool Call nodes** — each of those two node types
now has a "Use a mock response when testing" checkbox + a JSON textarea (Node Settings), and the
Testing panel has its own "Use mock responses" toggle (default **on**). When both are on, testing
that node returns the configured canned variables instead of making the real HTTP/MCP call —
avoids firing a real SMS/Slack message or hitting a real API's rate limit every single time
someone tests a flow that happens to include one of those nodes. A node with no mock configured
is unaffected either way (always makes the real call — nothing to mock).
- `execute_workflow(..., use_mocks: bool)` threads through `_execute_node` to both
  `_execute_custom_function_node`/`_execute_mcp_tool_call_node`; new `_parse_mock_response()`
  parses the mock JSON into the exact same `{variable: value}` shape a real call would produce
  (plus the usual `<name>_success`), so downstream Logic Split/templating nodes behave
  identically whether the call was real or mocked.
- `/test/workflow` and `/test/voice` both default `use_mocks=True` (safe default for a testing
  UI); live calls (`routers/calls.py`) never pass it, so they always make the real call — mocking
  is a testing-only concept.
- **Verified live over real HTTP**: seeded a Custom Function node pointed at a deliberately
  broken/unreachable URL with a mock configured — `use_mocks: true` returned the mocked value
  instantly without touching the network; `use_mocks: false` on the same node made the real
  (failing) request and degraded gracefully via the existing `<name>_error` convention. Then
  cleaned up the smoke-test rows.

**Files touched:** `backend/app/routers/testing.py` (`SimulateRequest`/`SimulateResponse`,
`_generate_simulated_caller_reply`, `/test/simulate`, `use_mocks` on the existing two endpoints),
`backend/app/services/workflow_engine.py` (`_parse_mock_response`, `use_mocks` threaded through
`execute_workflow`/`_execute_node`/both node executors),
`frontend/src/components/TestingPanel.jsx` (three-tab mode selector, AI Simulate UI, mock toggle),
`frontend/src/components/NodePropertiesPanel.jsx` (`MockResponseFields`, shared by both node
types).

---

## 2026-07-24 — MCP Tool Call node: connect a real MCP server, call its tools mid-conversation

Adds MCP (Model Context Protocol, https://modelcontextprotocol.io) support — connect to any MCP
server and let the agent call its tools mid-conversation. Sibling node to Custom Function, but
speaks the actual MCP wire protocol (JSON-RPC handshake + `tools/list`/`tools/call`) instead of a
plain REST call, and offers a "Load Tools" picker instead of hand-typing a URL/method/body.

**A real constraint changed the implementation approach, worth recording:** the official `mcp`
PyPI SDK is async-only and requires Python ≥3.10 — this backend's venv is pinned to 3.9, and
tried `pip install mcp` first to confirm before building anything (`ERROR: No matching
distribution found`). Rather than bumping the whole backend's Python version (real risk to
everything already running) or bridging async-only SDK calls into this fully-synchronous
codebase via a thread-per-call event loop (real complexity for something the wire protocol
itself doesn't actually require), wrote a small dependency-free MCP client
(`services/mcp_service.py`) that speaks the Streamable HTTP transport directly as plain
synchronous JSON-RPC over `httpx` — matching how every other outbound call in this codebase
already works (Anthropic/Gemini/Sarvam LLM calls, the Custom Function node, all telephony
providers in `telephony_service.py`). Implements exactly what's needed: `initialize` ->
`notifications/initialized` handshake, `tools/list`, `tools/call`, handling both a plain JSON
response and an SSE event-stream response (the spec allows either).

**Node design (`mcp_tool_call`, silent/auto-advancing like Extract Variable/Code/Custom
Function):**
- Config: MCP server URL, optional auth header, a tool picked from a live "Load Tools" call
  against that server (new `POST /mcp/list-tools` endpoint — the picker shows real tool
  names/descriptions/schemas, not something typed blind), and an output variable name.
- Decides the tool's *arguments* the same way Extract Variable decides its fields: asks the
  agent's own LLM for a JSON object matching the tool's real input schema, via the plain
  chat-completions path every provider already supports (`_try_llm_provider`) — rather than each
  provider's own native (and mutually incompatible) function-calling API. Deliberate trade-off:
  works identically across all 4 LLM providers instead of being OpenAI/Anthropic-only.
- Same success/failure convention as Custom Function: auto-sets `<name>_success` (+
  `<name>_error` on failure) with zero extra config, so a Logic Split can branch on it.

**Verified for real, in two layers** (no LLM API key is configured in this dev sandbox, so
couldn't test 100% live end-to-end in one shot — verified the two halves separately instead of
skipping verification):
1. Wrote a throwaway MCP test server (JSON-RPC handshake + one `add_numbers` tool, deleted after)
   and confirmed `/mcp/list-tools` performs a real `initialize`/`tools/list` round trip against
   it and returns the tool's real schema.
2. Mocked only the LLM call (`_try_llm_provider` -> `'{"a": 7, "b": 5}'`, simulating what a real
   key would return for "please add 7 and 5") and ran the actual node method end-to-end — it
   really called the test MCP server's `add_numbers` tool over JSON-RPC and got back
   `sum_result = "The sum is 12.0"`, proving the full pipeline (schema-aware prompt, JSON
   parsing, real MCP call, variable storage) is correct.

**Files touched:** `backend/app/services/mcp_service.py` (new), `backend/app/routers/mcp.py`
(new), `backend/app/main.py` (router registration), `backend/app/services/workflow_engine.py`
(`_execute_mcp_tool_call_node`, dispatch case), `frontend/src/components/nodes/ExtraNodes.jsx`
(`McpToolCallNode`), `frontend/src/components/NodePropertiesPanel.jsx` (server URL + Load Tools
picker + output variable form), `frontend/src/pages/WorkflowBuilder.jsx`.

**Known limitations:** no persisted MCP session across calls (fresh handshake every tool call —
fine for occasional mid-conversation tool use, not built for high-frequency calls); no OAuth
support (only static auth headers — same limitation already noted for Custom Function); stdio
(locally-spawned process) MCP servers aren't supported, only remote Streamable HTTP servers,
which is the deployable/production-relevant transport anyway.

---

## 2026-07-24 — Custom Function node: call any API mid-conversation, no code required

Adds the last node type from the "expand workflow nodes" batch that genuinely needed its own
design pass rather than following the Extract Variable/Code node pattern directly: a **Custom
Function** node that calls an arbitrary HTTP API mid-flow and maps fields out of the JSON
response into variables — Retell's own equivalent of the same idea.

**Design decisions (`workflow_engine.py`):**
- Silent/auto-advancing like Extract Variable and Code — never speaks on its own, the flow
  continues to whatever's next in the same turn once the call finishes.
- **No dedicated error branch/config needed**: every call automatically sets
  `<function_name>_success` ("true"/"false") and, on failure, `<function_name>_error` — so a
  downstream Logic Split can check `get_weather_success equals true` to branch on failure with
  zero extra concepts, reusing the branching primitive that already existed instead of adding a
  new one.
- URL, headers (values), and the JSON request body all go through the same `{{variable}}`
  substitution as everything else in this system (`substitute_template`) — so e.g.
  `https://api.example.com/orders/{{order_id}}` or a body of `{"email": "{{email}}"}` just work.
- Response mapping uses simple dot-paths (`current_weather.temperature`, `results[0].name`) —
  new `_extract_json_path()` helper, returns `None` (never raises) on any missing/wrong-shaped
  segment so a bad mapping degrades gracefully instead of crashing the call.
- Deliberately synchronous `httpx.request(...)`, matching every other outbound HTTP call already
  in this file (`_call_anthropic`, `_call_gemini`, `_call_sarvam_llm`) and in
  `telephony_service.py` — this codebase's LLM/workflow layer isn't async anywhere yet, so adding
  one async call here would just be inconsistent without actually buying anything.

**Frontend:** `CustomFunctionNode` in `nodes/ExtraNodes.jsx` (via the same `SimpleNode` factory,
Webhook icon). `NodePropertiesPanel.jsx` grew the biggest node form yet: template picker, name/
description, method+URL, a headers key/value list, a JSON body textarea (hidden for GET),
timeout, and an outputs list (variable name -> JSON path). New `lib/functionTemplates.js` ships
two starter templates, picking one just pre-fills the form (still fully editable after):
- **Get Current Weather** — Open-Meteo's free public API, works with zero API key/signup.
- **Send Slack Notification** — posts to a Slack Incoming Webhook URL (the webhook URL itself is
  just `{{slack_webhook_url}}`, a plain dynamic variable — nothing hardcoded/secret in the flow).

**Verified for real, not just read through:** seeded a throwaway workflow
(begin -> custom_function calling Open-Meteo for New Delhi's coordinates -> logic_split on
`get_weather_success` -> ending) directly in the dev DB, hit `/test/workflow` over real HTTP, and
got back genuinely live weather data end-to-end (`"response": "It is 26.6 degrees Celsius right
now."`, correctly substituted from a real API response) — then deleted the throwaway rows.

**Files touched:** `backend/app/services/workflow_engine.py` (`_slugify_var_name`,
`_extract_json_path`, `_execute_custom_function_node`, dispatch case),
`frontend/src/components/nodes/ExtraNodes.jsx`, `frontend/src/lib/functionTemplates.js` (new),
`frontend/src/components/NodePropertiesPanel.jsx`, `frontend/src/pages/WorkflowBuilder.jsx`.

**Known limitation:** only Twilio/Slack-style plain REST calls are covered — nothing here
attempts OAuth flows, so any API requiring an OAuth handshake (vs. a static API key/token in a
header) isn't usable from this node yet.

---

## 2026-07-24 — 9 new workflow node types, wired all the way to live calls (not just the Test panel)

Biggest single addition to the workflow builder since it was created. Retell's own flow builder
has: Call Transfer, Press Digit, Logic Split, Agent Transfer, In-Call SMS, Extract Variable,
Code, Ending, Note — this adds all nine, with real (not stubbed) backend behavior, and —
importantly — wires **live phone calls** to actually walk the saved workflow graph, which they
did not do before this change (see "the gap" below).

**The gap this closes:** the workflow graph/node system only ever affected the Workflow
Builder's own Test panel. A real phone call (`routers/calls.py`'s turn loops) called
`voice_pipeline.generate_reply()` directly — one flat LLM prompt, completely bypassing whatever
flow had been built. So none of these new node types would have meant anything on an actual
call. Fixed: every provider's turn loop now loads the agent's saved `Workflow` (if any) once at
call start and calls the *same* `workflow_engine.execute_workflow()` the Test panel uses, for
every turn — agents with no saved workflow are completely unaffected (still the old flat-prompt
behavior, zero regression risk).

**New node types (`workflow_engine.py`):**
- **Note** — pure canvas annotation, no handles, engine never even sees it.
- **Ending** — speaks a final message, then `ended: True` (caller hangs up / stops the test).
- **Logic Split** — routes on a **variable's value** (equals/not_equals/contains/greater_than/
  less_than), not the user's literal words — e.g. "if `plan == 'pro'`, go here". Falls back to a
  Default/else edge.
- **Extract Variable** — asks the agent's own LLM to pull named fields (e.g. `email`,
  `preferred_date`) out of the conversation so far into plain variables. Silent — no spoken
  reply of its own, chains straight through to whatever's next in the same turn.
- **Code** — evaluates one allow-listed expression (arithmetic/comparisons/boolean logic over
  existing variables only — a hand-written `ast`-based mini-evaluator, never `eval`/`exec`) and
  stores the result as a new variable. Deliberately not a general code sandbox.
- **Call Transfer** — real transfer today for Twilio-connected agents (redirects the live call
  via Twilio's REST API to fresh TwiML that `<Dial>`s the target number); other telephony
  providers speak the configured message and end the call until their own transfer support is
  added (consistent with this codebase's existing provider-by-provider rollout pattern).
- **Press Digit** — synthesizes **real DTMF touch-tones** from scratch (new
  `services/dtmf_service.py` — sine-wave dual-tone generation, then G.711 mu-law-encoded for
  Twilio/Exotel/Telnyx/Plivo or 16-bit linear PCM for Vonage) and plays them into the live call —
  e.g. to auto-navigate an IVR after a transfer. No external API involved.
- **In-Call SMS** — sends a real SMS via Twilio's REST API to the caller's number today; same
  Twilio-first, other-providers-later pattern as Call Transfer.
- **Agent Transfer** — hands the rest of the call off to a *different* agent (own prompt/voice/
  LLM/workflow) — pure application logic, works for every telephony provider identically.

Extract Variable / Code / Logic Split / Note never wait for user input and never speak on their
own — after running, the engine auto-advances through them within the same turn until it lands
on something that actually does speak, so a single user turn can pass through several before
the reply comes back (`_execute_node`'s new `_continue()` chaining, depth-capped at 12 to guard
against an accidental cycle).

**API contract change:** `execute_workflow()` now also returns `variables` (dynamic_variables
merged with anything Extract Variable/Code just produced — thread it into the next call),
`ended`, and `action` (the structured side-effect for Call Transfer/Press Digit/In-Call SMS/
Agent Transfer — `POST /test/*` narrates these as text like *"📞 Live call would now transfer
to..."* since there's no real phone line in a text/voice test; live calls in `calls.py` actually
perform them via the new `_perform_call_action()`).

**Frontend:** `components/nodes/SimpleNode.jsx` (shared factory for the 6 single-in/single-out
node types) + `ExtraNodes.jsx`, plus dedicated `LogicSplitNode.jsx` (dynamic per-branch output
handles, same pattern as DialogueNode's per-condition handles) and `NoteNode.jsx` (sticky-note
styling, no handles at all). `WorkflowBuilder.jsx`'s node palette grew a collapsible "More" section
so the always-visible core (Dialogue/Action/Condition/Ending) doesn't get crowded out.
`NodePropertiesPanel.jsx` gained a properties form for each new type (branch editor for Logic
Split, variable-list editor for Extract Variable, agent picker for Agent Transfer, ...).
`TestingPanel.jsx` now merges `variables` back into its dynamic-variables state after every
turn (so Logic Split/extracted values persist across the test conversation) and shows a
"— Flow ended —" system marker + stops the call when `ended` comes back.

**Known limitations (documented, not silently swept under the rug):** Call Transfer / In-Call
SMS only actually execute for Twilio-connected agents so far — other providers speak the
configured message and stop instead of silently doing nothing. Extracted variables aren't
persisted mid-call beyond the call's own lifetime (saved to `Call.dynamic_variables` once, at
the point the call ends).

**Files touched:** `backend/app/services/workflow_engine.py` (node dispatch + safe-eval +
extract-variable LLM call), `backend/app/services/dtmf_service.py` (new),
`backend/app/services/telephony_service.py` (`transfer_twilio_call`, `send_twilio_sms`),
`backend/app/routers/calls.py` (`_WorkflowState`, `_generate_turn_reply`,
`_perform_call_action`, all 5 provider turn loops), `backend/app/routers/testing.py`,
`frontend/src/components/nodes/{SimpleNode,ExtraNodes,LogicSplitNode,NoteNode}.jsx` (new),
`frontend/src/components/NodePropertiesPanel.jsx`, `frontend/src/pages/WorkflowBuilder.jsx`,
`frontend/src/components/SettingsDock.jsx`, `frontend/src/components/TestingPanel.jsx`.
Verified end-to-end over real HTTP against the running dev backend (logic_split routing both
branches correctly, call_transfer's action + narration) before writing this entry.

---

## 2026-07-24 — Docked Global/Node Settings panel (replaces two overlapping floating panels)

Working through the Retell-parity roadmap: after confirming the DB choice (Neon, see chat —
scale-to-zero pricing beats Railway's always-on billing for this stage), started on the "next
level" UI pass, in this order: docked settings panel first, since node types/tool-calling/MCP
all need somewhere to render their settings and shouldn't be built against the old floating
panels.

**The problem:** `AgentSettingsPanel` ("Agent Settings", toggled via a button) and
`NodePropertiesPanel` (auto-shown when a node is selected) were both independently
`absolute top-0 right-0 h-full` — i.e. the exact same screen position — so selecting a node
while Agent Settings was open (or vice versa) meant they'd stack directly on top of each other.
`TestingPanel` was a third, separately `fixed top-0 right-0 z-50` overlay with the same issue.

**The fix — matches Retell's own docked-panel pattern:**
- New `components/SettingsDock.jsx`: ONE permanently-docked right-hand column (collapsible via
  the same chevron pattern `TestingPanel` already used) with two tabs — **Global Settings**
  (agent-level config) and **Node Settings** (whichever node is selected) — instead of two
  separate floating panels. Selecting a node auto-switches to the Node Settings tab.
- `AgentSettingsPanel.jsx` and `NodePropertiesPanel.jsx` stripped of their own fixed positioning,
  header bar, and close button — they're now pure embeddable content, rendered inside the dock's
  tab body. `NodePropertiesPanel` shows a "select a node" placeholder instead of returning `null`
  when nothing's selected (previously the panel just vanished with no explanation).
- `TestingPanel.jsx`: changed from a `fixed`/`z-50` viewport overlay to a normal flex sibling
  (`shrink-0`, no more `fixed`/`right-0`) — it now sits in the layout between the canvas and the
  settings dock instead of floating on top of everything, so nothing can ever overlap again.
- `components/ui/CollapsibleSection.jsx` (new): accordion wrapper used to group the Global
  Settings fields — LLM/Language/Voice default open, Transcription/Calling default collapsed —
  directly addressing the earlier "I have to scroll a lot" feedback without removing any fields.
- Removed the blocking `alert()` popups on every settings save; both panels now show an inline
  "Saved ✓" flash on their own Save button instead.
- `pages/WorkflowBuilder.jsx`: removed the "Agent Settings" toggle button (the dock is always
  there now) and the canvas-overlay rendering of `NodePropertiesPanel`; added a `ThemeToggle` to
  the builder's own toolbar (previously only reachable from the main `Layout` header, which the
  builder page hides).

**Verified:** dark mode itself was already fully implemented (`ThemeContext`, CSS variable
theme tokens, persisted to `localStorage`) from an earlier session — just wasn't reachable from
inside the Workflow Builder, now fixed. Frontend builds clean, dev server hot-reloaded through
every change with no errors.

**Files touched:** `frontend/src/components/SettingsDock.jsx` (new),
`frontend/src/components/ui/CollapsibleSection.jsx` (new),
`frontend/src/components/AgentSettingsPanel.jsx`, `frontend/src/components/NodePropertiesPanel.jsx`,
`frontend/src/components/TestingPanel.jsx`, `frontend/src/pages/WorkflowBuilder.jsx`.

**Next up (per the roadmap):** expand workflow node types (Call Transfer, Press Digit, Logic
Split, Agent Transfer, In-Call SMS, Extract Variable, Code, Ending, Note) — the docked Node
Settings tab built here is what their per-node config will render into.

---

## 2026-07-24 — Dynamic variables + call-time language override (the gap Retell AI itself has)

User asked to confirm the stack (React + FastAPI, confirmed — see chat) and, while reviewing all
25 Retell AI screenshots they sent, pointed out a real gap in Retell's own product: you can set an
agent's language to one fixed language or a multi-language list at *agent creation* time, but there
is no way to say "start THIS call in Tamil" without cloning the agent or hardcoding it — even if the
script/prompt was written entirely in English. Built the fix as a generic **dynamic variables**
mechanism (the same concept Retell calls `retell_llm_dynamic_variables`), with `language` as a
reserved key that gets special handling:

- `app/services/dynamic_variables.py` (new): `apply_dynamic_variables(agent, raw_variables)` returns
  an `AgentOverride` — a transparent proxy in front of the real Agent row that overrides only
  `.language` (resolved via the new `language_catalog.resolve_language_input()`, which fuzzy-matches
  either a code like `ta-IN` or a name like `"Tamil"`/`"tamil"`) and `.agent_prompt` (with every other
  `{{key}}` in the dict substituted in, Retell-style). Every other attribute reads straight through to
  the real agent, so nothing downstream (`voice_pipeline.py`, `key_resolver.py`, `workflow_engine.py`,
  logging) needs to know an override happened — same call flow, same STT/TTS/LLM provider selection,
  just a different `.language`/`.agent_prompt` for that one call/test.
- `language_catalog.py`: added `resolve_language_input()` (code → code, exact name → code, bare name
  ignoring "(...)" region suffix → code, e.g. `"English"` → `en-IN`'s "English (India)"; India entries
  are checked first given this product's India focus).
- `models/call.py` / `schemas/call.py`: added `dynamic_variables` (JSON, nullable) to `Call` — whatever
  the caller passes when starting a call (`POST /calls/`) is persisted and applied for that call's
  entire lifetime. Migration: `backend/migrate_dynamic_variables.py` (run against `app.db`/`test.db`).
- `routers/calls.py`: every telephony stream handler (Twilio, Exotel, Telnyx, Plivo, Vonage) now runs
  `agent, _ = apply_dynamic_variables(agent, call.dynamic_variables)` right after loading the agent,
  before entering its turn loop — so the override is live for STT language, the LLM's language
  instruction, and TTS all at once.
- `routers/testing.py`: both `/test/workflow` (text) and `/test/voice` now accept an optional
  `dynamic_variables` dict/form-field, apply the same override to the agent used for that test, AND
  thread the clean variable dict into `workflow_engine.execute_workflow(...)` so `{{key}}`
  placeholders inside individual workflow-node prompts/static text (not just the agent's own prompt)
  get substituted too — lets you test the language override (or any other variable) live in the
  Workflow Builder without saving anything.
- `services/workflow_engine.py`: `execute_workflow` / `_execute_node` / `_execute_dialogue_node` now
  take an optional `dynamic_variables` dict and substitute it into a node's `prompt`/`staticText`.
- Frontend: new `components/DynamicVariablesEditor.jsx` — a small key/value list editor with inline
  guidance that `language` is the reserved override key. Wired into:
  - `AgentTestCall.jsx` (the per-agent "Test Call" card) — sent as `dynamic_variables` on `POST /calls/`.
  - `TestingPanel.jsx` (Workflow Builder's test drawer) — a `{}` toggle button reveals the editor;
    values are sent with both `/test/workflow` and `/test/voice` requests.
  - Added a one-line hint under the Language selector in `AgentForm.jsx`, `AgentSettings.jsx`, and
    `AgentSettingsPanel.jsx` pointing at this feature instead of duplicating agents per language.

**Why this design (vs. Retell's):** Retell forces a choice at agent-creation time and has no
call-time override at all. Reusing the dynamic-variables mechanism (which every serious voice AI
platform already needs for things like `{{customer_name}}`) means zero new concepts for the user —
one variable, `language`, unlocks per-call language switching for free, and every other variable
still does the normal prompt-templating job.

**Tech stack confirmation (asked by user):** React (Vite) frontend, FastAPI (Python) backend — both
confirmed, no change. Database: currently SQLite (`app.db`) for local dev simplicity; `docker-compose.yml`
already provisions Postgres for when this needs to run multi-user/production — recommendation is to
switch `DATABASE_URL` to that Postgres instance before any real deployment (SQLite doesn't handle
concurrent writes well, which matters once multiple simultaneous calls are hitting the DB).

---

## 2026-07-24 — Telnyx/Plivo/Vonage fully wired (no more "coming soon"); workflow builder no longer requires an agent to exist first

Two pieces of user feedback acted on together:

### 1. Telnyx, Plivo, Vonage: real outbound calling + bidirectional media streaming (matching Twilio/Exotel's bar, not just a credentials form)

Previously these three showed "(coming soon)" in the Calling tab and `initiate_call()` returned a
canned "not implemented" error no matter what was configured. Read each provider's actual API docs
(Call Control / Media Streaming for Telnyx, Voice API / Audio Streaming XML for Plivo, Voice API /
NCCO WebSockets for Vonage) and implemented all three for real:

- `services/telephony_service.py`: added `initiate_telnyx_call`, `initiate_plivo_call`,
  `initiate_vonage_call`, alongside the existing Twilio/Exotel ones. Key differences discovered and
  handled:
  - **Telnyx**: like Twilio, `stream_url`/`webhook_url` can be set per-call directly on the
    `POST /v2/calls` Dial request (`stream_bidirectional_mode=rtp`) — no static-URL workaround
    needed like Exotel. Its WS envelope is JSON (`start`/`media`/`stop`), but the stream identifier
    (`stream_id`) lives at the top level of every frame (not nested in `start` like Twilio's
    `streamSid`), and per the official API reference, outbound frames back to Telnyx omit the
    stream id entirely — both quirks required generalizing the shared turn loop (see below) rather
    than just reusing it as-is.
  - **Plivo**: same "fetch a fresh URL per call" shape as Twilio (`answer_url`, fetched live, so it
    can carry our `call_id`), returning Plivo XML with a bidirectional `<Stream>` element. Inbound
    WS frames mirror Twilio's shape, but the OUTBOUND event Plivo expects is named `playAudio` (not
    `media`), with explicit `contentType`/`sampleRate` — different enough to need its own loop
    (`_run_plivo_turn_loop`).
  - **Vonage**: authenticates via a short-lived RS256 JWT signed with a Voice Application's private
    key (`services/telephony_service._vonage_jwt`, via `python-jose` — NOT the account API
    key/secret used by Vonage's other APIs). The NCCO is passed inline in the call-creation body
    (call_id is already known at that point — see `call_service.create_call` — so no separate
    `answer_url` round-trip is needed). Its `connect`-to-websocket action carries **raw 16-bit/16kHz
    PCM binary frames with no JSON envelope at all** — fundamentally different from the other three,
    so it gets its own dedicated binary-frame loop (`_run_vonage_turn_loop`) using
    `websocket.receive_bytes()`/`send_bytes()` instead of the JSON event loop.
- `routers/calls.py`: generalized `_run_voice_turn_loop` with `id_in_top_level` and
  `echo_id_on_send` flags (defaults preserve existing Twilio/Exotel behavior exactly) so Telnyx
  could reuse it; added `_run_plivo_turn_loop` and `_run_vonage_turn_loop` for the two providers
  whose envelopes differ too much to share it. New endpoints: `POST /calls/{id}/telnyx/webhook` +
  `WS /calls/{id}/telnyx/stream`, `GET|POST /calls/{id}/plivo/answer` + `WS /calls/{id}/plivo/stream`,
  `WS /calls/{id}/vonage/stream` — all per-call (URL carries `call_id` directly), unlike Exotel's
  generic endpoint, since none of these three providers have Exotel's "webhook URL configured once,
  outside our control" constraint.
- `services/provider_catalog.py`: corrected the credential fields to what each provider actually
  requires — Telnyx needs a Connection ID (Call Control Application ID) alongside the API key, not
  just a bare key; Plivo needs nothing beyond Auth ID/Token/number; Vonage needs an Application ID +
  full PEM private key, not an API key/secret pair. Added a `"textarea"` field type (Vonage's key is
  multi-line) — `Integrations.jsx`'s `CredentialModal` now renders a `<textarea>` for those.
  `lib/voiceProviders.js`: flipped all three from `supported: false` to `true` with setup
  instructions instead of "coming soon" copy — this is what makes the yellow warning block and the
  "(coming soon)" dropdown suffix disappear from the agent Calling tab.
- Known limitation carried over from Twilio/Exotel and not addressed here either: audio bytes are
  forwarded between STT/TTS providers and telephony providers without real codec transcoding
  (mulaw/PCMU 8kHz for Twilio/Exotel/Telnyx/Plivo, raw PCM 16kHz for Vonage) — functionally wired
  end-to-end, but a real STT/TTS provider expecting a specific container format may need this
  addressed for production-quality audio.
- Self-serve number search/purchase (like Twilio has via `/telephony/twilio/*`) was intentionally
  NOT built for these three — matches Exotel's bar (buy the number directly on the provider's own
  dashboard, then paste credentials here), not Twilio's extra convenience layer.

### 2. Workflow Builder no longer hard-blocks on "create an agent first"

Previously `/workflows/new` showed a dead-end screen ("Create an agent first") if you had zero
agents, forcing a trip to a separate page before you could even see the canvas. Per the user's own
suggestion — let people design and test a flow first, optionally assigning/configuring the agent's
voice/LLM/calling setup as part of that same screen — this is now genuinely flow-first:

- `pages/WorkflowBuilder.jsx`: removed the blocking screen entirely. The agent dropdown always
  includes a `"+ New Agent (configure below)"` option (now the default when arriving with no
  `?agentId=`); the "Agent Settings" button is always clickable, opening `AgentSettingsPanel`
  against either the real loaded agent or a `DRAFT_AGENT_DEFAULTS`-seeded placeholder object when
  none exists yet. A new `ensureAgent()` helper lazily `POST`s a real `Agent` (using whatever's set
  in that panel, or plain defaults if it was never opened) the first time one is actually needed —
  on Save, on Test, or on an explicit Agent Settings save — and the workflow attaches to whichever
  agent id results. Also fixed the agent-picker dropdown to actually call `loadAgent()` when
  switching between existing agents (previously silently no-op'd, leaving the settings panel showing
  stale data) and to reset to draft mode cleanly.
- `components/AgentSettingsPanel.jsx`: added an editable "Agent Name" field (needed since creating
  an agent requires a name, and the panel previously had no way to set one) and an `isDraft` banner
  explaining the lazy-create behavior; the Save button reads "Create Agent" instead of "Save
  Settings" while in draft mode.

---

## 2026-07-23 (later same day, part 3) — Auto STT mode, informed by real Retell AI dashboard research

Background research (comparing our Voice tab against Retell AI's actual documented dashboard
behavior) confirmed something worth acting on directly rather than just noting: Retell does NOT
expose STT/ASR provider choice as a peer dropdown next to Voice/TTS for most users — it's
auto-routed by the agent's configured language, with manual provider pinning reserved for an
advanced/custom mode. This directly answers the open "do we really need separate STT and TTS
sections" question from earlier the same day — the answer, backed by how the platform we're
benchmarking against actually works, is: keep them conceptually separate (they're genuinely
different vendor calls under the hood) but make STT invisible-by-default.

- `models/agent.py` + `schemas/agent.py`: `stt_provider` default changed from `'whisper'` to
  `'auto'`.
- `services/voice_pipeline.py` `transcribe()`: rewritten so `stt_provider == "auto"` (the new
  default) builds an ordered candidate list — Sarvam → Deepgram → AssemblyAI if the agent's
  language is Indic (`language_catalog.is_sarvam_compatible`), else Deepgram → AssemblyAI — and
  tries each in turn, skipping any with no resolvable key (via `key_resolver`), ending at Whisper
  as the guaranteed-available fallback. Manually picking a specific provider still works exactly
  as before (`stt_provider` set to anything other than `"auto"` short-circuits straight to that
  one provider, no auto-routing).
- `lib/voiceProviders.js`: added an `"Auto (Recommended)"` entry to `STT_PROVIDERS` (first/default
  in the list, no `catalogId`/`keyField` — intentionally, so the UI hides the manual controls for
  it). `AgentForm.jsx`, `pages/AgentSettings.jsx`, `components/AgentSettingsPanel.jsx`: the
  Transcription section's model-library link and `KeyToggle` now only render when a specific
  (non-auto, non-Sarvam-forced) provider is chosen — picking "Auto" collapses the section down to
  just the dropdown + one explanatory line, matching the reduced-decision-surface Retell actually
  ships. New agents now default to zero required STT decisions instead of defaulting to Whisper
  specifically.
- Verified: frontend `npm run build` and backend `python -c "from app.main import app"` both still
  succeed with zero errors after this change; `ReadLints` clean on every touched file.

### Other Retell-comparison findings, deliberately NOT adopted (noted for the record)
- **No BYOK at all on Retell** — their own support confirms no per-provider key vault; the only
  way to use your own OpenAI/etc. key on Retell is standing up a full custom LLM WebSocket server
  yourself. Our whole premise is the opposite (BYOK-first per the original ask), so this is an
  intentional divergence, not a gap to close.
- **Agent-type selection step before the builder** (Single Prompt / Multi-Prompt / Conversation
  Flow / Chat) — a real structural difference worth having in mind for a future pass, but a bigger
  lift than this pass's scope (would mean 2+ distinct agent "kinds" with different downstream
  schemas) and not something the user has asked to change yet.
- **Phone Numbers as its own top-level nav tab** (parallel to Agents/Billing/Analytics on Retell,
  with buy/import/SIP-trunk-connect + direct agent assignment all in one place) — we already have
  the same underlying capability (`POST /telephony/twilio/buy-number`,
  `GET /telephony/twilio/available-numbers`, SIP-style Exotel setup) but it's surfaced inside the
  Integrations → Telephony tab rather than a dedicated nav item. Worth revisiting once the broader
  UI pass the user deferred ("we'll work on UI later... first let's create the platform") is
  actually scheduled.

---

## 2026-07-23 (later same day, part 2) — Agent ownership, real BYOK key-vault fallback, key-toggle UX fix, Integrations Voice-tab merge, Agents/Workflow page restructure

User feedback (from screenshots) that triggered this pass: "OpenAI GPT API Key (Optional)" was
misleading, `wss://api.openai.com/v1/realtime` (the unused legacy `llm_websocket_url` field) was
shown in the UI for no reason, STT/TTS being separate Integrations tabs meant re-entering the same
vendor's key up to 3 times, the Agents page mixed "create a new agent" + "list agents" +
"test-call any agent" onto one screen, and a Workflow could be built before any agent existed.
Also asked to verify every DB table is actually created correctly.

### 1. Agents now have a real owner (`Agent.user_id`) — this was the actual root cause blocking BYOK
- Previously `Agent` had no `user_id` at all and `/agents` had zero auth — any logged-in (or even
  unauthenticated) caller could list/edit **every** agent on the platform, and there was no way to
  know whose Integrations vault to fall back to for a given agent's LLM/STT/TTS keys.
- `models/agent.py`: added nullable `user_id` FK to `users`. `migrate_agent_providers.py`: added
  the migration; ran it against `app.db` (verified via `PRAGMA table_info` — all 8 tables' columns
  now match their SQLAlchemy models exactly: agents(25), calls(10), workflows(10),
  workflow_executions(8), knowledge_bases(6), documents(9), users(7), integrations(8)).
- `routers/agents.py` + `services/agent_service.py`: every route now requires
  `Depends(get_current_user)`; `GET /agents/` is scoped to the caller's own agents;
  `GET/PUT/PATCH/DELETE /agents/{id}` 404 (not 403, to avoid confirming an ID exists) if the
  agent belongs to a different user. Verified with a live smoke test: user B gets an empty list
  and a 404 for user A's agent; unauthenticated `GET /agents/` returns 401.

### 2. `services/key_resolver.py` (new) — the BYOK precedence chain now actually reaches the account vault
- Before: every LLM/STT/TTS call site only checked "agent's own key field" -> "platform .env key".
  The account-wide Integrations vault (`integration_service`) was **only ever consulted for
  telephony** — for every other provider it was pure decoration: users could "Connect" a key on
  the Integrations page and it would never actually be used by a call.
- `resolve_key(agent, own_field, provider_id, platform_key)` now checks, in order: (1) the agent's
  own override field, (2) the owning user's saved Integration credential for that provider id
  **across all of llm/stt/tts categories** (not just the exact one being resolved — see #4 below
  for why), (3) the platform's `.env` fallback.
- Wired into `workflow_engine._resolve_llm_key` (gpt/claude/gemini/sarvam) and every branch of
  `voice_pipeline.transcribe`/`synthesize` (sarvam/deepgram/assemblyai/cartesia/deepgram_aura/
  openai_tts/whisper/elevenlabs). Also fixed the OpenAI-quota circuit breaker in
  `workflow_engine.py`, which used to key off "does the agent have its own field set" — now keys
  off "is the resolved key literally the platform's .env key", so an agent riding its own or its
  owner's vault key is never wrongly short-circuited by the platform key's quota.
- Verified live: saved a Sarvam key under the **LLM** category only, created an agent using Sarvam
  for **TTS** with no per-agent key, and `key_resolver.resolve_key(...)` correctly found and
  returned that same key — exactly the "connect once, works everywhere" behavior now promised by
  the UI copy.

### 3. Fixed a real key-leak + a real "can't revert to default" bug in the key-toggle UX
- `AgentSettingsPanel.jsx`'s existing "Platform Key / My Own Key" toggle seeded its initial
  position straight from `agent.openai_api_key` etc — which, it turns out, `GET /agents/{id}` was
  returning **in plaintext**, unmasked, to the browser on every fetch. `AgentSettings.jsx` (the
  other agent-editing surface) had the opposite bug: it never seeded the toggle from the saved
  value at all, so an agent that already had its own key configured would silently show "Use
  Default" — misleading, though harmless by luck because of a blanket "don't send blank fields"
  save filter.
- Fixed at the schema level: `schemas/agent.py` `AgentResponse` gained a `model_validator` that
  masks all 8 `*_api_key` fields to `None` on every response and instead exposes
  `configured_own_keys: List[str]` (just *which* fields have something saved — never the value
  itself). Verified live: creating an agent with `openai_api_key` set returns
  `openai_api_key: None` + `configured_own_keys: ["openai_api_key"]`.
- Extracted the toggle into a shared `components/ui/KeyToggle.jsx` ("Use Default" / "My Own Key"),
  used identically by `AgentForm.jsx`, `AgentSettings.jsx` and `AgentSettingsPanel.jsx`. It now
  shows a real `ConnectionStatus`-style hint under "Use Default" (green check if the account vault
  actually has a key, muted "connect one" link if not) and renders each provider's new
  `sharedKeyNote` (see #4).
- Fixed the save logic in `AgentSettings.jsx` and `AgentSettingsPanel.jsx` to a correct 3-way rule
  instead of a blanket "empty = don't touch": toggle=Use-Default + something WAS saved -> send
  `''` to actually clear it; toggle=My-Own-Key + nothing retyped -> omit (leave the real saved
  value alone, since it's never loaded into the browser to re-send); toggle=My-Own-Key + new value
  typed -> send it. Both save handlers now resync from the server afterward
  (`fetchAgent(true)` / `loadAgent(...)`) so the toggle positions reflect what's actually stored.

### 4. Integrations page: merged Speech-to-Text + Text-to-Speech into one "Voice" tab, removed duplicate OpenAI cards
- Several vendors sell one account key that covers more than one category (Sarvam: LLM+STT+TTS;
  OpenAI: LLM+Whisper-STT+TTS; Deepgram: STT+TTS-Aura) — the old 4-tab layout
  (LLM/STT/TTS/Telephony) asked for the *same* key up to 3 times. `provider_catalog.py`: removed
  the standalone "OpenAI Whisper" (stt) and "OpenAI TTS" (tts) cards entirely (nothing to connect
  beyond the LLM tab's OpenAI key) and renamed the TTS `deepgram_aura` catalog id to `deepgram` so
  it lines up with the STT entry of the same vendor; added `shares_key_with` metadata to Sarvam's
  LLM/STT/TTS entries and Deepgram's STT/TTS entries.
- `frontend/lib/voiceProviders.js`: STT `whisper` and TTS `openai_tts` now point their
  `catalogId`/`catalogCategory` at the LLM tab's `openai` entry (so their `ConnectionStatus`/
  `KeyToggle` correctly read "connected" the moment OpenAI is connected under LLM, without a
  second card); added a `sharedKeyNote` string to every affected provider, surfaced by
  `KeyToggle`.
- `pages/Integrations.jsx`: replaced the 4 category tabs with 3 (LLM / Voice / Telephony).
  `mergeVoiceProviders()` groups same-id stt+tts catalog entries into one card carrying a
  `categories: ['stt','tts']` array; `ProviderCard` shows a capability badge per category it
  actually covers; `handleSave`/`handleDelete` now accept an array of categories and fan out one
  POST/DELETE per category so a single credential entry writes (or removes) every relevant
  Integration row at once. Deep-linking (`/integrations?open=stt:deepgram`) now resolves to the
  merged Voice tab correctly.

### 5. Dropped the unused `llm_websocket_url` field from every agent-editing UI
- It was a leftover from an earlier "stream raw audio straight to OpenAI's Realtime API"
  design that was never actually wired into the current STT->LLM->TTS pipeline
  (`workflow_engine.py`/`voice_pipeline.py` never read it) — it was just a required text field
  the user had to fill in for no functional reason. `schemas/agent.py`: made it `Optional[str] =
  None` (was a required `str`) and documented why; removed the input entirely from
  `AgentForm.jsx` and `AgentSettings.jsx`.

### 6. Agents page / Agent creation / Call testing / Workflow builder restructure
Compared against how Retell AI (and similar platforms) structure this: agent creation is its own
focused flow, the agents list is a scannable list/grid (not sharing screen space with a live
create form + an unrelated call-testing widget), testing a call belongs to the ONE agent you're
looking at, and a conversation flow is always built for a specific agent, not floating free.
- New `pages/AgentNew.jsx` + route `/agents/new` — `AgentForm` (the tabbed create form) now lives
  on its own page instead of permanently inline on the Agents list; on success it navigates
  straight into the new agent's own Settings page (where Voice/Calling/testing all live).
  `AgentForm.jsx`'s `onSuccess` now passes back the created agent object so callers can redirect.
- `pages/Agents.jsx` rewritten as a clean card grid (name, LLM/Voice provider badges, prompt
  preview, a "Build conversation flow" deep link) with a single "New Agent" button — the inline
  form and the account-wide Call Simulator are both gone from this page.
- New `components/AgentTestCall.jsx` — a trimmed CallSimulator scoped to one already-known agent
  (no "Select Agent" dropdown, since you're already on that agent's page); mounted alongside the
  settings tabs on `pages/AgentSettings.jsx` (2-column layout, sticky on desktop). Deleted the old
  account-wide `components/CallSimulator.jsx`.
- `pages/WorkflowBuilder.jsx`: reads `?agentId=` from the URL (linked from each Agents card /
  Settings page) to pre-select and pre-load that agent instead of silently defaulting to
  "whichever agent loaded first" or leaving it unset. Added a hard gate: if the account has zero
  agents and no `workflowId`/`agentId` is present, the canvas doesn't render at all — shows
  "Create an agent first" with a direct link to `/agents/new` instead of letting someone build out
  a whole flow that can never be saved (the existing `if (!selectedAgent) alert(...)` on Save was
  real but only surfaced the problem *after* wasted work).

### Verified end-to-end (live smoke test against the running dev servers)
- Register -> create agent with an own OpenAI key -> response has `openai_api_key: null` +
  `configured_own_keys: ["openai_api_key"]` (no leak) -> `GET` the same agent shows the same
  (masking survives re-fetch, not just create).
- Second registered user: `GET /agents/` returns 0 (not the first user's agent), `GET
  /agents/{first_user's_id}` returns 404. Unauthenticated `GET /agents/` returns 401.
- Saved a Sarvam key once under `llm` category; `key_resolver.resolve_key(agent_using_sarvam_tts,
  "sarvam_api_key", "sarvam", "")` returned that same key with zero per-agent key and zero `stt`or
  `tts`-category Integration row — confirms the "connect once, used everywhere" behavior.
- `npm run build` (frontend) and importing `app.main:app` (backend) both succeed with zero errors;
  `ReadLints` clean across every touched file.
- DB re-verified table-by-table against the live SQLAlchemy models after the new migration — all
  8 tables match exactly (see #1).

### Known remaining gaps (not addressed this pass, flagged for later)
- `key_resolver`'s vault lookup opens a short-lived DB session per key resolution (simplicity over
  micro-perf) rather than threading one connection through the whole call turn.
- Audio transcoding for telephony (TTS returns compressed audio; Twilio/Exotel want raw
  mulaw/PCM) — flagged in the previous entry, still not addressed.
- `/analytics/summary` endpoint still missing.
- LiveKit Agents migration still pending (see previous entry).

---

## 2026-07-23 (later same day) — Fixed real Exotel routing bug + voice/model discoverability + several silent TTS bugs

Triggered by the user pointing out they couldn't find where to actually configure Exotel, and
asking "if a voice isn't in your dropdown, how does the user use it?" — this pass re-read the
actual Exotel/Sarvam/Cartesia/Deepgram/OpenAI docs (instead of assuming) and found real bugs, not
just UX gaps.

**Bugs found & fixed by re-reading provider docs:**
- **Exotel Voicebot Applet architecture was wrong.** Its WebSocket URL is configured *once*,
  statically, inside a Flow in the user's own Exotel dashboard — it can never contain our
  internal `call_id` the way Twilio's per-call TwiML fetch can. The old `/calls/{id}/stream`
  endpoint could never have worked for a real Exotel call. Fixed by:
  - `models/call.py` + `migrate_agent_providers.py`: added `Call.provider_call_sid`.
  - `services/telephony_service.py`: `initiate_exotel_call` now requests `.json` and captures
    the `Call.Sid` Exotel returns synchronously; added `exotel_stream_url()`.
  - `routers/calls.py`: added a new generic `@router.websocket("/exotel/stream")` endpoint that
    resolves the right `Call`/`Agent` from the `call_sid` in Exotel's first `start` event,
    matched against `provider_call_sid`. Refactored the Twilio/Exotel turn loop into a shared
    `_run_voice_turn_loop()` + `_finalize_call()` (was duplicated/hardcoded before).
  - `routers/telephony.py`: added `GET /telephony/exotel/stream-url` so the frontend can show
    users the exact URL to paste into their Exotel Flow.
- **Sarvam TTS speaker list was invalid for the model we call.** We call `model: "bulbul:v3"`
  but the old `valid_speakers` list mixed in v2-only names (`anushka`, `manisha`, `vidya`, `arya`,
  `abhilash`, `karun`, `hitesh`) and defaulted to `anushka` — which 400s against `bulbul:v3` per
  Sarvam's docs. Replaced with the real 37-speaker `bulbul:v3` catalog, default `shubh`
  (`services/voice_service.py`). The frontend's Sarvam voice list (`meera`, `pavithra`,
  `maitreyi`, `diya`, `neel`, `arjun`) didn't match *any* real Sarvam speaker at all — replaced
  with the real list in `lib/voiceProviders.js`.
- **`voice_name` (the picked voice) was silently ignored for Cartesia, Deepgram Aura, and OpenAI
  TTS.** `voice_pipeline.synthesize()` called each provider without forwarding the agent's
  `voice_name`, so every agent got that provider's hardcoded default voice no matter what was
  configured in the UI. Fixed all three call sites in `services/voice_pipeline.py`.

**Discoverability / "what if my voice isn't listed" — addressed platform-wide:**
- `lib/voiceProviders.js`: every LLM/TTS/STT provider now carries a `libraryUrl` (where to
  browse the provider's *complete* catalog — ElevenLabs Voice Library, Cartesia Voice Library,
  Sarvam/Deepgram/OpenAI docs) and TTS providers carry a `customFieldLabel`. Added real OpenAI
  TTS voices (13) and a curated Aura-2 voice set (were empty before).
- `AgentForm.jsx` / `AgentSettings.jsx` / `AgentSettingsPanel.jsx`: every Model tab now has an
  editable "Model ID" text field (not just a closed dropdown) plus a "Browse all X models" link;
  every Voice tab now has a "Custom Voice/Speaker ID" override field (previously ElevenLabs-only)
  plus a "Browse full voice library" link — so any voice/model the provider offers is reachable
  even if it's not in our curated shortlist.
- Calling tab: replaced the plain "see Integrations" text link with a one-click
  `/integrations?open=telephony:{provider}` button that deep-links straight into that provider's
  credential form.
- `Integrations.jsx`: now reads `?open=category:providerId` on load and auto-opens the right
  `CredentialModal`. Exotel's modal additionally shows the exact stream URL (via the new
  `/telephony/exotel/stream-url` endpoint) with a copy button and a docs link, instead of just
  prose telling the user to go figure out a URL themselves.
- `services/provider_catalog.py`: rewrote the Exotel description to describe the *correct*
  one-time Flow setup (static URL, not per-call).

**Known limitation surfaced, intentionally not attempted this pass:** TTS providers return
compressed audio (mp3/wav); Twilio Media Streams expects `audio/x-mulaw;8000` and Exotel expects
raw 16-bit PCM — both `/calls/{id}/stream` and `/calls/exotel/stream` currently forward whatever
`voice_pipeline.synthesize()` returns without transcoding, so live-call audio will likely sound
wrong/garbled on a real phone call today. Fixing this properly needs an audio transcoding step
(ffmpeg/pydub or similar) and is exactly the kind of real-time media handling LiveKit Agents
already solves — noted here rather than shipped as a rushed, untestable fix.

**Files touched:** `backend/app/models/call.py`, `backend/migrate_agent_providers.py`,
`backend/app/services/telephony_service.py`, `backend/app/services/voice_service.py`,
`backend/app/services/voice_pipeline.py`, `backend/app/services/call_service.py`,
`backend/app/services/provider_catalog.py`, `backend/app/routers/calls.py`,
`backend/app/routers/telephony.py`, `frontend/src/lib/voiceProviders.js`,
`frontend/src/components/AgentForm.jsx`, `frontend/src/pages/AgentSettings.jsx`,
`frontend/src/components/AgentSettingsPanel.jsx`, `frontend/src/pages/Integrations.jsx`.

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
