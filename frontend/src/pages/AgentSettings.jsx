import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, User, Brain, Mic, Settings2, PhoneOutgoing, Loader2 } from 'lucide-react';
import client from '../api/client';
import ConnectionStatus from '../components/ui/ConnectionStatus';
import { LLM_PROVIDERS, TTS_PROVIDERS, STT_PROVIDERS, TELEPHONY_PROVIDERS, findProvider } from '../lib/voiceProviders';

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

const KEY_FIELDS = ['openai_api_key', 'anthropic_api_key', 'gemini_api_key', 'elevenlabs_api_key', 'cartesia_api_key', 'assemblyai_api_key', 'deepgram_api_key', 'sarvam_api_key'];

const EMPTY_FORM = {
    name: '',
    language: 'en-US',

    llm_provider: 'gpt',
    llm_model: 'gpt-4o',
    openai_api_key: '',
    anthropic_api_key: '',
    gemini_api_key: '',

    voice_provider: 'elevenlabs',
    voice_name: 'Rachel',
    voice_id: '',
    elevenlabs_api_key: '',
    cartesia_api_key: '',

    stt_provider: 'whisper',
    assemblyai_api_key: '',
    deepgram_api_key: '',
    sarvam_api_key: '',

    telephony_provider: 'twilio',

    llm_websocket_url: '',
    agent_prompt: '',
    webhook_url: '',
};

const AgentSettings = () => {
    const { agentId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general');
    const [agentName, setAgentName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connectedKeys, setConnectedKeys] = useState(new Set());
    const [languageGroups, setLanguageGroups] = useState([]);
    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        if (agentId) fetchAgent();
        client
            .get('/integrations/')
            .then((res) => setConnectedKeys(new Set(res.data.map((i) => `${i.category}:${i.provider}`))))
            .catch(() => {});
        client
            .get('/agents/languages')
            .then((res) => setLanguageGroups(res.data))
            .catch(() => {});
    }, [agentId]);

    const fetchAgent = async () => {
        setLoading(true);
        try {
            const response = await client.get(`/agents/${agentId}`);
            const agent = response.data;
            setAgentName(agent.name);
            setFormData({
                ...EMPTY_FORM,
                name: agent.name || '',
                language: agent.language || 'en-US',
                voice_provider: agent.voice_provider || 'elevenlabs',
                voice_name: agent.voice_name || 'Rachel',
                voice_id: agent.voice_id || '',
                stt_provider: agent.stt_provider || 'whisper',
                telephony_provider: agent.telephony_provider || 'twilio',
                llm_provider: agent.llm_provider || 'gpt',
                llm_model: agent.llm_model || 'gpt-4o',
                llm_websocket_url: agent.llm_websocket_url || '',
                agent_prompt: agent.agent_prompt || '',
                webhook_url: agent.webhook_url || '',
            });
        } catch (error) {
            console.error('Failed to fetch agent:', error);
        } finally {
            setLoading(false);
        }
    };

    const llmProvider = findProvider(LLM_PROVIDERS, formData.llm_provider);
    const ttsProvider = findProvider(TTS_PROVIDERS, formData.voice_provider);
    const sttProvider = findProvider(STT_PROVIDERS, formData.stt_provider);
    const telephonyProvider = findProvider(TELEPHONY_PROVIDERS, formData.telephony_provider);

    const isLlmConnected = connectedKeys.has(`${llmProvider.catalogCategory}:${llmProvider.catalogId}`);
    const isTtsConnected = connectedKeys.has(`${ttsProvider.catalogCategory}:${ttsProvider.catalogId}`);
    const isSttConnected = connectedKeys.has(`${sttProvider.catalogCategory}:${sttProvider.catalogId}`);
    const isTelephonyConnected = connectedKeys.has(`telephony:${telephonyProvider.catalogId}`);

    const set = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

    const handleLlmProviderChange = (providerId) => {
        const provider = findProvider(LLM_PROVIDERS, providerId);
        set({ llm_provider: providerId, llm_model: provider.models[0].id });
    };

    const handleTtsProviderChange = (providerId) => {
        const provider = findProvider(TTS_PROVIDERS, providerId);
        set({ voice_provider: providerId, voice_name: provider.voices[0]?.id || '' });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = { ...formData };
            // Don't overwrite a saved key with an empty string just because the field was left blank.
            KEY_FIELDS.forEach((field) => {
                if (!payload[field]) delete payload[field];
            });
            await client.patch(`/agents/${agentId}`, payload);
            setAgentName(formData.name);
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/agents')} className="p-2 hover:bg-accent rounded-md transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agent Settings</h1>
                    <p className="text-muted-foreground mt-2">{loading ? 'Loading...' : agentName}</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex">
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
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-1 p-5 min-h-[340px]">
                            {activeTab === 'general' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Name</label>
                                        <input
                                            type="text"
                                            className={inputClass}
                                            value={formData.name}
                                            onChange={(e) => set({ name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Language</label>
                                        <select
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
                                            Applies no matter which voice provider is selected below.
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
                                                value={formData.llm_model}
                                                onChange={(e) => set({ llm_model: e.target.value })}
                                            >
                                                {llmProvider.models.map((model) => (
                                                    <option key={model.id} value={model.id}>
                                                        {model.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <ConnectionStatus connected={isLlmConnected} providerName={llmProvider.label} />

                                    <div>
                                        <label className={labelClass}>{llmProvider.label} API Key</label>
                                        <input
                                            type="password"
                                            className={inputClass}
                                            value={formData[llmProvider.keyField]}
                                            onChange={(e) => set({ [llmProvider.keyField]: e.target.value })}
                                            placeholder="•••••••••••• (leave blank to keep current)"
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>LLM WebSocket URL</label>
                                        <input
                                            type="text"
                                            className={inputClass}
                                            value={formData.llm_websocket_url}
                                            onChange={(e) => set({ llm_websocket_url: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Prompt</label>
                                        <textarea
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
                                            className={inputClass}
                                            value={formData.voice_provider}
                                            onChange={(e) => handleTtsProviderChange(e.target.value)}
                                        >
                                            {TTS_PROVIDERS.map((p) => (
                                                <option key={p.id} value={p.id}>{p.label}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-muted-foreground">{ttsProvider.description}</p>

                                        <ConnectionStatus connected={isTtsConnected} providerName={ttsProvider.label} />

                                        {ttsProvider.voices.length > 0 && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={labelClass}>Voice</label>
                                                    <select
                                                        className={inputClass}
                                                        value={formData.voice_name}
                                                        onChange={(e) => set({ voice_name: e.target.value })}
                                                    >
                                                        {ttsProvider.voices.map((voice) => (
                                                            <option key={voice.id} value={voice.id}>
                                                                {voice.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {ttsProvider.id === 'elevenlabs' && (
                                                    <div>
                                                        <label className={labelClass}>Voice ID (Optional)</label>
                                                        <input
                                                            type="text"
                                                            className={inputClass}
                                                            value={formData.voice_id}
                                                            onChange={(e) => set({ voice_id: e.target.value })}
                                                            placeholder="Custom voice ID"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <label className={labelClass}>{ttsProvider.label} API Key</label>
                                            <input
                                                type="password"
                                                className={inputClass}
                                                value={formData[ttsProvider.keyField]}
                                                onChange={(e) => set({ [ttsProvider.keyField]: e.target.value })}
                                                placeholder="•••••••••••• (leave blank to keep current)"
                                            />
                                        </div>
                                    </div>

                                    <hr className="border-border" />

                                    <div className="space-y-3">
                                        <p className={sectionLabelClass}>Transcription (Speech-to-Text)</p>
                                        <select
                                            className={inputClass}
                                            value={formData.stt_provider}
                                            onChange={(e) => set({ stt_provider: e.target.value })}
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

                                        <ConnectionStatus connected={isSttConnected} providerName={sttProvider.label} />

                                        <div>
                                            <label className={labelClass}>{sttProvider.label} API Key</label>
                                            <input
                                                type="password"
                                                className={inputClass}
                                                value={formData[sttProvider.keyField]}
                                                onChange={(e) => set({ [sttProvider.keyField]: e.target.value })}
                                                placeholder="•••••••••••• (leave blank to keep current)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'calling' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Telephony Provider</label>
                                        <select
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

                                    <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
                                        <p>
                                            Phone numbers and account credentials for {telephonyProvider.label} are managed
                                            once, account-wide, on the{' '}
                                            <a href="/integrations" className="text-primary hover:underline font-medium">
                                                Integrations → Telephony
                                            </a>{' '}
                                            page — including searching for and buying a Twilio number.
                                        </p>
                                        {!telephonyProvider.supported && (
                                            <p className="text-yellow-600 dark:text-yellow-400">
                                                Outbound calling isn't wired up for {telephonyProvider.label} yet — switch
                                                to Twilio or Exotel to actually place calls with this agent.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'advanced' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Post-Call Webhook URL</label>
                                        <input
                                            type="url"
                                            className={inputClass}
                                            value={formData.webhook_url}
                                            onChange={(e) => set({ webhook_url: e.target.value })}
                                            placeholder="https://your-domain.com/webhook"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1.5">
                                            Call transcripts and summaries will be sent here when the call ends.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentSettings;
