import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, PhoneCall, Bot, Activity } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import client from '../api/client';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';

function groupCallsByDay(calls, days = 14) {
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        buckets.push(d);
    }
    return buckets.map((day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = calls.filter((c) => {
            const t = new Date(c.start_time);
            return t >= day && t < next;
        }).length;
        return {
            label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            calls: count,
        };
    });
}

const STATUS_VARIANT = {
    completed: 'success',
    active: 'info',
    failed: 'danger',
};

const Analytics = () => {
    const [calls, setCalls] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const [callsRes, agentsRes] = await Promise.all([
                client.get('/calls/'),
                client.get('/agents/'),
            ]);
            setCalls(callsRes.data);
            setAgents(agentsRes.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const totalCalls = calls.length;
        const durations = calls
            .filter((c) => c.end_time && c.start_time)
            .map((c) => (new Date(c.end_time) - new Date(c.start_time)) / 1000);
        const totalSeconds = durations.reduce((a, b) => a + b, 0);
        const avgDuration = durations.length ? Math.round(totalSeconds / durations.length) : 0;
        const completed = calls.filter((c) => c.status === 'completed').length;
        const successRate = totalCalls ? Math.round((completed / totalCalls) * 100) : 0;
        return {
            totalCalls,
            totalMinutes: Math.round(totalSeconds / 60),
            avgDuration,
            successRate,
        };
    }, [calls]);

    const chartData = useMemo(() => groupCallsByDay(calls), [calls]);
    const hasCallData = chartData.some((d) => d.calls > 0);

    const topAgents = useMemo(() => {
        const counts = {};
        calls.forEach((c) => {
            counts[c.agent_id] = (counts[c.agent_id] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([agentId, count]) => ({
                agent: agents.find((a) => a.id === Number(agentId)),
                agentId,
                count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [calls, agents]);

    const recentCalls = useMemo(
        () =>
            [...calls]
                .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                .slice(0, 5),
        [calls]
    );

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground mt-2">Track your agent's performance and usage</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={BarChart3}
                    label="Total Calls"
                    value={stats.totalCalls}
                    hint="All time"
                    iconClassName="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                    icon={Clock}
                    label="Total Minutes"
                    value={stats.totalMinutes}
                    hint={`Avg ${stats.avgDuration}s per call`}
                    iconClassName="bg-green-500/10 text-green-500"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Success Rate"
                    value={`${stats.successRate}%`}
                    hint="Completed calls"
                    iconClassName="bg-purple-500/10 text-purple-500"
                />
                <StatCard
                    icon={Bot}
                    label="Active Agents"
                    value={agents.length}
                    hint="Configured voice agents"
                    iconClassName="bg-orange-500/10 text-orange-500"
                />
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-1">Call Volume — Last 14 Days</h2>
                <p className="text-sm text-muted-foreground mb-4">Number of calls placed or received each day.</p>
                {hasCallData ? (
                    <div className="h-64 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
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
                                    interval={1}
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
                                    fill="url(#analyticsGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <EmptyState
                        icon={Activity}
                        title="No call activity yet"
                        description="Place a call from the Agents page to start seeing your volume trend."
                    />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Top Performing Agents</h2>
                    {topAgents.length === 0 ? (
                        <EmptyState icon={Bot} title="No agent activity yet" className="py-8" />
                    ) : (
                        <div className="space-y-1">
                            {topAgents.map(({ agent, agentId, count }) => (
                                <div
                                    key={agentId}
                                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                                            <Bot className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="text-sm font-medium">
                                            {agent ? agent.name : `Agent #${agentId}`}
                                        </span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">{count} calls</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                    {recentCalls.length === 0 ? (
                        <EmptyState icon={PhoneCall} title="No recent activity" className="py-8" />
                    ) : (
                        <div className="space-y-1">
                            {recentCalls.map((call) => (
                                <div
                                    key={call.id}
                                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-7 h-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                                            <PhoneCall className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="text-sm font-medium">{call.user_phone}</span>
                                    </div>
                                    <Badge variant={STATUS_VARIANT[call.status] || 'neutral'}>
                                        {call.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
