import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    BackgroundVariant,
    getIncomers,
    getOutgoers,
    getConnectedEdges,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, MessageSquare, Zap, GitBranch, PhoneOff, PlayCircle, ArrowLeft, Trash2, Copy, XCircle, Settings, Home } from 'lucide-react';
import client from '../api/client';
import BeginNode from '../components/nodes/BeginNode';
import DialogueNode from '../components/nodes/DialogueNode';
import ActionNode from '../components/nodes/ActionNode';
import ConditionNode from '../components/nodes/ConditionNode';
import NodePropertiesPanel from '../components/NodePropertiesPanel';
import TestingPanel from '../components/TestingPanel';
import AgentSettingsPanel from '../components/AgentSettingsPanel';
import CustomEdge from '../components/CustomEdge';
import NodeActionsContext from '../context/NodeActionsContext';

const nodeTypes = {
    begin: BeginNode,
    dialogue: DialogueNode,
    action: ActionNode,
    condition: ConditionNode,
};

const edgeTypes = {
    custom: CustomEdge,
};

const initialNodes = [
    {
        id: 'start-1',
        type: 'begin',
        data: { label: 'Start' },
        position: { x: 250, y: 50 },
        deletable: false,
    },
];

const initialEdges = [];

const WorkflowBuilder = () => {
    const { workflowId } = useParams();
    const navigate = useNavigate();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [workflowName, setWorkflowName] = useState('New Workflow');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agents, setAgents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [showTesting, setShowTesting] = useState(false);
    const [showAgentSettings, setShowAgentSettings] = useState(false);
    const [currentWorkflowId, setCurrentWorkflowId] = useState(workflowId);
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [currentAgent, setCurrentAgent] = useState(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const reactFlowWrapper = useRef(null);

    useEffect(() => {
        fetchAgents();
        if (workflowId) {
            loadWorkflow(workflowId);
        }
    }, [workflowId]);

    useEffect(() => {
        // Update nodes to highlight active node
        if (activeNodeId) {
            setNodes((nds) =>
                nds.map((node) => {
                    const isActive = node.id === activeNodeId;
                    return {
                        ...node,
                        style: {
                            ...node.style,
                            // Only apply styles if active, otherwise revert to default (or undefined to remove)
                            boxShadow: isActive ? '0 0 30px 8px rgba(59, 130, 246, 0.9)' : undefined,
                            border: isActive ? '3px solid rgb(59, 130, 246)' : undefined,
                            // Removed transform and zIndex to prevent layout issues
                        },
                    };
                })
            );
        } else {
            // Clear all highlights
            setNodes((nds) =>
                nds.map((node) => ({
                    ...node,
                    style: {
                        ...node.style,
                        boxShadow: undefined,
                        border: undefined,
                    },
                }))
            );
        }
    }, [activeNodeId, setNodes]);

    // Define handlers before they're used
    const handleDuplicateFromMenu = useCallback((nodeId) => {
        setNodes((nds) => {
            const nodeToDuplicate = nds.find(n => n.id === nodeId);
            if (!nodeToDuplicate) return nds;

            // Deselect all existing nodes
            const updatedNodes = nds.map(n => ({ ...n, selected: false }));

            const newNode = {
                ...nodeToDuplicate,
                id: `node-${Date.now()}`,
                position: {
                    x: nodeToDuplicate.position.x + 50,
                    y: nodeToDuplicate.position.y + 50,
                },
                selected: true, // Select the new node
            };
            return [...updatedNodes, newNode];
        });
    }, [setNodes]);

    const handleDeleteFromMenu = useCallback((nodeId) => {
        setNodes((nds) => {
            const nodeToDelete = nds.find(n => n.id === nodeId);
            if (nodeToDelete?.type === 'begin') {
                alert('Cannot delete the BEGIN node');
                return nds;
            }
            return nds.filter((n) => n.id !== nodeId);
        });
    }, [setNodes]);



    const handleNodeExecute = (nodeId) => {
        setActiveNodeId(nodeId);
        console.log('Active Node:', nodeId, 'Total Nodes:', nodes.length);

        // Auto-scroll to the active node using fitView
        if (reactFlowInstance && nodeId) {
            reactFlowInstance.fitView({
                nodes: [{ id: nodeId }],
                padding: 0.5, // Keep some context
                duration: 800,
                maxZoom: 1.2
            });
        }
    };

    const handleCloseTestPanel = () => {
        setShowTesting(false);
        setActiveNodeId(null); // Clear active node highlighting

        // Force React Flow to re-render and fit view
        setTimeout(() => {
            if (reactFlowInstance) {
                // Reset zoom and center all nodes
                reactFlowInstance.fitView({
                    padding: 0.2,
                    duration: 400,
                    maxZoom: 1.5
                });
            }
        }, 150);
    };

    const handleDeleteEdge = useCallback((edgeId) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    }, [setEdges]);

    const fetchAgents = async () => {
        try {
            const response = await client.get('/agents/');
            setAgents(response.data);
            if (response.data.length > 0 && !selectedAgent) {
                setSelectedAgent(response.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        }
    };

    const loadWorkflow = async (id) => {
        try {
            const response = await client.get(`/workflows/${id}`);
            const workflow = response.data;

            setWorkflowName(workflow.name);
            setSelectedAgent(workflow.agent_id);

            // Load agent details
            if (workflow.agent_id) {
                loadAgent(workflow.agent_id);
            }

            // Ensure nodes and edges are arrays
            const loadedNodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
            const loadedEdges = Array.isArray(workflow.edges) ? workflow.edges : [];

            if (loadedNodes.length === 0) {
                setNodes(initialNodes);
            } else {
                setNodes(loadedNodes);
            }

            // Inject onDelete handler into loaded edges
            const edgesWithHandlers = loadedEdges.map(edge => ({
                ...edge,
                data: { ...edge.data, onDelete: handleDeleteEdge }
            }));

            setEdges(edgesWithHandlers);
            setCurrentWorkflowId(workflow.id);
        } catch (error) {
            console.error('Failed to load workflow:', error);
            alert('Failed to load workflow');
        }
    };

    const loadAgent = async (agentId) => {
        try {
            const response = await client.get(`/agents/${agentId}`);
            setCurrentAgent(response.data);
        } catch (error) {
            console.error('Failed to load agent:', error);
        }
    };

    const updateAgentSettings = async (settings) => {
        if (!selectedAgent) {
            alert('Please select an agent first');
            return;
        }

        try {
            await client.put(`/agents/${selectedAgent}`, settings);
            setCurrentAgent({ ...currentAgent, ...settings });
            alert('Agent settings updated successfully!');
        } catch (error) {
            console.error('Failed to update agent:', error);
            alert('Failed to update agent settings');
        }
    };

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({
            ...params,
            type: 'custom',
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { onDelete: handleDeleteEdge }
        }, eds)),
        [setEdges]
    );



    const onNodesDelete = useCallback(
        (deleted) => {
            // Prevent deleting the BEGIN node
            const nonBeginNodes = deleted.filter(node => node.type !== 'begin');
            if (nonBeginNodes.length !== deleted.length) {
                alert('Cannot delete the BEGIN node');
            }
            return nonBeginNodes;
        },
        []
    );

    const onNodeClick = useCallback((event, node) => {
        setSelectedEdge(null); // Deselect edge when node is clicked
        if (node.type !== 'begin') {
            setSelectedNode(node);
        } else {
            setSelectedNode(null);
        }
    }, []);

    const onEdgeClick = useCallback((event, edge) => {
        setSelectedNode(null); // Deselect node when edge is clicked
        setSelectedEdge(edge);
    }, []);

    const updateNodeData = (nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId ? { ...node, data: newData } : node
            )
        );
    };

    const addNode = (type, label) => {
        const newNode = {
            id: `node-${Date.now()}`,
            type: type,
            data: {
                label: label,
            },
            position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
            deletable: true,
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const duplicateNode = () => {
        if (!selectedNode) return;

        const newNode = {
            ...selectedNode,
            id: `node-${Date.now()}`,
            position: {
                x: selectedNode.position.x + 50,
                y: selectedNode.position.y + 50,
            },
            selected: true,
            data: {
                ...selectedNode.data,
            }
        };

        setNodes((nds) => {
            // Deselect all existing nodes
            const updatedNodes = nds.map(n => ({ ...n, selected: false }));
            return [...updatedNodes, newNode];
        });
        setSelectedNode(newNode);
    };

    const deleteNode = () => {
        if (!selectedNode) return;
        if (selectedNode.type === 'begin') {
            alert('Cannot delete the BEGIN node');
            return;
        }

        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setSelectedNode(null);
    };

    const deleteEdge = () => {
        if (!selectedEdge) return;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
        setSelectedEdge(null);
    };

    const saveWorkflow = async () => {
        if (!selectedAgent) {
            alert('Please select an agent');
            return;
        }

        setSaving(true);
        try {
            const workflowData = {
                name: workflowName,
                agent_id: selectedAgent,
                nodes: nodes,
                edges: edges,
            };

            let response;
            if (currentWorkflowId) {
                // Update existing workflow
                response = await client.put(`/workflows/${currentWorkflowId}`, workflowData);
            } else {
                // Create new workflow
                response = await client.post('/workflows/', workflowData);
                setCurrentWorkflowId(response.data.id);
                navigate(`/workflows/${response.data.id}`, { replace: true });
            }

            alert('Workflow saved successfully!');
        } catch (error) {
            console.error('Failed to save workflow:', error);
            alert('Failed to save workflow');
        } finally {
            setSaving(false);
        }
    };

    // Context values
    const nodeActions = {
        onDuplicate: handleDuplicateFromMenu,
        onDelete: handleDeleteFromMenu,
        onEdit: (nodeId) => {
            const node = nodes.find(n => n.id === nodeId);
            if (node) setSelectedNode(node);
        }
    };

    return (
        <NodeActionsContext.Provider value={nodeActions}>
            <div className="h-full flex" ref={reactFlowWrapper}>
                {/* Node Palette Sidebar - slim icon strip with labels */}
                <div className="w-[72px] shrink-0 bg-card border-r border-border flex flex-col items-center pt-3 pb-3 gap-2 overflow-y-auto">

                    {/* Home Button */}
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full flex flex-col items-center gap-0.5 py-2 rounded-md hover:bg-accent transition-colors group"
                    >
                        <Home className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-[9px] text-muted-foreground group-hover:text-foreground leading-tight">Home</span>
                    </button>

                    <div className="w-10 border-t border-border my-0.5" />

                    {/* Dialogue */}
                    <button
                        type="button"
                        onClick={() => addNode('dialogue', 'New Dialogue')}
                        className="w-full flex flex-col items-center gap-0.5 py-2 rounded-md border border-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-[9px] text-primary leading-tight">Dialogue</span>
                    </button>

                    {/* Action */}
                    <button
                        type="button"
                        onClick={() => addNode('action', 'New Action')}
                        className="w-full flex flex-col items-center gap-0.5 py-2 rounded-md border border-green-500 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                    >
                        <Zap className="w-4 h-4 text-green-500" />
                        <span className="text-[9px] text-green-500 leading-tight">Action</span>
                    </button>

                    {/* Condition */}
                    <button
                        type="button"
                        onClick={() => addNode('condition', 'New Condition')}
                        className="w-full flex flex-col items-center gap-0.5 py-2 rounded-md border border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
                    >
                        <GitBranch className="w-4 h-4 text-yellow-500" />
                        <span className="text-[9px] text-yellow-500 leading-tight">Condition</span>
                    </button>

                    {/* End Call */}
                    <button
                        type="button"
                        onClick={() => addNode('dialogue', 'End Call')}
                        className="w-full flex flex-col items-center gap-0.5 py-2 rounded-md border border-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                        <PhoneOff className="w-4 h-4 text-red-500" />
                        <span className="text-[9px] text-red-500 leading-tight">End</span>
                    </button>

                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col">
                    {/* Toolbar */}
                    <div className="bg-card border-b border-border p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="px-3 py-2 rounded-md border border-input bg-background text-lg font-semibold"
                            />
                            <select
                                value={selectedAgent || ''}
                                onChange={(e) => setSelectedAgent(parseInt(e.target.value))}
                                className="px-3 py-2 rounded-md border border-input bg-background"
                            >
                                <option value="">Select Agent</option>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAgentSettings(!showAgentSettings)}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
                            >
                                <Settings className="w-4 h-4" />
                                Agent Settings
                            </button>
                            <button
                                type="button"
                                onClick={saveWorkflow}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    // Auto-save before testing if not saved
                                    if (!currentWorkflowId) {
                                        await saveWorkflow();
                                        setTimeout(() => setShowTesting(true), 500);
                                    } else {
                                        setShowTesting(true);
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                                <Play className="w-4 h-4" />
                                Test
                            </button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 relative">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            onEdgeClick={onEdgeClick}
                            onNodesDelete={onNodesDelete}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            onInit={setReactFlowInstance}
                        >
                            <Controls />
                            <MiniMap />
                            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                        </ReactFlow>

                        {selectedNode && (
                            <NodePropertiesPanel
                                key={selectedNode.id}
                                selectedNode={selectedNode}
                                onUpdate={updateNodeData}
                                onClose={() => setSelectedNode(null)}
                            />
                        )}
                    </div>
                </div>

                {showTesting && (
                    <TestingPanel
                        workflow={{ nodes, edges }}
                        workflowId={currentWorkflowId}
                        onClose={handleCloseTestPanel}
                        onNodeExecute={handleNodeExecute}
                    />
                )}

                {showAgentSettings && currentAgent && (
                    <AgentSettingsPanel
                        agent={currentAgent}
                        onUpdate={updateAgentSettings}
                        onClose={() => setShowAgentSettings(false)}
                    />
                )}
            </div>
        </NodeActionsContext.Provider>
    );
};

export default WorkflowBuilder;

