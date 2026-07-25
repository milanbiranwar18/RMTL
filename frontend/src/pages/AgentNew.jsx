import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AgentForm from '../components/AgentForm';

// A dedicated full page for creating an agent (previously an always-open inline form crammed
// onto the Agents list page). Redirects straight into the new agent's own Settings page once
// created, since that's where the rest of its setup (voice, calling, testing) lives.
const AgentNew = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/agents')} className="p-2 hover:bg-accent rounded-md transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Agent</h1>
                    <p className="text-muted-foreground mt-2">Configure a new voice AI agent</p>
                </div>
            </div>

            <AgentForm onSuccess={(agent) => navigate(agent?.id ? `/agents/${agent.id}/settings` : '/agents')} />
        </div>
    );
};

export default AgentNew;
