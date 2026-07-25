import React, { useState, useEffect } from 'react';
import { ExternalLink, PhoneOutgoing, Check } from 'lucide-react';
import client from '../api/client';
import KeyToggle from './ui/KeyToggle';
import CollapsibleSection from './ui/CollapsibleSection';
import { LLM_PROVIDERS, TTS_PROVIDERS, STT_PROVIDERS, TELEPHONY_PROVIDERS, findProvider, KEY_PLACEHOLDER } from '../lib/voiceProviders';

const LibraryLink = ({ href, children }) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
    >
        {children}
        <ExternalLink className="w-2.5 h-2.5" />
    </a>
);

const KEY_FIELDS = ['elevenlabs_api_key', 'sarvam_api_key', 'openai_api_key', 'gemini_api_key', 'anthropic_api_key', 'cartesia_api_key', 'assemblyai_api_key', 'deepgram_api_key'];

const AgentSettingsPanel = ({ agent, isDraft, onUpdate }) => {
    // The real secret is never sent back from the backend (see schemas/agent.py's AgentResponse
    // masking) — `configured_own_keys` just says WHICH fields have an override saved, so we can
    // seed each KeyToggle's position (' ' = "My Own Key", value withheld) without ever holding the
    // actual key in the browser until the user explicitly retypes one.
    const originalOwnKeys = new Set(agent?.configured_own_keys || []);
    const [settings, setSettings] = useState({
        name: agent?.name || '',
        llm_provider: agent?.llm_provider || 'gpt',
        llm_model: agent?.llm_model || 'gpt-4o',
        language: agent?.language || 'en-US',
        voice_provider: agent?.voice_provider || 'elevenlabs',
        voice_name: agent?.voice_name || 'Rachel',
        voice_id: agent?.voice_id || '',
        stt_provider: agent?.stt_provider || 'auto',
        telephony_provider: agent?.telephony_provider || 'twilio',
        // API keys — '' = Use Default, ' ' = My Own Key (existing, value withheld)
        ...Object.fromEntries(KEY_FIELDS.map((f) => [f, originalOwnKeys.has(f) ? ' ' : ''])),
    });
    const [languageGroups, setLanguageGroups] = useState([]);
    const [connectedKeys, setConnectedKeys] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    useEffect(() => {
        client
            .get('/agents/languages')
            .then((res) => setLanguageGroups(res.data))
            .catch(() => {});

        client
            .get('/integrations/')
            .then((res) => setConnectedKeys(new Set(res.data.map((i) => `${i.category}:${i.provider}`))))
            .catch(() => {});
    }, []);

    const llmProvider = findProvider(LLM_PROVIDERS, settings.llm_provider);
    const ttsProvider = findProvider(TTS_PROVIDERS, settings.voice_provider);
    const sttProvider = findProvider(STT_PROVIDERS, settings.stt_provider);
    const telephonyProvider = findProvider(TELEPHONY_PROVIDERS, settings.telephony_provider);

    const isLlmConnected = connectedKeys.has(`${llmProvider.catalogCategory}:${llmProvider.catalogId}`);
    const isTtsConnected = connectedKeys.has(`${ttsProvider.catalogCategory}:${ttsProvider.catalogId}`);
    const isSttConnected = connectedKeys.has(`${sttProvider.catalogCategory}:${sttProvider.catalogId}`);

    const handleProviderChange = (provider) => {
        const p = findProvider(LLM_PROVIDERS, provider);
        setSettings({ ...settings, llm_provider: provider, llm_model: p.models[0]?.id || '' });
    };

    const handleTtsProviderChange = (provider) => {
        const p = findProvider(TTS_PROVIDERS, provider);
        setSettings({ ...settings, voice_provider: provider, voice_name: p.voices[0]?.id || '' });
    };

    const handleSave = async () => {
        const cleaned = { ...settings };
        KEY_FIELDS.forEach((field) => {
            const useOwn = cleaned[field] !== ''; // KeyToggle position
            const typed = (cleaned[field] || '').trim();
            if (!useOwn) {
                // "Use Default" — only actually clear it if there was something saved to clear.
                cleaned[field] = originalOwnKeys.has(field) ? '' : undefined;
            } else if (typed === '') {
                // "My Own Key" selected but nothing (re)typed — leave the existing saved value alone.
                cleaned[field] = undefined;
            } else {
                cleaned[field] = typed;
            }
            if (cleaned[field] === undefined) delete cleaned[field];
        });
        setSaving(true);
        try {
            await onUpdate(cleaned);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

    return (
        <div className="p-3 space-y-5">

            {isDraft && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary">
                    This agent hasn't been created yet — it's saved automatically the moment you
                    hit <strong>Save</strong> below (or Save/Test the workflow itself), using
                    whatever's set here.
                </div>
            )}

            {/* ── AGENT NAME ── */}
            <section className="space-y-2">
                <label className="block text-xs font-medium mb-1">Agent Name</label>
                <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={settings.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Support Assistant"
                />
            </section>

            <hr className="border-border" />

            {/* ── LLM CONFIGURATION ── */}
            <CollapsibleSection title="LLM Configuration" defaultOpen>
                    <div>
                        <label className="block text-xs font-medium mb-1">LLM Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.llm_provider}
                            onChange={(e) => handleProviderChange(e.target.value)}
                        >
                            {LLM_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">Model</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={llmProvider.models.some(m => m.id === settings.llm_model) ? settings.llm_model : '__custom__'}
                            onChange={(e) => e.target.value !== '__custom__' && set('llm_model', e.target.value)}
                        >
                            {llmProvider.models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                            <option value="__custom__">Custom model ID…</option>
                        </select>
                        <input
                            type="text"
                            className="w-full mt-1.5 px-2 py-1.5 text-xs rounded-md border border-input bg-background"
                            value={settings.llm_model}
                            onChange={(e) => set('llm_model', e.target.value)}
                            placeholder="Model ID — editable, paste any value"
                        />
                        {llmProvider.libraryUrl && (
                            <div className="mt-1"><LibraryLink href={llmProvider.libraryUrl}>{llmProvider.libraryLabel}</LibraryLink></div>
                        )}
                    </div>

                    <KeyToggle
                        label={`${llmProvider.label} API Key`}
                        ownKey={settings[llmProvider.keyField]}
                        onChange={(v) => set(llmProvider.keyField, v)}
                        placeholder={KEY_PLACEHOLDER[llmProvider.keyField]}
                        connected={isLlmConnected}
                        sharedKeyNote={llmProvider.sharedKeyNote}
                    />
            </CollapsibleSection>

            <hr className="border-border" />

            {/* ── LANGUAGE ── */}
            <CollapsibleSection title="Language" defaultOpen>
                    <select
                        className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                        value={settings.language}
                        onChange={(e) => set('language', e.target.value)}
                    >
                        {languageGroups.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                                {group.languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                        Applies to any voice provider below. Need a one-off call in a different language? Pass a{' '}
                        <code className="bg-muted px-1 rounded">language</code> dynamic variable when starting that
                        call/test instead of changing this.
                    </p>
            </CollapsibleSection>

            <hr className="border-border" />

            {/* ── VOICE CONFIGURATION ── */}
            <CollapsibleSection title="Voice (Text-to-Speech)" defaultOpen>
                    <div>
                        <label className="block text-xs font-medium mb-1">Voice Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.voice_provider}
                            onChange={(e) => handleTtsProviderChange(e.target.value)}
                        >
                            {TTS_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">{ttsProvider.description}</p>
                    </div>

                    {ttsProvider.voices.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium mb-1">Voice</label>
                            <select
                                className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                value={ttsProvider.voices.some(v => v.id === settings.voice_name) ? settings.voice_name : '__custom__'}
                                onChange={(e) => e.target.value !== '__custom__' && set('voice_name', e.target.value)}
                            >
                                {ttsProvider.voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                <option value="__custom__">Custom / not listed above…</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium mb-1">
                            {ttsProvider.customFieldLabel || 'Custom Voice ID'} (optional)
                        </label>
                        <input
                            type="text"
                            className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
                            value={ttsProvider.id === 'elevenlabs' ? settings.voice_id : settings.voice_name}
                            onChange={(e) =>
                                ttsProvider.id === 'elevenlabs' ? set('voice_id', e.target.value) : set('voice_name', e.target.value)
                            }
                            placeholder={ttsProvider.voices.length === 0 ? 'Paste a voice ID from the library below' : 'Not listed above? Paste ID/name here'}
                        />
                        {ttsProvider.libraryUrl && (
                            <div className="mt-1"><LibraryLink href={ttsProvider.libraryUrl}>{ttsProvider.libraryLabel}</LibraryLink></div>
                        )}
                    </div>

                    <KeyToggle
                        label={`${ttsProvider.label} API Key`}
                        ownKey={settings[ttsProvider.keyField]}
                        onChange={(v) => set(ttsProvider.keyField, v)}
                        placeholder={KEY_PLACEHOLDER[ttsProvider.keyField]}
                        connected={isTtsConnected}
                        sharedKeyNote={ttsProvider.sharedKeyNote}
                    />
            </CollapsibleSection>

            <hr className="border-border" />

            {/* ── TRANSCRIPTION (STT) ── */}
            <CollapsibleSection title="Transcription (Speech-to-Text)" defaultOpen={false}>
                    <div>
                        <label className="block text-xs font-medium mb-1">Transcription Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.stt_provider}
                            onChange={(e) => set('stt_provider', e.target.value)}
                            disabled={settings.voice_provider === 'sarvam'}
                        >
                            {STT_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {settings.voice_provider === 'sarvam'
                                ? 'Ignored while Sarvam is your Voice provider — Sarvam handles both sides.'
                                : sttProvider.description}
                        </p>
                        {settings.voice_provider !== 'sarvam' && sttProvider.libraryUrl && (
                            <div className="mt-1"><LibraryLink href={sttProvider.libraryUrl}>See {sttProvider.label} model options</LibraryLink></div>
                        )}
                    </div>

                    {settings.voice_provider !== 'sarvam' && sttProvider.id !== 'auto' && (
                        <KeyToggle
                            label={`${sttProvider.label} API Key`}
                            ownKey={settings[sttProvider.keyField]}
                            onChange={(v) => set(sttProvider.keyField, v)}
                            placeholder={KEY_PLACEHOLDER[sttProvider.keyField]}
                            connected={isSttConnected}
                            sharedKeyNote={sttProvider.sharedKeyNote}
                        />
                    )}
            </CollapsibleSection>

            <hr className="border-border" />

            {/* ── TELEPHONY ── */}
            <CollapsibleSection title="Calling" defaultOpen={false}>
                    <div>
                        <label className="block text-xs font-medium mb-1">Telephony Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.telephony_provider}
                            onChange={(e) => set('telephony_provider', e.target.value)}
                        >
                            {TELEPHONY_PROVIDERS.map(p => (
                                <option key={p.id} value={p.id}>{p.label}{!p.supported ? ' (coming soon)' : ''}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">{telephonyProvider.description}</p>
                    </div>
                    <a
                        href={`/integrations?open=telephony:${telephonyProvider.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                        <PhoneOutgoing className="w-3 h-3" />
                        Configure {telephonyProvider.label} in Integrations
                    </a>
                    <p className="text-[10px] text-muted-foreground">
                        Numbers &amp; account credentials are entered once, account-wide — every agent using this
                        provider reuses the same connection.
                    </p>
            </CollapsibleSection>

            {/* Save */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-primary-foreground py-2 text-sm rounded-md hover:bg-primary/90 disabled:opacity-60 font-medium flex items-center justify-center gap-1.5"
            >
                {justSaved ? (
                    <>
                        <Check className="w-4 h-4" /> Saved
                    </>
                ) : saving ? (
                    'Saving…'
                ) : isDraft ? (
                    'Create Agent'
                ) : (
                    'Save Settings'
                )}
            </button>
        </div>
    );
};

export default AgentSettingsPanel;
