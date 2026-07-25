import React, { useState } from 'react';
import client from '../api/client';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';
import DynamicVariablesEditor from './DynamicVariablesEditor';

// A trimmed-down CallSimulator scoped to ONE already-known agent (used on that agent's own
// Settings page) — no "Select Agent" dropdown needed since you're already looking at it.
const AgentTestCall = ({ agentId, agentName }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [dynamicVariables, setDynamicVariables] = useState({});
    const [activeCall, setActiveCall] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const startCall = async () => {
        if (!phoneNumber) return;
        setLoading(true);
        setError('');
        try {
            const cleanVars = Object.fromEntries(
                Object.entries(dynamicVariables).filter(([k, v]) => k.trim() && String(v).trim())
            );
            const response = await client.post('/calls/', {
                agent_id: agentId,
                user_phone: phoneNumber,
                dynamic_variables: Object.keys(cleanVars).length ? cleanVars : null,
            });
            setActiveCall(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to start call');
        } finally {
            setLoading(false);
        }
    };

    const endCall = () => setActiveCall(null);

    return (
        <div className="bg-card p-6 rounded-xl border border-border h-fit">
            <div className="flex items-center gap-2 mb-5">
                <span className="w-9 h-9 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <Phone className="w-4 h-4" />
                </span>
                <div>
                    <h2 className="text-base font-semibold leading-tight">Test Call</h2>
                    <p className="text-xs text-muted-foreground">Place a live outbound call from {agentName || 'this agent'}</p>
                </div>
            </div>

            {!activeCall ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+1234567890"
                            className="w-full p-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                    </div>

                    <DynamicVariablesEditor variables={dynamicVariables} onChange={setDynamicVariables} />

                    {error && <p className="text-xs text-destructive">{error}</p>}

                    <button
                        onClick={startCall}
                        disabled={loading || !phoneNumber}
                        className="w-full bg-green-600 text-white py-2.5 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                        Start Call
                    </button>
                    <p className="text-xs text-muted-foreground">
                        Uses whichever telephony provider is configured in this agent's Calling tab.
                    </p>
                </div>
            ) : (
                <div className="text-center space-y-6 py-4">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Phone className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Call in Progress</h3>
                        <p className="text-muted-foreground text-sm">Connected to {phoneNumber}</p>
                    </div>
                    <button
                        onClick={endCall}
                        className="w-full bg-red-600 text-white py-2.5 rounded-md hover:bg-red-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        <PhoneOff className="w-4 h-4" />
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default AgentTestCall;
