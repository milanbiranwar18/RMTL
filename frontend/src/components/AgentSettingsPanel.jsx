import React, { useState, useEffect } from 'react';
import { X, Settings, Globe } from 'lucide-react';
import client from '../api/client';
import { LLM_PROVIDERS, TTS_PROVIDERS, STT_PROVIDERS, TELEPHONY_PROVIDERS, findProvider } from '../lib/voiceProviders';

// Reusable "Platform Key vs Own Key" toggle
const KeyToggle = ({ label, ownKey, onChange, placeholder }) => {
    const useOwn = ownKey !== '';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <div className="flex rounded-md overflow-hidden border border-border text-xs">
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className={`px-2 py-0.5 transition-colors ${!useOwn ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        Platform Key
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange(' ')}
                        className={`px-2 py-0.5 transition-colors border-l border-border ${useOwn ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        My Own Key
                    </button>
                </div>
            </div>
            {useOwn && (
                <input
                    type="password"
                    className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
                    value={ownKey.trim()}
                    onChange={(e) => onChange(e.target.value || ' ')}
                    placeholder={placeholder}
                    autoComplete="off"
                />
            )}
            {!useOwn && (
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" /> Using saved Integrations key
                </p>
            )}
        </div>
    );
};

const KEY_PLACEHOLDER = {
    openai_api_key: 'sk-proj-...',
    anthropic_api_key: 'sk-ant-...',
    gemini_api_key: 'AIza...',
    elevenlabs_api_key: 'sk_...',
    cartesia_api_key: 'Your Cartesia API key...',
    assemblyai_api_key: 'Your AssemblyAI API key...',
    deepgram_api_key: 'Your Deepgram API key...',
    sarvam_api_key: 'Your Sarvam API key...',
};

const AgentSettingsPanel = ({ agent, onUpdate, onClose }) => {
    const [settings, setSettings] = useState({
        llm_provider: agent?.llm_provider || 'gpt',
        llm_model: agent?.llm_model || 'gpt-4o',
        language: agent?.language || 'en-US',
        voice_provider: agent?.voice_provider || 'elevenlabs',
        voice_name: agent?.voice_name || 'Rachel',
        voice_id: agent?.voice_id || '',
        stt_provider: agent?.stt_provider || 'whisper',
        telephony_provider: agent?.telephony_provider || 'twilio',
        // API keys — empty string = use saved Integrations key, any other value = use own key
        elevenlabs_api_key: agent?.elevenlabs_api_key || '',
        sarvam_api_key: agent?.sarvam_api_key || '',
        openai_api_key: agent?.openai_api_key || '',
        gemini_api_key: agent?.gemini_api_key || '',
        anthropic_api_key: agent?.anthropic_api_key || '',
        cartesia_api_key: agent?.cartesia_api_key || '',
        assemblyai_api_key: agent?.assemblyai_api_key || '',
        deepgram_api_key: agent?.deepgram_api_key || '',
    });
    const [languageGroups, setLanguageGroups] = useState([]);

    useEffect(() => {
        client
            .get('/agents/languages')
            .then((res) => setLanguageGroups(res.data))
            .catch(() => {});
    }, []);

    const llmProvider = findProvider(LLM_PROVIDERS, settings.llm_provider);
    const ttsProvider = findProvider(TTS_PROVIDERS, settings.voice_provider);
    const sttProvider = findProvider(STT_PROVIDERS, settings.stt_provider);
    const telephonyProvider = findProvider(TELEPHONY_PROVIDERS, settings.telephony_provider);

    const handleProviderChange = (provider) => {
        const p = findProvider(LLM_PROVIDERS, provider);
        setSettings({ ...settings, llm_provider: provider, llm_model: p.models[0]?.id || '' });
    };

    const handleTtsProviderChange = (provider) => {
        const p = findProvider(TTS_PROVIDERS, provider);
        setSettings({ ...settings, voice_provider: provider, voice_name: p.voices[0]?.id || '' });
    };

    const handleSave = () => {
        // Trim whitespace-only "own key selected but empty" sentinels before saving
        const cleaned = { ...settings };
        ['elevenlabs_api_key', 'sarvam_api_key', 'openai_api_key', 'gemini_api_key', 'anthropic_api_key', 'cartesia_api_key', 'assemblyai_api_key', 'deepgram_api_key'].forEach(k => {
            if (cleaned[k]?.trim() === '') cleaned[k] = '';
        });
        onUpdate(cleaned);
        onClose();
    };

    const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

    return (
        <div className="absolute top-0 right-0 w-80 h-full bg-card border-l border-border overflow-y-auto z-20 shadow-xl">
            <div className="sticky top-0 bg-card border-b border-border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <h3 className="text-sm font-semibold">Agent Settings</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-accent rounded">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-3 space-y-5">

                {/* ── LLM CONFIGURATION ── */}
                <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LLM Configuration</h4>

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
                            value={settings.llm_model}
                            onChange={(e) => set('llm_model', e.target.value)}
                        >
                            {llmProvider.models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <KeyToggle
                        label={`${llmProvider.label} API Key`}
                        ownKey={settings[llmProvider.keyField]}
                        onChange={(v) => set(llmProvider.keyField, v)}
                        placeholder={KEY_PLACEHOLDER[llmProvider.keyField]}
                    />
                </section>

                <hr className="border-border" />

                {/* ── LANGUAGE ── */}
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language</h4>
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
                    <p className="text-[10px] text-muted-foreground">Applies to any voice provider below.</p>
                </section>

                <hr className="border-border" />

                {/* ── VOICE CONFIGURATION ── */}
                <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voice (Text-to-Speech)</h4>

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
                        <>
                            <div>
                                <label className="block text-xs font-medium mb-1">Voice</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                    value={settings.voice_name}
                                    onChange={(e) => set('voice_name', e.target.value)}
                                >
                                    {ttsProvider.voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            {ttsProvider.id === 'elevenlabs' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1">Custom Voice ID (optional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background"
                                        value={settings.voice_id}
                                        onChange={(e) => set('voice_id', e.target.value)}
                                        placeholder="Leave empty to use selected voice"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <KeyToggle
                        label={`${ttsProvider.label} API Key`}
                        ownKey={settings[ttsProvider.keyField]}
                        onChange={(v) => set(ttsProvider.keyField, v)}
                        placeholder={KEY_PLACEHOLDER[ttsProvider.keyField]}
                    />
                </section>

                <hr className="border-border" />

                {/* ── TRANSCRIPTION (STT) ── */}
                <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transcription (Speech-to-Text)</h4>

                    <div>
                        <label className="block text-xs font-medium mb-1">Transcription Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.stt_provider}
                            onChange={(e) => set('stt_provider', e.target.value)}
                        >
                            {STT_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {settings.voice_provider === 'sarvam'
                                ? 'Ignored while Sarvam is your Voice provider — Sarvam handles both sides.'
                                : sttProvider.description}
                        </p>
                    </div>

                    <KeyToggle
                        label={`${sttProvider.label} API Key`}
                        ownKey={settings[sttProvider.keyField]}
                        onChange={(v) => set(sttProvider.keyField, v)}
                        placeholder={KEY_PLACEHOLDER[sttProvider.keyField]}
                    />
                </section>

                <hr className="border-border" />

                {/* ── TELEPHONY ── */}
                <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calling</h4>
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
                    <p className="text-[10px] text-muted-foreground">
                        Numbers &amp; account credentials are managed once on the Integrations → Telephony page.
                    </p>
                </section>

                {/* Save */}
                <button
                    onClick={handleSave}
                    className="w-full bg-primary text-primary-foreground py-2 text-sm rounded-md hover:bg-primary/90 font-medium"
                >
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default AgentSettingsPanel;
