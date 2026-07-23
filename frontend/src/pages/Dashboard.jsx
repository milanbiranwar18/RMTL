import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { Phone, Users, Activity, PhoneOutgoing, ArrowRight, Plus, BarChart2 } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildLastSevenDays(calls) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        days.push(d);
    }
    return days.map((day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = calls.filter((c) => {
            const t = new Date(c.start_time);
            return t >= day && t < next;
        }).length;
        return { label: DAY_LABELS[day.getDay()], calls: count };
    });
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalAgents: 0, totalCalls: 0, activeCalls: 0 });
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [agentsRes, callsRes] = await Promise.all([
                    client.get('/agents/'),
                    client.get('/calls/'),
                ]);

                setStats({
                    totalAgents: agentsRes.data.length,
                    totalCalls: callsRes.data.length,
                    activeCalls: callsRes.data.filter((c) => c.status === 'active').length,
                });
                setChartData(buildLastSevenDays(callsRes.data));
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const handleTestCall = async () => {
        const phone = prompt('Enter phone number to test (e.g. +1234567890):');
        if (!phone) return;
        try {
            await client.post('/calls/', { user_phone: phone, agent_id: stats.totalAgents > 0 ? 1 : null });
            alert('Test call initiated! Please wait for the ring.');
            window.location.reload();
        } catch (e) {
            alert('Failed to initiate test call. Check backend logs and telephony integration.');
        }
    };

    const hasCallData = chartData.some((d) => d.calls > 0);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Overview of your voice AI platform.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    icon={Users}
                    label="Total Agents"
                    value={loading ? '—' : stats.totalAgents}
                    hint="Configured voice agents"
                    iconClassName="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    icon={Phone}
                    label="Total Calls"
                    value={loading ? '—' : stats.totalCalls}
                    hint="All time"
                    iconClassName="bg-green-500/10 text-green-500"
                />
                <StatCard
                    icon={Activity}
                    label="Active Calls"
                    value={loading ? '—' : stats.activeCalls}
                    hint="In progress right now"
                    iconClassName="bg-orange-500/10 text-orange-500"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 bg-card p-6 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Call Volume — Last 7 Days</h3>
                        <BarChart2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {hasCallData ? (
                        <div className="h-[220px] -ml-2 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        fontSize={12}
                                        width={28}
                                        stroke="hsl(var(--muted-foreground))"
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="calls"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        fill="url(#callsGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Activity}
                            title="No calls yet this week"
                            description="Once you start placing or receiving calls, your volume trend will show up here."
                        />
                    )}
                </div>

                <div className="col-span-3 bg-card p-6 rounded-xl border border-border">
                    <h3 className="font-semibold mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                        <button
                            onClick={() => navigate('/agents')}
                            className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors text-sm border border-border"
                        >
                            <span className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                <Plus className="w-4 h-4" />
                            </span>
                            <span className="font-medium">Create New Agent</span>
                        </button>
                        <button
                            onClick={() => navigate('/calls')}
                            className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors text-sm border border-border"
                        >
                            <span className="w-8 h-8 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                <ArrowRight className="w-4 h-4" />
                            </span>
                            <span className="font-medium">View All Calls</span>
                        </button>
                        <button
                            onClick={handleTestCall}
                            className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-sm border border-primary/20"
                        >
                            <span className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <PhoneOutgoing className="w-4 h-4" />
                            </span>
                            <span className="font-medium text-primary">Initiate Test Outbound Call</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
