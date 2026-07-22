import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign } from 'lucide-react';
import client from '../api/client';

const Analytics = () => {
    const [stats, setStats] = useState({
        totalCalls: 0,
        totalMinutes: 0,
        avgDuration: 0,
        successRate: 0,
        totalCost: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await client.get('/analytics/summary');
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
        <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{value}</h3>
            <p className="text-sm text-muted-foreground">{title}</p>
            {subtitle && (
                <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
            )}
        </div>
    );

    if (loading) {
        return <div className="p-8 text-center">Loading analytics...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground mt-2">Track your agent's performance and usage</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={BarChart3}
                    title="Total Calls"
                    value={stats.totalCalls}
                    subtitle="All time"
                    color="bg-blue-100 dark:bg-blue-900/20 text-blue-600"
                />
                <StatCard
                    icon={Clock}
                    title="Total Minutes"
                    value={stats.totalMinutes}
                    subtitle={`Avg ${stats.avgDuration}s per call`}
                    color="bg-green-100 dark:bg-green-900/20 text-green-600"
                />
                <StatCard
                    icon={TrendingUp}
                    title="Success Rate"
                    value={`${stats.successRate}%`}
                    subtitle="Completed calls"
                    color="bg-purple-100 dark:bg-purple-900/20 text-purple-600"
                />
                <StatCard
                    icon={DollarSign}
                    title="Total Cost"
                    value={`$${stats.totalCost.toFixed(2)}`}
                    subtitle="API usage"
                    color="bg-orange-100 dark:bg-orange-900/20 text-orange-600"
                />
            </div>

            {/* Charts Placeholder */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Call Volume Over Time</h2>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Chart visualization coming soon...
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Top Performing Agents</h2>
                    <div className="space-y-3">
                        <div className="text-muted-foreground text-center py-8">
                            No data available yet
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                    <div className="space-y-3">
                        <div className="text-muted-foreground text-center py-8">
                            No recent activity
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
