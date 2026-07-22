import React, { useState } from 'react';
import { X, Settings, Key, Globe } from 'lucide-react';

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
                    <Globe className="w-2.5 h-2.5" /> Using RMVox platform key
                </p>
            )}
        </div>
    );
};

const AgentSettingsPanel = ({ agent, onUpdate, onClose }) => {
    const [settings, setSettings] = useState({
        llm_provider: agent?.llm_provider || 'gpt',
        llm_model: agent?.llm_model || 'gpt-4o',
        language: agent?.language || 'en',
        voice_provider: agent?.voice_provider || 'elevenlabs',
        voice_name: agent?.voice_name || 'Rachel',
        voice_id: agent?.voice_id || '',
        // API keys — empty string = use platform key, any other value = use own key
        elevenlabs_api_key: agent?.elevenlabs_api_key || '',
        sarvam_api_key: agent?.sarvam_api_key || '',
        sarvam_language: agent?.sarvam_language || 'hi-IN',
        openai_api_key: agent?.openai_api_key || '',
        gemini_api_key: agent?.gemini_api_key || '',
    });

    const llmProviders = [
        { id: 'gpt', name: 'OpenAI GPT' },
        { id: 'gemini', name: 'Google Gemini (Free Tier)' },
        { id: 'claude', name: 'Anthropic Claude' },
    ];

    const llmModels = {
        gpt: [
            { id: 'gpt-4o', name: 'GPT-4o (Latest)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
        gemini: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-pro', name: 'Gemini Pro' },
        ],
        claude: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
        ],
    };

    const elevenLabsVoices = [
        { id: 'Rachel', name: 'Rachel (Female, American)' },
        { id: 'Bella', name: 'Bella (Female, American)' },
        { id: 'Emily', name: 'Emily (Female, American)' },
        { id: 'Grace', name: 'Grace (Female, American Southern)' },
        { id: 'Charlotte', name: 'Charlotte (Female, British)' },
        { id: 'Alice', name: 'Alice (Female, British)' },
        { id: 'Adam', name: 'Adam (Male, American)' },
        { id: 'Antoni', name: 'Antoni (Male, American)' },
        { id: 'Daniel', name: 'Daniel (Male, British)' },
        { id: 'Josh', name: 'Josh (Male, American)' },
        { id: 'Sam', name: 'Sam (Male, American)' },
    ];

    const sarvamVoices = [
        { id: 'meera', name: 'Meera (Female, Hindi)' },
        { id: 'pavithra', name: 'Pavithra (Female, Tamil)' },
        { id: 'maitreyi', name: 'Maitreyi (Female, Hindi)' },
        { id: 'diya', name: 'Diya (Female, Hindi)' },
        { id: 'neel', name: 'Neel (Male, Hindi)' },
        { id: 'vian', name: 'Vian (Male, Hindi)' },
        { id: 'arjun', name: 'Arjun (Male, Hindi)' },
        { id: 'saurabh', name: 'Saurabh (Male, Hindi)' },
    ];

    const sarvamLanguages = [
        { code: 'hi-IN', name: 'Hindi (India)' },
        { code: 'en-IN', name: 'English (India)' },
        { code: 'ta-IN', name: 'Tamil' },
        { code: 'te-IN', name: 'Telugu' },
        { code: 'kn-IN', name: 'Kannada' },
        { code: 'ml-IN', name: 'Malayalam' },
        { code: 'mr-IN', name: 'Marathi' },
        { code: 'gu-IN', name: 'Gujarati' },
        { code: 'bn-IN', name: 'Bengali' },
        { code: 'pa-IN', name: 'Punjabi' },
    ];

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'Hindi' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ar', name: 'Arabic' },
    ];

    const handleProviderChange = (provider) => {
        const defaultModel = llmModels[provider]?.[0]?.id || '';
        setSettings({ ...settings, llm_provider: provider, llm_model: defaultModel });
    };

    const handleSave = () => {
        // Trim whitespace-only keys before saving
        const cleaned = { ...settings };
        ['elevenlabs_api_key', 'sarvam_api_key', 'openai_api_key', 'gemini_api_key'].forEach(k => {
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
                            {llmProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">Model</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.llm_model}
                            onChange={(e) => set('llm_model', e.target.value)}
                        >
                            {(llmModels[settings.llm_provider] || []).map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* LLM API key */}
                    {settings.llm_provider === 'gpt' && (
                        <KeyToggle
                            label="OpenAI API Key"
                            ownKey={settings.openai_api_key}
                            onChange={(v) => set('openai_api_key', v)}
                            placeholder="sk-proj-..."
                        />
                    )}
                    {settings.llm_provider === 'gemini' && (
                        <KeyToggle
                            label="Gemini API Key"
                            ownKey={settings.gemini_api_key}
                            onChange={(v) => set('gemini_api_key', v)}
                            placeholder="AIza..."
                        />
                    )}
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
                        {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                </section>

                <hr className="border-border" />

                {/* ── VOICE CONFIGURATION ── */}
                <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voice Configuration</h4>

                    <div>
                        <label className="block text-xs font-medium mb-1">Voice Provider</label>
                        <select
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={settings.voice_provider}
                            onChange={(e) => set('voice_provider', e.target.value)}
                        >
                            <option value="elevenlabs">ElevenLabs</option>
                            <option value="sarvam">Sarvam AI (Indian Languages)</option>
                            <option value="whisper">OpenAI Whisper (Basic)</option>
                        </select>
                    </div>

                    {/* ElevenLabs config */}
                    {settings.voice_provider === 'elevenlabs' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium mb-1">Voice</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                    value={settings.voice_name}
                                    onChange={(e) => set('voice_name', e.target.value)}
                                >
                                    {elevenLabsVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
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
                            <KeyToggle
                                label="ElevenLabs API Key"
                                ownKey={settings.elevenlabs_api_key}
                                onChange={(v) => set('elevenlabs_api_key', v)}
                                placeholder="sk_..."
                            />
                        </>
                    )}

                    {/* Sarvam config */}
                    {settings.voice_provider === 'sarvam' && (
                        <>
                            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5">
                                <p className="text-[10px] text-yellow-400 font-medium">Sarvam AI — 11 Indian Languages</p>
                                <p className="text-[10px] text-muted-foreground">Bulbul v1 TTS + Saaras v2 STT</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Voice (Speaker)</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                    value={settings.voice_name}
                                    onChange={(e) => set('voice_name', e.target.value)}
                                >
                                    {sarvamVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Speech Language</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                    value={settings.sarvam_language}
                                    onChange={(e) => set('sarvam_language', e.target.value)}
                                >
                                    {sarvamLanguages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                </select>
                            </div>
                            <KeyToggle
                                label="Sarvam AI API Key"
                                ownKey={settings.sarvam_api_key}
                                onChange={(v) => set('sarvam_api_key', v)}
                                placeholder="Your Sarvam API key..."
                            />
                        </>
                    )}

                    {settings.voice_provider === 'whisper' && (
                        <p className="text-[10px] text-muted-foreground">Uses the platform OpenAI key for Whisper STT + TTS.</p>
                    )}
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
