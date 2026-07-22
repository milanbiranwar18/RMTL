import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import client from '../api/client';

const AgentSettings = () => {
    const { agentId } = useParams();
    const navigate = useNavigate();
    const [agent, setAgent] = useState(null);
    const [settings, setSettings] = useState({
        voiceProvider: 'elevenlabs',
        voiceId: '',
        language: 'en-US',
        speed: 1.0,
        pitch: 1.0,
        llmModel: 'gpt-4',
        temperature: 0.7,
        maxTokens: 150,
        webhookUrl: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (agentId) {
            fetchAgent();
        }
    }, [agentId]);

    const fetchAgent = async () => {
        try {
            const response = await client.get(`/agents/${agentId}`);
            setAgent(response.data);
            if (response.data) {
                setSettings({
                    voiceProvider: response.data.voice_provider || 'elevenlabs',
                    voiceId: response.data.voice_id || '',
                    language: response.data.language || 'en-US',
                    speed: 1.0,
                    pitch: 1.0,
                    llmModel: response.data.llm_model || 'gpt-4o',
                    temperature: 0.7,
                    maxTokens: 150,
                    webhookUrl: response.data.webhook_url || '',
                });
            }
        } catch (error) {
            console.error('Failed to fetch agent:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save settings to agent
            await client.patch(`/agents/${agentId}`, {
                voice_provider: settings.voiceProvider,
                voice_id: settings.voiceId,
                language: settings.language,
                llm_model: settings.llmModel,
                webhook_url: settings.webhookUrl,
            });
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/agents')}
                    className="p-2 hover:bg-accent rounded-md"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agent Settings</h1>
                    <p className="text-muted-foreground mt-2">
                        {agent?.name || 'Loading...'}
                    </p>
                </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6 space-y-6">
                {/* Voice Settings */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Voice & Language</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Voice Provider</label>
                            <select
                                value={settings.voiceProvider}
                                onChange={(e) => setSettings({ ...settings, voiceProvider: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="elevenlabs">ElevenLabs</option>
                                <option value="sarvam">Sarvam AI (Saaras / Bulbul)</option>
                                <option value="deepgram">Deepgram</option>
                                <option value="google">Google TTS</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Voice ID</label>
                            <input
                                type="text"
                                value={settings.voiceId}
                                onChange={(e) => setSettings({ ...settings, voiceId: e.target.value })}
                                placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Language</label>
                            <select
                                value={settings.language}
                                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="en-US">English (US)</option>
                                <option value="en-GB">English (UK)</option>
                                <option value="es-ES">Spanish</option>
                                <option value="fr-FR">French</option>
                                <option value="de-DE">German</option>
                                <option value="it-IT">Italian</option>
                                <option value="pt-BR">Portuguese (Brazil)</option>
                                <option value="hi-IN">Hindi</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Speed: {settings.speed}x</label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={settings.speed}
                                onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Pitch: {settings.pitch}x</label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={settings.pitch}
                                onChange={(e) => setSettings({ ...settings, pitch: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                {/* LLM Settings */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">LLM Configuration</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Model</label>
                            <select
                                value={settings.llmModel}
                                onChange={(e) => setSettings({ ...settings, llmModel: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="gpt-4">GPT-4</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                <option value="claude-3-opus">Claude 3 Opus</option>
                                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Temperature: {settings.temperature}</label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={settings.temperature}
                                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Lower = more focused, Higher = more creative
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Max Tokens</label>
                            <input
                                type="number"
                                value={settings.maxTokens}
                                onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                {/* Integration Settings */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">Integrations</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Post-Call Webhook URL</label>
                            <input
                                type="url"
                                value={settings.webhookUrl}
                                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                                placeholder="https://your-domain.com/webhook"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Call transcripts and summaries will be sent here when the call ends.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentSettings;
