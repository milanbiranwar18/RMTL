import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

const CallSimulator = ({ agents }) => {
    const [selectedAgent, setSelectedAgent] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [activeCall, setActiveCall] = useState(null);
    const [loading, setLoading] = useState(false);

    const startCall = async () => {
        if (!selectedAgent || !phoneNumber) return;
        setLoading(true);
        try {
            const response = await client.post('/calls/', {
                agent_id: parseInt(selectedAgent),
                user_phone: phoneNumber,
            });
            setActiveCall(response.data);
        } catch (error) {
            console.error('Failed to start call:', error);
            alert('Failed to start call');
        } finally {
            setLoading(false);
        }
    };

    const endCall = () => {
        setActiveCall(null);
        // In a real app, we would send a request to end the call
    };

    return (
        <div className="bg-card p-6 rounded-xl border border-border h-fit">
            <div className="flex items-center gap-2 mb-5">
                <span className="w-9 h-9 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <Phone className="w-4 h-4" />
                </span>
                <div>
                    <h2 className="text-base font-semibold leading-tight">Call Simulator</h2>
                    <p className="text-xs text-muted-foreground">Test an agent with a live outbound call</p>
                </div>
            </div>

            {!activeCall ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Select Agent</label>
                        <select
                            className="w-full p-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                        >
                            <option value="">Select an agent...</option>
                            {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>

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

                    <button
                        onClick={startCall}
                        disabled={loading || !selectedAgent || !phoneNumber}
                        className="w-full bg-green-600 text-white py-2.5 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                        Start Call
                    </button>
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

                    <div className="p-4 bg-muted rounded-md text-left text-sm font-mono h-32 overflow-y-auto">
                        <p className="text-muted-foreground italic">Listening...</p>
                    </div>

                    <button
                        onClick={endCall}
                        className="w-full bg-red-600 text-white py-2.5 rounded-md hover:bg-red-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                        <PhoneOff className="w-4 h-4" />
                        End Call
                    </button>
                </div>
            )}
        </div>
    );
};

export default CallSimulator;
