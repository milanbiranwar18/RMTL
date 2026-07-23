import React, { useEffect, useState, useMemo } from 'react';
import client from '../api/client';
import { Phone, Clock, CheckCircle, XCircle, Loader, Search, PhoneCall } from 'lucide-react';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

const STATUS_FILTERS = ['all', 'active', 'completed', 'failed', 'ringing'];

const STATUS_CONFIG = {
    completed: { icon: CheckCircle, variant: 'success' },
    failed: { icon: XCircle, variant: 'danger' },
    active: { icon: Loader, variant: 'info', spin: true },
    ringing: { icon: Clock, variant: 'warning' },
};

const CallHistory = () => {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchCalls();
    }, []);

    const fetchCalls = async () => {
        try {
            const response = await client.get('/calls/');
            setCalls(response.data);
        } catch (error) {
            console.error('Failed to fetch calls:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCalls = useMemo(() => {
        return calls.filter((call) => {
            const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
            const matchesSearch =
                !search || (call.user_phone || '').toLowerCase().includes(search.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [calls, search, statusFilter]);

    const getStatusBadge = (status) => {
        const config = STATUS_CONFIG[status] || { icon: Clock, variant: 'neutral' };
        const Icon = config.icon;
        return (
            <Badge variant={config.variant}>
                <Icon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} />
                <span className="capitalize">{status}</span>
            </Badge>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
                <p className="text-muted-foreground mt-2">View all your call records.</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by phone number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    {STATUS_FILTERS.map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                                statusFilter === status
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Phone Number
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Agent ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Start Time
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-muted-foreground">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredCalls.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <EmptyState
                                            icon={PhoneCall}
                                            title={calls.length === 0 ? 'No calls found' : 'No matching calls'}
                                            description={
                                                calls.length === 0
                                                    ? 'Start a call from the Agents page to see it here.'
                                                    : 'Try adjusting your search or status filter.'
                                            }
                                        />
                                    </td>
                                </tr>
                            ) : (
                                filteredCalls.map((call) => (
                                    <tr key={call.id} className="hover:bg-accent/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            #{call.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                {call.user_phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            Agent #{call.agent_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {getStatusBadge(call.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {formatDate(call.start_time)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CallHistory;
