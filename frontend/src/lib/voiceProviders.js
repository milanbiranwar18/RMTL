// Single source of truth for the LLM / TTS / STT / Telephony provider options shown across
// AgentForm.jsx, pages/AgentSettings.jsx and components/AgentSettingsPanel.jsx, so the three
// agent-editing surfaces never drift out of sync with each other (they used to).
//
// `keyField` is the Agent field the per-provider API key is stored in (matches
// backend/app/models/agent.py + schemas/agent.py). `catalogId` maps to the Integrations
// provider catalog id (GET /integrations/catalog) so ConnectionStatus can tell the user
// whether they already have a key saved there.

export const LLM_PROVIDERS = [
    {
        id: 'gpt',
        label: 'OpenAI GPT',
        catalogId: 'openai',
        catalogCategory: 'llm',
        keyField: 'openai_api_key',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o (Latest)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
    },
    {
        id: 'claude',
        label: 'Anthropic Claude',
        catalogId: 'anthropic',
        catalogCategory: 'llm',
        keyField: 'anthropic_api_key',
        models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
        ],
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        catalogId: 'gemini',
        catalogCategory: 'llm',
        keyField: 'gemini_api_key',
        models: [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-pro', name: 'Gemini Pro' },
        ],
    },
    {
        id: 'sarvam',
        label: 'Sarvam AI (Indic LLM)',
        catalogId: 'sarvam',
        catalogCategory: 'llm',
        keyField: 'sarvam_api_key',
        models: [
            { id: 'sarvam-30b', name: 'Sarvam 30B' },
            { id: 'sarvam-105b', name: 'Sarvam 105B' },
        ],
    },
];

export const TTS_PROVIDERS = [
    {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        catalogId: 'elevenlabs',
        catalogCategory: 'tts',
        keyField: 'elevenlabs_api_key',
        description: 'Most natural voices, ~75-150ms latency.',
        voices: [
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
        ],
    },
    {
        id: 'sarvam',
        label: 'Sarvam AI (Bulbul)',
        catalogId: 'sarvam',
        catalogCategory: 'tts',
        keyField: 'sarvam_api_key',
        description: 'Most natural voices across 11 Indian languages — speaks whichever language is set in General.',
        voices: [
            { id: 'meera', name: 'Meera (Female, Hindi)' },
            { id: 'pavithra', name: 'Pavithra (Female, Tamil)' },
            { id: 'maitreyi', name: 'Maitreyi (Female, Hindi)' },
            { id: 'diya', name: 'Diya (Female, Hindi)' },
            { id: 'neel', name: 'Neel (Male, Hindi)' },
            { id: 'arjun', name: 'Arjun (Male, Hindi)' },
        ],
    },
    {
        id: 'cartesia',
        label: 'Cartesia (Sonic)',
        catalogId: 'cartesia',
        catalogCategory: 'tts',
        keyField: 'cartesia_api_key',
        description: 'Lowest-latency TTS in the market (40-90ms).',
        voices: [],
    },
    {
        id: 'deepgram_aura',
        label: 'Deepgram Aura',
        catalogId: 'deepgram_aura',
        catalogCategory: 'tts',
        keyField: 'deepgram_api_key',
        description: 'Good pick if you already use Deepgram for transcription (single vendor).',
        voices: [],
    },
    {
        id: 'openai_tts',
        label: 'OpenAI TTS',
        catalogId: 'openai_tts',
        catalogCategory: 'tts',
        keyField: 'openai_api_key',
        description: 'Cheapest, simplest fallback voice.',
        voices: [],
    },
];

export const STT_PROVIDERS = [
    {
        id: 'whisper',
        label: 'OpenAI Whisper',
        catalogId: 'whisper',
        catalogCategory: 'stt',
        keyField: 'openai_api_key',
        description: 'Simple, cheap, batch-only — good universal fallback.',
    },
    {
        id: 'deepgram',
        label: 'Deepgram (Nova-3)',
        catalogId: 'deepgram',
        catalogCategory: 'stt',
        keyField: 'deepgram_api_key',
        description: 'Sub-300ms streaming transcription accuracy leader.',
    },
    {
        id: 'assemblyai',
        label: 'AssemblyAI',
        catalogId: 'assemblyai',
        catalogCategory: 'stt',
        keyField: 'assemblyai_api_key',
        description: 'Best accuracy + speaker diarization / PII redaction.',
    },
    {
        id: 'sarvam',
        label: 'Sarvam AI (Saaras)',
        catalogId: 'sarvam',
        catalogCategory: 'stt',
        keyField: 'sarvam_api_key',
        description: 'Best accuracy for Indian languages/accents.',
    },
];

export const TELEPHONY_PROVIDERS = [
    { id: 'twilio', label: 'Twilio', catalogId: 'twilio', supported: true, description: 'Best docs, global reach. Fully wired — supports buying a number below.' },
    { id: 'exotel', label: 'Exotel', catalogId: 'exotel', supported: true, description: 'Required for India-compliant PSTN calling. Needs a one-time Voicebot Flow set up in your Exotel dashboard.' },
    { id: 'telnyx', label: 'Telnyx', catalogId: 'telnyx', supported: false, description: 'Save your key in Integrations now — outbound calling support is coming soon.' },
    { id: 'plivo', label: 'Plivo', catalogId: 'plivo', supported: false, description: 'Save your key in Integrations now — outbound calling support is coming soon.' },
    { id: 'vonage', label: 'Vonage', catalogId: 'vonage', supported: false, description: 'Save your key in Integrations now — outbound calling support is coming soon.' },
];

export function findProvider(list, id) {
    return list.find((p) => p.id === id) || list[0];
}
