import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { Bot, Mic, MessageSquare, Sparkles, Settings, Plus, PhoneOutgoing } from 'lucide-react';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const LLM_LABELS = { gpt: 'OpenAI GPT', claude: 'Claude', gemini: 'Gemini', sarvam: 'Sarvam AI' };
const VOICE_LABELS = { elevenlabs: 'ElevenLabs', sarvam: 'Sarvam AI', cartesia: 'Cartesia', deepgram_aura: 'Deepgram', openai_tts: 'OpenAI TTS' };

// A clean grid of every agent you own — creating one now lives on its own page (/agents/new)
// instead of an always-open form crammed onto this list, and testing a call lives on each
// agent's own Settings page instead of a shared simulator here (test call belongs to ONE agent,
// not to "the agents list" as a whole).
const Agents = () => {
    const navigate = useNavigate();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAgents = async () => {
        try {
            const response = await client.get('/agents/');
            setAgents(response.data);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    return (
        <div className="space-y-8">
            <PageHeader
                title="Agents"
                description="Your voice AI agents — configure providers, calling and language for each."
                actions={
                    <button
                        onClick={() => navigate('/agents/new')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        New Agent
                    </button>
                }
            />

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : agents.length === 0 ? (
                <div className="bg-card rounded-xl border border-border">
                    <EmptyState
                        icon={Sparkles}
                        title="No agents yet"
                        description="Create your first voice AI agent to get started."
                        action={
                            <button
                                onClick={() => navigate('/agents/new')}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                            >
                                Create Agent
                            </button>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => (
                        <div
                            key={agent.id}
                            onClick={() => navigate(`/agents/${agent.id}/settings`)}
                            className="bg-card rounded-xl border border-border p-5 hover:border-primary/50 hover:shadow-md cursor-pointer transition-all flex flex-col gap-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4" />
                                    </span>
                                    <h3 className="font-semibold truncate">{agent.name}</h3>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/agents/${agent.id}/settings`); }}
                                    title="Agent settings"
                                    className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors shrink-0"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="info" icon={MessageSquare}>
                                    {LLM_LABELS[agent.llm_provider] || agent.llm_provider}
                                </Badge>
                                <Badge variant="primary" icon={Mic}>
                                    {VOICE_LABELS[agent.voice_provider] || agent.voice_provider}
                                </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{agent.agent_prompt}</p>

                            <Link
                                to={`/workflows/new?agentId=${agent.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                                <PhoneOutgoing className="w-3 h-3" />
                                Build conversation flow
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Agents;
