import React, { useState } from 'react';
import client from '../api/client';
import { Loader2 } from 'lucide-react';

const AgentForm = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        voice_id: '',
        llm_websocket_url: 'wss://api.openai.com/v1/realtime',
        agent_prompt: 'You are a helpful assistant.',
        language: 'en',
        voice_provider: 'elevenlabs',
        elevenlabs_api_key: '',
        llm_provider: 'gpt',
        llm_model: 'gpt-4o',
        voice_name: 'Rachel',
        webhook_url: '',
    });

    const llmModels = {
        gpt: [
            { id: 'gpt-4o', name: 'GPT-4o (Latest)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
        claude: [
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
        ],
        gemini: [
            { id: 'gemini-pro', name: 'Gemini Pro' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        ],
    };

    const elevenLabsVoices = [
        { id: 'Rachel', name: 'Rachel (Female, American)' },
        { id: 'Domi', name: 'Domi (Female, American)' },
        { id: 'Bella', name: 'Bella (Female, American)' },
        { id: 'Emily', name: 'Emily (Female, American)' },
        { id: 'Grace', name: 'Grace (Female, American Southern)' },
        { id: 'Adam', name: 'Adam (Male, American)' },
        { id: 'Antoni', name: 'Antoni (Male, American)' },
        { id: 'Josh', name: 'Josh (Male, American)' },
        { id: 'Daniel', name: 'Daniel (Male, British)' },
        { id: 'Charlie', name: 'Charlie (Male, Australian)' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await client.post('/agents/', formData);
            if (onSuccess) onSuccess();
            setFormData({
                name: '',
                voice_id: '',
                llm_websocket_url: 'wss://api.openai.com/v1/realtime',
                agent_prompt: 'You are a helpful assistant.',
                language: 'en',
                voice_provider: 'elevenlabs',
                elevenlabs_api_key: '',
                llm_provider: 'gpt',
                llm_model: 'gpt-4o',
                voice_name: 'Rachel',
                webhook_url: '',
            });
        } catch (error) {
            console.error('Failed to create agent:', error);
            alert('Failed to create agent');
        } finally {
            setLoading(false);
        }
    };

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'hi', name: 'Hindi' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ar', name: 'Arabic' },
        { code: 'ru', name: 'Russian' },
    ];

    const handleProviderChange = (provider) => {
        const defaultModel = llmModels[provider][0].id;
        setFormData({ ...formData, llm_provider: provider, llm_model: defaultModel });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 bg-card p-4 rounded-lg border border-border">
            <h2 className="text-lg font-semibold mb-3">Create New Agent</h2>

            <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                    type="text"
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">Language</label>
                <select
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                >
                    {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">LLM Provider</label>
                <select
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.llm_provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                >
                    <option value="gpt">OpenAI GPT</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="gemini">Google Gemini</option>
                </select>
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">Model Version</label>
                <select
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.llm_model}
                    onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
                >
                    {llmModels[formData.llm_provider].map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">Voice Provider</label>
                <select
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.voice_provider}
                    onChange={(e) => setFormData({ ...formData, voice_provider: e.target.value })}
                >
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="sarvam">Sarvam AI (Saaras / Bulbul)</option>
                    <option value="whisper">OpenAI Whisper</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                    {formData.voice_provider === 'whisper'
                        ? 'Uses OPENAI_API_KEY from environment'
                        : 'Requires ElevenLabs API key below'}
                </p>
            </div>

            {formData.voice_provider === 'elevenlabs' && (
                <>
                    <div>
                        <label className="block text-xs font-medium mb-1">Voice</label>
                        <select
                            required
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={formData.voice_name}
                            onChange={(e) => setFormData({ ...formData, voice_name: e.target.value })}
                        >
                            {elevenLabsVoices.map((voice) => (
                                <option key={voice.id} value={voice.id}>
                                    {voice.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">Voice ID (Optional)</label>
                        <input
                            type="text"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={formData.voice_id}
                            onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                            placeholder="Custom voice ID"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">ElevenLabs API Key (Optional)</label>
                        <input
                            type="password"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                            value={formData.elevenlabs_api_key}
                            onChange={(e) => setFormData({ ...formData, elevenlabs_api_key: e.target.value })}
                            placeholder="Optional: Leave empty to use ELEVENLABS_API_KEY from env"
                        />
                    </div>
                </>
            )}

            <div>
                <label className="block text-xs font-medium mb-1">LLM WebSocket URL</label>
                <input
                    type="text"
                    required
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.llm_websocket_url}
                    onChange={(e) => setFormData({ ...formData, llm_websocket_url: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">Post-Call Webhook URL (Optional)</label>
                <input
                    type="url"
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="https://your-domain.com/webhook"
                />
            </div>

            <div>
                <label className="block text-xs font-medium mb-1">Prompt</label>
                <textarea
                    required
                    rows={4}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                    value={formData.agent_prompt}
                    onChange={(e) => setFormData({ ...formData, agent_prompt: e.target.value })}
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Agent
            </button>
        </form>
    );
};

export default AgentForm;


