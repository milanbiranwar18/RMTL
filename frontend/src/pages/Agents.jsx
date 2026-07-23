import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import AgentForm from '../components/AgentForm';
import CallSimulator from '../components/CallSimulator';
import { Bot, Mic, MessageSquare, Sparkles, Settings } from 'lucide-react';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const LLM_LABELS = { gpt: 'OpenAI GPT', claude: 'Claude', gemini: 'Gemini' };
const VOICE_LABELS = { elevenlabs: 'ElevenLabs', sarvam: 'Sarvam AI', whisper: 'Whisper' };

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
            <PageHeader title="Agents" description="Manage your AI agents and simulate calls." />

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Left Column: Agent List & Form */}
                <div className="space-y-8">
                    <AgentForm onSuccess={fetchAgents} />

                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center justify-between">
                            <h2 className="text-base font-semibold">Your Agents</h2>
                            {!loading && agents.length > 0 && (
                                <span className="text-xs text-muted-foreground">{agents.length} total</span>
                            )}
                        </div>
                        <div className="divide-y divide-border">
                            {loading ? (
                                <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
                            ) : agents.length === 0 ? (
                                <EmptyState
                                    icon={Sparkles}
                                    title="No agents found"
                                    description="Create one above to get started."
                                />
                            ) : (
                                agents.map((agent) => (
                                    <div key={agent.id} className="p-5 hover:bg-accent/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        <Bot className="w-3.5 h-3.5" />
                                                    </span>
                                                    <h3 className="font-medium">{agent.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Badge variant="info" icon={MessageSquare}>
                                                        {LLM_LABELS[agent.llm_provider] || agent.llm_provider}
                                                    </Badge>
                                                    <Badge variant="primary" icon={Mic}>
                                                        {VOICE_LABELS[agent.voice_provider] || agent.voice_provider}
                                                        {agent.voice_name ? ` · ${agent.voice_name}` : ''}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/agents/${agent.id}/settings`)}
                                                title="Agent settings"
                                                className="text-muted-foreground hover:text-foreground hover:bg-accent p-1.5 rounded-md transition-colors shrink-0"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                                            <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase tracking-wider">
                                                <MessageSquare className="w-3 h-3" />
                                                Prompt
                                            </div>
                                            <p className="line-clamp-2">{agent.agent_prompt}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Simulator */}
                <div>
                    <div className="sticky top-8">
                        <CallSimulator agents={agents} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Agents;
