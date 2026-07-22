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
        <div className="bg-card p-6 rounded-lg border border-border h-fit">
            <h2 className="text-xl font-semibold mb-4">Call Simulator</h2>

            {!activeCall ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Select Agent</label>
                        <select
                            className="w-full p-2 rounded-md border border-input bg-background"
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
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+1234567890"
                            className="w-full p-2 rounded-md border border-input bg-background"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={startCall}
                        disabled={loading || !selectedAgent || !phoneNumber}
                        className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                        Start Call
                    </button>
                </div>
            ) : (
                <div className="text-center space-y-6 py-8">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Phone className="w-12 h-12 text-green-600" />
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold">Call in Progress</h3>
                        <p className="text-muted-foreground">Connected to {phoneNumber}</p>
                    </div>

                    <div className="p-4 bg-muted rounded-md text-left text-sm font-mono h-32 overflow-y-auto">
                        <p className="text-muted-foreground italic">Listening...</p>
                    </div>

                    <button
                        onClick={endCall}
                        className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
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
