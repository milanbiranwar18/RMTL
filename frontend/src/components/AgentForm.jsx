import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Loader2, Bot, User, Brain, Mic, Settings2, AlertTriangle, PhoneOutgoing, ExternalLink } from 'lucide-react';
import KeyToggle from './ui/KeyToggle';
import ConnectionStatus from './ui/ConnectionStatus';
import { LLM_PROVIDERS, TTS_PROVIDERS, STT_PROVIDERS, TELEPHONY_PROVIDERS, findProvider, KEY_PLACEHOLDER } from '../lib/voiceProviders';

const LibraryLink = ({ href, children }) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
    >
        {children}
        <ExternalLink className="w-3 h-3" />
    </a>
);

const inputClass =
    'w-full px-3 py-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring transition-shadow';
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1.5';
const sectionLabelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider';

const TABS = [
    { id: 'general', label: 'General', icon: User },
    { id: 'model', label: 'Model', icon: Brain },
    { id: 'voice', label: 'Voice', icon: Mic },
    { id: 'calling', label: 'Calling', icon: PhoneOutgoing },
    { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

const DEFAULT_FORM = {
    name: '',
    voice_id: '',
    agent_prompt: 'You are a helpful assistant.',
    language: 'en-US',

    llm_provider: 'gpt',
    llm_model: 'gpt-4o',
    openai_api_key: '',
    anthropic_api_key: '',
    gemini_api_key: '',

    voice_provider: 'elevenlabs',
    voice_name: 'Rachel',
    elevenlabs_api_key: '',
    cartesia_api_key: '',

    stt_provider: 'auto',
    assemblyai_api_key: '',
    deepgram_api_key: '',
    sarvam_api_key: '',

    telephony_provider: 'twilio',

    webhook_url: '',
};

const AgentForm = ({ onSuccess }) => {
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [nameError, setNameError] = useState(false);
    const [formData, setFormData] = useState(DEFAULT_FORM);
    const [connectedKeys, setConnectedKeys] = useState(new Set());
    const [languageGroups, setLanguageGroups] = useState([]);

    useEffect(() => {
        client
            .get('/integrations/')
            .then((res) => {
                setConnectedKeys(new Set(res.data.map((i) => `${i.category}:${i.provider}`)));
            })
            .catch(() => {
                /* Integrations vault might not be reachable yet — status just won't show as connected */
            });

        client
            .get('/agents/languages')
            .then((res) => setLanguageGroups(res.data))
            .catch(() => {
                /* Falls back to just the current value with no other options if this fails */
            });
    }, []);

    const llmProvider = findProvider(LLM_PROVIDERS, formData.llm_provider);
    const ttsProvider = findProvider(TTS_PROVIDERS, formData.voice_provider);
    const sttProvider = findProvider(STT_PROVIDERS, formData.stt_provider);
    const telephonyProvider = findProvider(TELEPHONY_PROVIDERS, formData.telephony_provider);

    const isLlmConnected = connectedKeys.has(`${llmProvider.catalogCategory}:${llmProvider.catalogId}`);
    const isTtsConnected = connectedKeys.has(`${ttsProvider.catalogCategory}:${ttsProvider.catalogId}`);
    const isSttConnected = connectedKeys.has(`${sttProvider.catalogCategory}:${sttProvider.catalogId}`);
    const isTelephonyConnected = connectedKeys.has(`telephony:${telephonyProvider.catalogId}`);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setNameError(true);
            setActiveTab('general');
            return;
        }
        setLoading(true);
        try {
            const res = await client.post('/agents/', formData);
            if (onSuccess) onSuccess(res.data);
            setFormData(DEFAULT_FORM);
            setActiveTab('general');
        } catch (error) {
            console.error('Failed to create agent:', error);
            alert('Failed to create agent');
        } finally {
            setLoading(false);
        }
    };

    const handleLlmProviderChange = (providerId) => {
        const provider = findProvider(LLM_PROVIDERS, providerId);
        setFormData((prev) => ({ ...prev, llm_provider: providerId, llm_model: provider.models[0].id }));
    };

    const handleTtsProviderChange = (providerId) => {
        const provider = findProvider(TTS_PROVIDERS, providerId);
        setFormData((prev) => ({ ...prev, voice_provider: providerId, voice_name: provider.voices[0]?.id || '' }));
    };

    const set = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

    return (
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                </span>
                <div>
                    <h2 className="text-base font-semibold leading-tight">Create New Agent</h2>
                    <p className="text-xs text-muted-foreground">Configure a new voice AI agent</p>
                </div>
            </div>

            <div className="flex">
                {/* Tab rail */}
                <div className="w-[160px] shrink-0 border-r border-border p-3 space-y-1">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                {tab.label}
                                {tab.id === 'general' && nameError && (
                                    <AlertTriangle className="w-3 h-3 text-destructive ml-auto" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Active tab content */}
                <div className="flex-1 p-5 min-h-[320px]">
                    {activeTab === 'general' && (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Support Assistant"
                                    className={`${inputClass} ${nameError ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
                                    value={formData.name}
                                    onChange={(e) => {
                                        set({ name: e.target.value });
                                        if (e.target.value.trim()) setNameError(false);
                                    }}
                                />
                                {nameError && <p className="text-xs text-destructive mt-1">Give your agent a name to continue.</p>}
                            </div>

                            <div>
                                <label className={labelClass}>Language</label>
                                <select
                                    required
                                    className={inputClass}
                                    value={formData.language}
                                    onChange={(e) => set({ language: e.target.value })}
                                >
                                    {languageGroups.map((group) => (
                                        <optgroup key={group.group} label={group.group}>
                                            {group.languages.map((lang) => (
                                                <option key={lang.code} value={lang.code}>
                                                    {lang.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    The agent listens for and replies in this language — applies no matter which
                                    voice provider you pick below. Need a one-off call in a different language?
                                    Pass a <code className="bg-muted px-1 rounded">language</code> dynamic variable
                                    when you start that call instead of changing this.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'model' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Provider</label>
                                    <select
                                        required
                                        className={inputClass}
                                        value={formData.llm_provider}
                                        onChange={(e) => handleLlmProviderChange(e.target.value)}
                                    >
                                        {LLM_PROVIDERS.map((p) => (
                                            <option key={p.id} value={p.id}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>Model Version</label>
                                    <select
                                        className={inputClass}
                                        value={llmProvider.models.some((m) => m.id === formData.llm_model) ? formData.llm_model : '__custom__'}
                                        onChange={(e) => e.target.value !== '__custom__' && set({ llm_model: e.target.value })}
                                    >
                                        {llmProvider.models.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                        <option value="__custom__">Custom model ID…</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Model ID (editable — paste any model ID)</label>
                                <input
                                    type="text"
                                    required
                                    className={inputClass}
                                    value={formData.llm_model}
                                    onChange={(e) => set({ llm_model: e.target.value })}
                                    placeholder="e.g. gpt-4o, claude-4-sonnet, gemini-3.0-pro…"
                                />
                                {llmProvider.libraryUrl && (
                                    <div className="mt-1.5">
                                        <LibraryLink href={llmProvider.libraryUrl}>{llmProvider.libraryLabel}</LibraryLink>
                                    </div>
                                )}
                            </div>

                            <KeyToggle
                                label={`${llmProvider.label} API Key`}
                                ownKey={formData[llmProvider.keyField]}
                                onChange={(v) => set({ [llmProvider.keyField]: v })}
                                placeholder={KEY_PLACEHOLDER[llmProvider.keyField]}
                                connected={isLlmConnected}
                                sharedKeyNote={llmProvider.sharedKeyNote}
                            />

                            <div>
                                <label className={labelClass}>Prompt</label>
                                <textarea
                                    required
                                    rows={5}
                                    className={inputClass}
                                    value={formData.agent_prompt}
                                    onChange={(e) => set({ agent_prompt: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'voice' && (
                        <div className="space-y-5">
                            <div className="space-y-3">
                                <p className={sectionLabelClass}>Voice (Text-to-Speech)</p>
                                <select
                                    required
                                    className={inputClass}
                                    value={formData.voice_provider}
                                    onChange={(e) => handleTtsProviderChange(e.target.value)}
                                >
                                    {TTS_PROVIDERS.map((p) => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">{ttsProvider.description}</p>

                                {ttsProvider.voices.length > 0 && (
                                    <div>
                                        <label className={labelClass}>Voice</label>
                                        <select
                                            className={inputClass}
                                            value={ttsProvider.voices.some((v) => v.id === formData.voice_name) ? formData.voice_name : '__custom__'}
                                            onChange={(e) => e.target.value !== '__custom__' && set({ voice_name: e.target.value, voice_id: '' })}
                                        >
                                            {ttsProvider.voices.map((voice) => (
                                                <option key={voice.id} value={voice.id}>
                                                    {voice.name}
                                                </option>
                                            ))}
                                            <option value="__custom__">Custom / not listed above…</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className={labelClass}>
                                        {ttsProvider.customFieldLabel || 'Custom Voice ID'} (Optional — overrides the dropdown)
                                    </label>
                                    <input
                                        type="text"
                                        required={ttsProvider.voices.length === 0}
                                        className={inputClass}
                                        value={ttsProvider.id === 'elevenlabs' ? formData.voice_id : formData.voice_name}
                                        onChange={(e) =>
                                            ttsProvider.id === 'elevenlabs'
                                                ? set({ voice_id: e.target.value })
                                                : set({ voice_name: e.target.value })
                                        }
                                        placeholder={ttsProvider.voices.length === 0 ? 'Paste a voice ID from the library below' : 'Not using one of the voices above? Paste its ID/name here'}
                                    />
                                    {ttsProvider.libraryUrl && (
                                        <div className="mt-1.5">
                                            <LibraryLink href={ttsProvider.libraryUrl}>{ttsProvider.libraryLabel}</LibraryLink>
                                        </div>
                                    )}
                                </div>

                                <KeyToggle
                                    label={`${ttsProvider.label} API Key`}
                                    ownKey={formData[ttsProvider.keyField]}
                                    onChange={(v) => set({ [ttsProvider.keyField]: v })}
                                    placeholder={KEY_PLACEHOLDER[ttsProvider.keyField]}
                                    connected={isTtsConnected}
                                    sharedKeyNote={ttsProvider.sharedKeyNote}
                                />
                            </div>

                            <hr className="border-border" />

                            <div className="space-y-3">
                                <p className={sectionLabelClass}>Transcription (Speech-to-Text)</p>
                                <select
                                    required
                                    className={inputClass}
                                    value={formData.stt_provider}
                                    onChange={(e) => set({ stt_provider: e.target.value })}
                                    disabled={formData.voice_provider === 'sarvam'}
                                >
                                    {STT_PROVIDERS.map((p) => (
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    {formData.voice_provider === 'sarvam'
                                        ? 'Ignored while Sarvam is your Voice provider — Sarvam handles both sides.'
                                        : sttProvider.description}
                                </p>

                                {formData.voice_provider !== 'sarvam' && sttProvider.id !== 'auto' && (
                                    <>
                                        {sttProvider.libraryUrl && (
                                            <LibraryLink href={sttProvider.libraryUrl}>See {sttProvider.label} model options</LibraryLink>
                                        )}
                                        <KeyToggle
                                            label={`${sttProvider.label} API Key`}
                                            ownKey={formData[sttProvider.keyField]}
                                            onChange={(v) => set({ [sttProvider.keyField]: v })}
                                            placeholder={KEY_PLACEHOLDER[sttProvider.keyField]}
                                            connected={isSttConnected}
                                            sharedKeyNote={sttProvider.sharedKeyNote}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'calling' && (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Telephony Provider</label>
                                <select
                                    required
                                    className={inputClass}
                                    value={formData.telephony_provider}
                                    onChange={(e) => set({ telephony_provider: e.target.value })}
                                >
                                    {TELEPHONY_PROVIDERS.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}{!p.supported ? ' (coming soon)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1.5">{telephonyProvider.description}</p>
                            </div>

                            <ConnectionStatus connected={isTelephonyConnected} providerName={telephonyProvider.label} />

                            <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                                <p>
                                    Phone numbers and account credentials for any telephony provider are entered <strong>once,
                                    account-wide</strong> (not per-agent) — every agent that picks {telephonyProvider.label}
                                    reuses the same connected account.
                                </p>
                                <a
                                    href={`/integrations?open=telephony:${telephonyProvider.id}`}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
                                >
                                    <PhoneOutgoing className="w-3 h-3" />
                                    {isTelephonyConnected ? `Manage your ${telephonyProvider.label} setup` : `Configure ${telephonyProvider.label} now`}
                                </a>
                                {!telephonyProvider.supported && (
                                    <p className="text-yellow-600 dark:text-yellow-400">
                                        Outbound calling isn't wired up for {telephonyProvider.label} yet — switch to Twilio
                                        or Exotel to actually place calls with this agent.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'advanced' && (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Post-Call Webhook URL (Optional)</label>
                                <input
                                    type="url"
                                    className={inputClass}
                                    value={formData.webhook_url}
                                    onChange={(e) => set({ webhook_url: e.target.value })}
                                    placeholder="https://your-domain.com/webhook"
                                />
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    Call transcripts and summaries will be POSTed here when a call ends.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-primary-foreground px-5 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Agent
                </button>
            </div>
        </form>
    );
};

export default AgentForm;
