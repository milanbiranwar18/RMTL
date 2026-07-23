import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import client from '../api/client';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const Workflows = () => {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const response = await client.get('/workflows/');
            setWorkflows(response.data);
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const createNewWorkflow = () => {
        navigate('/workflows/new');
    };

    const openWorkflow = (workflowId) => {
        navigate(`/workflows/${workflowId}`);
    };

    return (
        <div className="space-y-8">
            <PageHeader
                title="Workflows"
                description="Manage your conversation flows"
                actions={
                    <button
                        onClick={createNewWorkflow}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        New Workflow
                    </button>
                }
            />

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : workflows.length === 0 ? (
                <div className="bg-card rounded-xl border border-border">
                    <EmptyState
                        icon={WorkflowIcon}
                        title="No workflows yet"
                        description="Create your first workflow to get started"
                        action={
                            <button
                                onClick={createNewWorkflow}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                            >
                                Create Workflow
                            </button>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            onClick={() => openWorkflow(workflow.id)}
                            className="p-6 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-md cursor-pointer transition-all"
                        >
                            <div className="flex items-start justify-between mb-2 gap-2">
                                <h3 className="font-semibold">{workflow.name}</h3>
                                <Badge variant={workflow.is_active ? 'success' : 'neutral'}>
                                    {workflow.is_active ? 'Active' : 'Draft'}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                {workflow.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{workflow.nodes?.length || 0} nodes</span>
                                <span>v{workflow.version}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Workflows;
