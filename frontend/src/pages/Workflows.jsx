import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import client from '../api/client';

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
                    <p className="text-muted-foreground mt-2">Manage your conversation flows</p>
                </div>
                <button
                    onClick={createNewWorkflow}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    <Plus className="w-4 h-4" />
                    New Workflow
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : workflows.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border border-border">
                    <WorkflowIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first workflow to get started</p>
                    <button
                        onClick={createNewWorkflow}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        Create Workflow
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            onClick={() => openWorkflow(workflow.id)}
                            className="p-6 bg-card rounded-lg border border-border hover:border-primary cursor-pointer transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold">{workflow.name}</h3>
                                <span className={`px-2 py-1 text-xs rounded ${workflow.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {workflow.is_active ? 'Active' : 'Draft'}
                                </span>
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
