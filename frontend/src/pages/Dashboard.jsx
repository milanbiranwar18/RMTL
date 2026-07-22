import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Phone, Users, Activity } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalAgents: 0,
        totalCalls: 0,
        activeCalls: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [agentsRes, callsRes] = await Promise.all([
                    client.get('/agents/'),
                    client.get('/calls/')
                ]);

                setStats({
                    totalAgents: agentsRes.data.length,
                    totalCalls: callsRes.data.length,
                    activeCalls: callsRes.data.filter(c => c.status === 'active').length,
                });
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        };

        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Overview of your Retell AI Replica.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    title="Total Agents"
                    value={stats.totalAgents}
                    icon={Users}
                    color="text-blue-500"
                />
                <StatCard
                    title="Total Calls"
                    value={stats.totalCalls}
                    icon={Phone}
                    color="text-green-500"
                />
                <StatCard
                    title="Active Calls"
                    value={stats.activeCalls}
                    icon={Activity}
                    color="text-orange-500"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 bg-card p-6 rounded-lg border border-border">
                    <h3 className="font-semibold mb-4">Recent Activity</h3>
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed border-muted rounded-md">
                        Chart Placeholder
                    </div>
                </div>
                <div className="col-span-3 bg-card p-6 rounded-lg border border-border">
                    <h3 className="font-semibold mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                        <button 
                            onClick={() => window.location.href='/agents'}
                            className="w-full text-left px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm">
                            + Create New Agent
                        </button>
                        <button 
                            onClick={() => window.location.href='/calls'}
                            className="w-full text-left px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm">
                            → View All Calls
                        </button>
                        <button 
                            onClick={async () => {
                                const phone = prompt("Enter phone number to test (e.g. +1234567890):");
                                if (phone) {
                                    try {
                                        await client.post('/calls/', { 
                                            user_phone: phone, 
                                            agent_id: stats.totalAgents > 0 ? 1 : null 
                                        });
                                        alert("Test call initiated! Please wait for the ring.");
                                        window.location.reload();
                                    } catch (e) {
                                        alert("Failed to initiate test call. Check backend logs and Twilio config.");
                                    }
                                }
                            }}
                            className="w-full text-left px-4 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium">
                            📞 Initiate Test Outbound Call
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
