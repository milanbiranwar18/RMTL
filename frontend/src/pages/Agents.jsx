import React, { useEffect, useState } from 'react';
import client from '../api/client';
import AgentForm from '../components/AgentForm';
import CallSimulator from '../components/CallSimulator';
import { Bot, Mic, MessageSquare } from 'lucide-react';

const Agents = () => {
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
                <p className="text-muted-foreground mt-2">Manage your AI agents and simulate calls.</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Left Column: Agent List & Form */}
                <div className="space-y-8">
                    <AgentForm onSuccess={fetchAgents} />

                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-semibold">Your Agents</h2>
                        </div>
                        <div className="divide-y divide-border">
                            {loading ? (
                                <div className="p-6 text-center text-muted-foreground">Loading...</div>
                            ) : agents.length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground">No agents found. Create one to get started.</div>
                            ) : (
                                agents.map((agent) => (
                                    <div key={agent.id} className="p-6 hover:bg-accent/50 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Bot className="w-4 h-4 text-primary" />
                                                    <h3 className="font-medium">{agent.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Mic className="w-3 h-3" />
                                                    <span>{agent.voice_id}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                ID: {agent.id}
                                            </div>
                                        </div>
                                        <div className="mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
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
