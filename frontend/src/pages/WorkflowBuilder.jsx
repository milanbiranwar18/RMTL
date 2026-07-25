import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import {
    Save, Play, MessageSquare, Zap, GitBranch, PhoneOff, Home,
    PhoneForwarded, Hash, GitFork, Users, MessageCircle, Variable, Code2, StickyNote, Webhook, PlugZap, Bot, Search,
} from 'lucide-react';
import client from '../api/client';
import BeginNode from '../components/nodes/BeginNode';
import DialogueNode from '../components/nodes/DialogueNode';
import ActionNode from '../components/nodes/ActionNode';
import ConditionNode from '../components/nodes/ConditionNode';
import LogicSplitNode from '../components/nodes/LogicSplitNode';
import NoteNode from '../components/nodes/NoteNode';
import {
    CallTransferNode, PressDigitNode, AgentTransferNode, InCallSmsNode, ExtractVariableNode, CodeNode, EndingNode,
    CustomFunctionNode, McpToolCallNode,
} from '../components/nodes/ExtraNodes';
import TestingPanel from '../components/TestingPanel';
import FlowAssistantPanel from '../components/FlowAssistantPanel';
import SettingsDock from '../components/SettingsDock';
import CustomEdge from '../components/CustomEdge';
import NodeActionsContext from '../context/NodeActionsContext';
import ThemeToggle from '../components/ThemeToggle';

const nodeTypes = {
    begin: BeginNode,
    dialogue: DialogueNode,
    action: ActionNode,
    condition: ConditionNode,
    call_transfer: CallTransferNode,
    press_digit: PressDigitNode,
    logic_split: LogicSplitNode,
    agent_transfer: AgentTransferNode,
    in_call_sms: InCallSmsNode,
    extract_variable: ExtractVariableNode,
    code: CodeNode,
    custom_function: CustomFunctionNode,
    mcp_tool_call: McpToolCallNode,
    ending: EndingNode,
    note: NoteNode,
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

// Sensible defaults for the agent this workflow will end up attached to, used the moment
// someone starts building a flow with no agent selected yet — mirrors AgentBase's own backend
// defaults (schemas/agent.py) so a lazily-created agent behaves identically to one made via the
// dedicated /agents/new form.
const DRAFT_AGENT_DEFAULTS = {
    llm_provider: 'gpt',
    llm_model: 'gpt-4o',
    language: 'en-US',
    voice_provider: 'elevenlabs',
    voice_name: 'Rachel',
    stt_provider: 'auto',
    telephony_provider: 'twilio',
    agent_prompt: 'You are a helpful assistant.',
};

const NODE_LIBRARY = [
    { type: 'dialogue', label: 'Conversation', icon: MessageSquare, color: 'text-sky-400', hover: 'hover:border-sky-500/60' },
    { type: 'action', label: 'Action', icon: Zap, color: 'text-emerald-400', hover: 'hover:border-emerald-500/60' },
    { type: 'condition', label: 'Condition', icon: GitBranch, color: 'text-amber-400', hover: 'hover:border-amber-500/60' },
    { type: 'call_transfer', label: 'Call Transfer', icon: PhoneForwarded, color: 'text-blue-400', hover: 'hover:border-blue-500/60' },
    { type: 'press_digit', label: 'Press Digit', icon: Hash, color: 'text-purple-400', hover: 'hover:border-purple-500/60' },
    { type: 'logic_split', label: 'Logic Split', icon: GitFork, color: 'text-orange-400', hover: 'hover:border-orange-500/60' },
    { type: 'agent_transfer', label: 'Agent Transfer', icon: Users, color: 'text-indigo-400', hover: 'hover:border-indigo-500/60' },
    { type: 'in_call_sms', label: 'In-Call SMS', icon: MessageCircle, color: 'text-teal-400', hover: 'hover:border-teal-500/60' },
    { type: 'extract_variable', label: 'Extract Variable', icon: Variable, color: 'text-cyan-400', hover: 'hover:border-cyan-500/60' },
    { type: 'code', label: 'Code', icon: Code2, color: 'text-slate-400', hover: 'hover:border-slate-500/60' },
    { type: 'custom_function', label: 'Function', icon: Webhook, color: 'text-pink-400', hover: 'hover:border-pink-500/60' },
    { type: 'mcp_tool_call', label: 'MCP Tool', icon: PlugZap, color: 'text-violet-400', hover: 'hover:border-violet-500/60' },
    { type: 'ending', label: 'Ending', icon: PhoneOff, color: 'text-rose-400', hover: 'hover:border-rose-500/60' },
    { type: 'note', label: 'Note', icon: StickyNote, color: 'text-yellow-400', hover: 'hover:border-yellow-500/60' },
];

const WorkflowBuilder = () => {
    const { workflowId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Deep-linked here from an agent's card/settings page as `?agentId=123` (see pages/Agents.jsx)
    // pre-selects that agent — but it's just a head start, not a requirement: you can also land
    // here with nothing selected and design the flow first, configuring LLM/Voice/Calling via the
    // always-available "Agent Settings" panel whenever you're ready (an agent is created for you
    // automatically, using that panel's settings, the first time you Save or Test — see ensureAgent
    // below). This matches how conversation-flow builders work elsewhere: the flow is the primary
    // creative surface, the agent record is just where its voice/model/calling config lives.
    const preselectedAgentId = searchParams.get('agentId') ? parseInt(searchParams.get('agentId'), 10) : null;
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [workflowName, setWorkflowName] = useState('New Workflow');
    const [selectedAgent, setSelectedAgent] = useState(preselectedAgentId);
    const [agents, setAgents] = useState([]);
    const [agentsLoaded, setAgentsLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [showTesting, setShowTesting] = useState(false);
    const [showAssistant, setShowAssistant] = useState(false);
    const [nodeSearch, setNodeSearch] = useState('');
    const [currentWorkflowId, setCurrentWorkflowId] = useState(workflowId);
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [currentAgent, setCurrentAgent] = useState(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const reactFlowWrapper = useRef(null);

    useEffect(() => {
        fetchAgents();
        if (workflowId) {
            loadWorkflow(workflowId);
        } else if (preselectedAgentId) {
            loadAgent(preselectedAgentId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            // Deliberately does NOT auto-select the first agent here: landing on a blank workflow
            // with nothing selected is the "design the flow first, configure/assign an agent
            // later" path (see ensureAgent) — auto-picking one would silently remove that choice.
            // Deep-linking with `?agentId=` (handled below) or picking one from the dropdown are
            // the two ways to attach to an existing agent instead.
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        } finally {
            setAgentsLoaded(true);
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

    // Creates the real Agent record the first time one is actually needed (Save, Test, or an
    // explicit Agent Settings save) if the user has been designing the flow with nothing selected
    // — that's the whole point of allowing a blank canvas with no agent up front. Returns the
    // agent id to attach the workflow to either way.
    const ensureAgent = async (settingsOverride) => {
        if (selectedAgent) {
            if (settingsOverride) await client.put(`/agents/${selectedAgent}`, settingsOverride);
            return selectedAgent;
        }
        const payload = {
            name: workflowName?.trim() || 'New Agent',
            ...DRAFT_AGENT_DEFAULTS,
            ...(settingsOverride || {}),
        };
        const res = await client.post('/agents/', payload);
        setSelectedAgent(res.data.id);
        setCurrentAgent(res.data);
        setAgents((prev) => [...prev, res.data]);
        return res.data.id;
    };

    const updateAgentSettings = async (settings) => {
        try {
            const wasNew = !selectedAgent;
            const agentId = await ensureAgent(settings);
            if (!wasNew) await loadAgent(agentId); // resync (incl. which key toggles now reflect a saved override)
            // No blocking alert() here — the settings panel shows its own inline "Saved" confirmation.
        } catch (error) {
            console.error('Failed to update agent:', error);
            alert('Failed to update agent settings');
            throw error;
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



    // Applies the graph operations proposed by the Flow Assistant (see FlowAssistantPanel +
    // services/flow_assistant_service.py) directly onto the live canvas. The LLM invents its own
    // short node/edge ids ("transfer-1") — remapped here to real unique ids so they can never
    // collide with anything already on the canvas, while still resolving edges that reference a
    // node the same batch of operations just added. Computed synchronously against the current
    // `nodes`/`edges` state (rather than via setState updater functions) specifically so the
    // returned "N changes applied" count is accurate the instant this returns — React does not
    // guarantee an updater callback runs before the next line of code.
    const applyAssistantOperations = useCallback((operations) => {
        const idMap = {};
        const resolveId = (id) => idMap[id] || id;
        let applied = 0;
        let nextNodes = nodes;
        let nextEdges = edges;

        operations.forEach((op, i) => {
            try {
                if (op.op === 'add_node' && op.node?.type) {
                    const realId = `node-${Date.now()}-${i}`;
                    idMap[op.node.id] = realId;
                    nextNodes = [...nextNodes, {
                        id: realId,
                        type: op.node.type,
                        data: op.node.data || {},
                        position: op.node.position || { x: 300 + i * 60, y: 250 + i * 100 },
                    }];
                    applied += 1;
                } else if (op.op === 'update_node' && op.id) {
                    const targetId = resolveId(op.id);
                    if (nextNodes.some((n) => n.id === targetId)) {
                        nextNodes = nextNodes.map((n) => n.id === targetId ? { ...n, data: { ...n.data, ...(op.data || {}) } } : n);
                        applied += 1;
                    }
                } else if (op.op === 'delete_node' && op.id) {
                    const targetId = resolveId(op.id);
                    if (nextNodes.some((n) => n.id === targetId && n.type !== 'begin')) {
                        nextNodes = nextNodes.filter((n) => n.id !== targetId);
                        nextEdges = nextEdges.filter((e) => e.source !== targetId && e.target !== targetId);
                        applied += 1;
                    }
                } else if (op.op === 'add_edge' && op.edge?.source && op.edge?.target) {
                    nextEdges = [...nextEdges, {
                        id: `edge-${Date.now()}-${i}`,
                        source: resolveId(op.edge.source),
                        target: resolveId(op.edge.target),
                        sourceHandle: op.edge.sourceHandle || undefined,
                        type: 'custom',
                        markerEnd: { type: MarkerType.ArrowClosed },
                        data: { onDelete: handleDeleteEdge },
                    }];
                    applied += 1;
                } else if (op.op === 'delete_edge' && op.id) {
                    if (nextEdges.some((e) => e.id === op.id)) {
                        nextEdges = nextEdges.filter((e) => e.id !== op.id);
                        applied += 1;
                    }
                }
            } catch (e) {
                console.warn('Flow assistant: failed to apply operation', op, e);
            }
        });

        setNodes(nextNodes);
        setEdges(nextEdges);
        return applied;
    }, [nodes, edges, setNodes, setEdges, handleDeleteEdge]);

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
        setSaving(true);
        try {
            // If the flow was designed with nothing selected, this is the moment its agent
            // actually gets created — using whatever's been set in the Agent Settings panel
            // (or plain defaults if that was never opened).
            const agentId = await ensureAgent();

            const workflowData = {
                name: workflowName,
                agent_id: agentId,
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
            <div className="h-full min-h-0 flex overflow-hidden bg-background" ref={reactFlowWrapper}>
                <aside className="w-[176px] shrink-0 bg-card/95 border-r border-border flex flex-col">
                    <div className="h-14 px-3 border-b border-border flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                            title="Back to dashboard"
                        >
                            <Home className="w-4 h-4" />
                        </button>
                        <div>
                            <p className="text-xs font-semibold">Node library</p>
                            <p className="text-[10px] text-muted-foreground">Click to add</p>
                        </div>
                    </div>
                    <div className="p-2 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                value={nodeSearch}
                                onChange={(e) => setNodeSearch(e.target.value)}
                                placeholder="Search nodes"
                                className="w-full h-8 pl-8 pr-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {NODE_LIBRARY
                            .filter((item) => item.label.toLowerCase().includes(nodeSearch.trim().toLowerCase()))
                            .map(({ type, label, icon: Icon, color, hover }) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => addNode(type, type === 'note' ? '' : label)}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-transparent text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors ${hover}`}
                                >
                                    <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                                    <span className="truncate">{label}</span>
                                </button>
                            ))}
                    </div>
                </aside>

                {/* Main Canvas Area */}
                <div className="min-w-0 flex-1 flex flex-col">
                    {/* Toolbar */}
                    <div className="h-14 shrink-0 bg-card/95 border-b border-border px-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="w-36 h-9 px-3 rounded-md border border-input bg-background text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
                            />
                            <select
                                value={selectedAgent || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) {
                                        setSelectedAgent(null);
                                        setCurrentAgent(null);
                                    } else {
                                        const id = parseInt(val, 10);
                                        setSelectedAgent(id);
                                        loadAgent(id);
                                    }
                                }}
                                className="w-40 h-9 px-3 rounded-md border border-input bg-background text-xs"
                            >
                                <option value="">No agent yet</option>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <ThemeToggle />
                            <button
                                type="button"
                                onClick={saveWorkflow}
                                disabled={saving}
                                className="h-9 flex items-center gap-1.5 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                <span className="hidden xl:inline">{saving ? 'Saving...' : 'Save'}</span>
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
                                className="h-9 flex items-center gap-1.5 px-3 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700"
                            >
                                <Play className="w-4 h-4" />
                                <span className="hidden xl:inline">Test</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAssistant((v) => !v)}
                                title="Describe an edit in plain English and let an AI assistant apply it to the canvas"
                                className={`h-9 flex items-center gap-1.5 px-3 rounded-md border text-xs font-medium ${showAssistant ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent'}`}
                            >
                                <Bot className="w-4 h-4" />
                                <span className="hidden xl:inline">Assistant</span>
                            </button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="flex-1 min-h-0 relative workflow-canvas">
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
                            fitView
                            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
                            defaultEdgeOptions={{ type: 'custom', markerEnd: { type: MarkerType.ArrowClosed } }}
                        >
                            <Controls position="bottom-left" />
                            <MiniMap
                                position="bottom-right"
                                pannable
                                zoomable
                                nodeStrokeWidth={3}
                                maskColor="rgba(7, 11, 22, 0.72)"
                                className="workflow-minimap"
                            />
                            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(120, 140, 180, 0.28)" />
                        </ReactFlow>
                    </div>
                </div>

                {showAssistant && (
                    <FlowAssistantPanel
                        nodes={nodes}
                        edges={edges}
                        agentId={selectedAgent}
                        onApplyOperations={applyAssistantOperations}
                        onClose={() => setShowAssistant(false)}
                    />
                )}

                {showTesting && (
                    <TestingPanel
                        workflow={{ nodes, edges }}
                        workflowId={currentWorkflowId}
                        onClose={handleCloseTestPanel}
                        onNodeExecute={handleNodeExecute}
                    />
                )}

                {/* Permanently docked Global/Node Settings panel — replaces the old floating
                    "Agent Settings" toggle + canvas-overlaid Node Properties panel, which could
                    stack on top of each other. See components/SettingsDock.jsx. */}
                <SettingsDock
                    // No agent created yet (draft mode) -> panel opens with plain defaults
                    // instead of needing a persisted Agent row first; saving it is what
                    // triggers ensureAgent() to actually create one (see updateAgentSettings).
                    agent={currentAgent || { name: workflowName, ...DRAFT_AGENT_DEFAULTS }}
                    isDraft={!selectedAgent}
                    onUpdateAgent={updateAgentSettings}
                    selectedNode={selectedNode}
                    onUpdateNode={updateNodeData}
                    agents={agents.filter((a) => a.id !== selectedAgent)}
                />
            </div>
        </NodeActionsContext.Provider>
    );
};

export default WorkflowBuilder;

