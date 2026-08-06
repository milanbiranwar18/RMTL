import React, { useEffect, useState, useMemo } from 'react';
import client from '../api/client';
import { Phone, Clock, CheckCircle, XCircle, Loader, Search, PhoneCall, ChevronDown, ChevronRight, MessageSquare, BarChart3, Timer, X } from 'lucide-react';
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
    const [selectedCall, setSelectedCall] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

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

    const formatDuration = (seconds) => {
        if (!seconds) return '—';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const getSentimentColor = (sentiment) => {
        const colors = {
            positive: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
            negative: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
            neutral: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
        };
        return colors[sentiment] || colors.neutral;
    };

    const viewCallDetails = async (callId) => {
        try {
            // Fetch fresh call details to get the latest analytics
            const response = await client.get(`/calls/${callId}`);
            setSelectedCall(response.data);
            setShowDetails(true);
        } catch (error) {
            console.error('Failed to fetch call details:', error);
        }
    };

    const closeDetails = () => {
        setShowDetails(false);
        setSelectedCall(null);
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
                                    <tr
                                        key={call.id}
                                        onClick={() => viewCallDetails(call.id)}
                                        className="hover:bg-accent/50 transition-colors cursor-pointer"
                                    >
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

            {/* Call Details Modal */}
            {showDetails && selectedCall && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={closeDetails}
                >
                    <div
                        className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div>
                                <h2 className="text-xl font-semibold">Call #{selectedCall.id}</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedCall.user_phone} • Agent #{selectedCall.agent_id}
                                </p>
                            </div>
                            <button
                                onClick={closeDetails}
                                className="p-2 rounded-md hover:bg-accent transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-accent/50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                        <Timer className="w-4 h-4" />
                                        <span>Duration</span>
                                    </div>
                                    <p className="text-2xl font-semibold">
                                        {formatDuration(selectedCall.duration_seconds)}
                                    </p>
                                </div>
                                <div className="bg-accent/50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                        <BarChart3 className="w-4 h-4" />
                                        <span>Sentiment</span>
                                    </div>
                                    {selectedCall.sentiment ? (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${getSentimentColor(selectedCall.sentiment)}`}>
                                            {selectedCall.sentiment}
                                        </span>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">Not analyzed yet</p>
                                    )}
                                </div>
                                <div className="bg-accent/50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                        <Clock className="w-4 h-4" />
                                        <span>Status</span>
                                    </div>
                                    <div className="mt-1">{getStatusBadge(selectedCall.status)}</div>
                                </div>
                            </div>

                            {/* Summary */}
                            {selectedCall.summary && (
                                <div className="bg-accent/30 rounded-lg p-5 border border-border/50">
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        AI Summary
                                    </h3>
                                    <p className="text-sm leading-relaxed">{selectedCall.summary}</p>
                                </div>
                            )}

                            {/* Transcript */}
                            {selectedCall.transcript && (
                                <div>
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                                        Full Transcript
                                    </h3>
                                    <div className="bg-accent/30 rounded-lg p-5 border border-border/50 space-y-3 max-h-96 overflow-y-auto">
                                        {selectedCall.transcript.split('\n').map((line, idx) => {
                                            const [speaker, ...textParts] = line.split(':');
                                            const text = textParts.join(':').trim();
                                            if (!text) return null;
                                            const isUser = speaker.includes('User');
                                            return (
                                                <div key={idx} className={`flex gap-3 ${isUser ? '' : 'flex-row-reverse text-right'}`}>
                                                    <div className={`flex-1 rounded-lg px-4 py-2 ${isUser ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
                                                        <p className="font-medium text-xs text-muted-foreground mb-1">
                                                            {speaker}
                                                        </p>
                                                        <p className="text-sm">{text}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* No Analytics Yet */}
                            {!selectedCall.summary && !selectedCall.transcript && (
                                <div className="text-center py-12">
                                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">
                                        {selectedCall.status === 'completed'
                                            ? 'Analytics are being generated. Please refresh in a moment.'
                                            : 'Analytics will be available after the call completes.'}
                                    </p>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                                <div>
                                    <p className="text-xs text-muted-foreground">Start Time</p>
                                    <p className="text-sm font-medium">{formatDate(selectedCall.start_time)}</p>
                                </div>
                                {selectedCall.end_time && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">End Time</p>
                                        <p className="text-sm font-medium">{formatDate(selectedCall.end_time)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CallHistory;
