"""Call-time "dynamic variables" — arbitrary key/value pairs a caller/tester can pass when a
call/test starts, which get substituted into the agent's prompt (`{{name}}` -> value, same
convention Retell AI uses) AND, for the reserved `language` key, actually override which
language the agent listens/thinks/speaks in for *that one call only* — regardless of what
language the agent's base prompt/script was written in and regardless of the agent's own
saved default language.

This is the one meaningful gap we found in Retell AI's own product: they let you pick either
a single fixed language or a multi-language list at agent-creation time, but there is no way
to tell an individual call "start in Tamil this time" without cloning the agent. Solving that
with zero extra concepts (just reusing the dynamic-variables mechanism every call platform
already has) is the whole point of this module.

Usage: call `apply_dynamic_variables(agent, raw_dict)` once, right after loading the Agent for
a call/test, and use the returned object everywhere `agent` was used before — every other
service (`voice_pipeline.py`, `workflow_engine.py`, `key_resolver.py`, ...) reads plain
attributes off it, so nothing downstream needs to know an override even happened.
"""

import re
from typing import Optional

from app.services.language_catalog import resolve_language_input

_TEMPLATE_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

# Aliases a caller might reasonably use instead of the canonical `language` key.
_LANGUAGE_VAR_KEYS = ("language", "lang", "target_language", "call_language")


class AgentOverride:
    """Transparent proxy in front of a real (SQLAlchemy) Agent row: every attribute read falls
    through to the underlying agent UNLESS it was explicitly overridden here. Nothing else in
    the codebase needs to special-case this — `agent.language`, `agent.agent_prompt`,
    `agent.name`, `key_resolver.resolve_key(agent, ...)`, etc. all just work."""

    def __init__(self, base, **overrides):
        object.__setattr__(self, "_base", base)
        object.__setattr__(self, "_overrides", overrides)

    def __getattr__(self, item):
        overrides = object.__getattribute__(self, "_overrides")
        if item in overrides:
            return overrides[item]
        return getattr(object.__getattribute__(self, "_base"), item)

    def __repr__(self):
        base = object.__getattribute__(self, "_base")
        overrides = object.__getattribute__(self, "_overrides")
        return f"AgentOverride({base!r}, overrides={list(overrides.keys())})"


def substitute_template(text: Optional[str], variables: dict) -> str:
    """Replaces every `{{key}}` in `text` with `variables[key]` (case-sensitive key match,
    same as Retell). Unknown placeholders are left untouched rather than blanked out, so a
    typo doesn't silently erase part of the prompt."""
    if not text or not variables:
        return text or ""

    def _replace(match):
        key = match.group(1)
        return str(variables[key]) if key in variables else match.group(0)

    return _TEMPLATE_VAR_RE.sub(_replace, text)


def _extract_language_override(variables: dict) -> Optional[str]:
    for key in _LANGUAGE_VAR_KEYS:
        if key in variables and variables[key]:
            resolved = resolve_language_input(variables[key])
            if resolved:
                return resolved
    return None


def apply_dynamic_variables(agent, raw_variables: Optional[dict]):
    """Returns `(effective_agent, clean_variables)`.

    `effective_agent` is either the original `agent` unchanged (no variables / nothing to
    override) or an `AgentOverride` wrapping it with `.language` and/or `.agent_prompt`
    swapped in. `clean_variables` is the sanitized (all-string-values) variable dict, handed
    back so callers can also thread it into workflow-node prompt substitution."""
    if not agent or not raw_variables:
        return agent, {}

    variables = {
        str(k): str(v) for k, v in raw_variables.items() if k and v is not None and str(v).strip() != ""
    }
    if not variables:
        return agent, {}

    overrides = {}

    language_override = _extract_language_override(variables)
    if language_override:
        overrides["language"] = language_override

    base_prompt = getattr(agent, "agent_prompt", None) or ""
    substituted_prompt = substitute_template(base_prompt, variables)
    if substituted_prompt != base_prompt:
        overrides["agent_prompt"] = substituted_prompt

    if not overrides:
        return agent, variables
    return AgentOverride(agent, **overrides), variables
