import React, { useState } from 'react';
import { MousePointerClick, Plus, X, Loader2 } from 'lucide-react';
import FUNCTION_TEMPLATES from '../lib/functionTemplates';
import client from '../api/client';

const FieldLabel = ({ children }) => (
    <label className="block text-sm font-medium mb-1">{children}</label>
);

// Shared by Custom Function and MCP Tool Call — lets someone configure a canned response used
// only when the Testing panel's "Use mock responses" toggle is on (see workflow_engine.py's
// `_parse_mock_response`), so testing a flow doesn't fire a real SMS/Slack message/API call
// every time. The mock is authored as the exact same flat `{variable: value}` shape a real call
// would produce, so downstream nodes (a Logic Split checking `<name>_success`, an Ending message
// reading `{{some_variable}}`) behave identically either way.
const MockResponseFields = ({ nodeData, setNodeData }) => (
    <div className="pt-2 border-t border-border space-y-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
                type="checkbox"
                checked={!!nodeData.mockEnabled}
                onChange={(e) => setNodeData({ ...nodeData, mockEnabled: e.target.checked })}
                className="rounded"
            />
            Use a mock response when testing (skips the real call)
        </label>
        {nodeData.mockEnabled && (
            <div>
                <FieldLabel>Mock response (JSON — variable name -&gt; value)</FieldLabel>
                <textarea
                    rows={3}
                    value={nodeData.mockResponse || ''}
                    onChange={(e) => setNodeData({ ...nodeData, mockResponse: e.target.value })}
                    placeholder='{"temperature_c": "22", "condition": "Sunny"}'
                    className="w-full p-2 rounded-md border border-input bg-background font-mono text-xs"
                />
            </div>
        )}
    </div>
);

// Rendered inside the docked Settings panel's "Node Settings" tab — always mount with
// `key={selectedNode.id}` from the parent so `nodeData` resets cleanly whenever the selected
// node changes (see SettingsDock.jsx). `agents` (optional) is only used by the Agent Transfer
// node's target picker.
const NodePropertiesPanel = ({ selectedNode, onUpdate, agents = [] }) => {
    const [nodeData, setNodeData] = useState(selectedNode?.data || {});
    const [justSaved, setJustSaved] = useState(false);
    const [mcpTools, setMcpTools] = useState([]);
    const [mcpLoading, setMcpLoading] = useState(false);
    const [mcpError, setMcpError] = useState('');

    if (!selectedNode) {
        return (
            <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <MousePointerClick className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p>Select a node on the canvas to edit its settings here.</p>
            </div>
        );
    }

    const handleSave = () => {
        onUpdate(selectedNode.id, nodeData);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1500);
    };

    const renderFields = () => {
        switch (selectedNode.type) {
            case 'dialogue':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-1">Label</label>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Response Type</label>
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={() => setNodeData({ ...nodeData, responseType: 'llm' })}
                                    className={`flex-1 px-3 py-2 rounded-md border ${nodeData.responseType !== 'static' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                        }`}
                                >
                                    LLM Prompt
                                </button>
                                <button
                                    onClick={() => setNodeData({ ...nodeData, responseType: 'static' })}
                                    className={`flex-1 px-3 py-2 rounded-md border ${nodeData.responseType === 'static' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                        }`}
                                >
                                    Static Text
                                </button>
                            </div>
                        </div>

                        {nodeData.responseType === 'static' ? (
                            <div>
                                <label className="block text-sm font-medium mb-1">Static Response</label>
                                <textarea
                                    rows={4}
                                    value={nodeData.staticText || ''}
                                    onChange={(e) => setNodeData({ ...nodeData, staticText: e.target.value })}
                                    placeholder="Enter the exact text to speak..."
                                    className="w-full p-2 rounded-md border border-input bg-background"
                                />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-1">System Prompt</label>
                                    <textarea
                                        rows={6}
                                        value={nodeData.prompt || ''}
                                        onChange={(e) => setNodeData({ ...nodeData, prompt: e.target.value })}
                                        placeholder="You are a helpful assistant..."
                                        className="w-full p-2 rounded-md border border-input bg-background"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="enableLLM"
                                        checked={nodeData.enableLLM !== false}
                                        onChange={(e) => setNodeData({ ...nodeData, enableLLM: e.target.checked })}
                                        className="rounded"
                                    />
                                    <label htmlFor="enableLLM" className="text-sm">Enable LLM</label>
                                </div>

                                {/* Transitions Section */}
                                <div className="mt-6 border-t border-border pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium">Transitions</label>
                                        <button
                                            onClick={() => {
                                                const conditions = nodeData.conditions || [];
                                                setNodeData({
                                                    ...nodeData,
                                                    conditions: [...conditions, { label: '', pattern: '' }]
                                                });
                                            }}
                                            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
                                        >
                                            <span>+</span> Add Path
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(nodeData.conditions || []).map((condition, index) => (
                                            <div key={index} className="p-3 border border-border rounded-md bg-card/50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-medium text-muted-foreground">Path {index + 1}</span>
                                                    <button
                                                        onClick={() => {
                                                            const conditions = [...(nodeData.conditions || [])];
                                                            conditions.splice(index, 1);
                                                            setNodeData({ ...nodeData, conditions });
                                                        }}
                                                        className="text-xs text-red-500 hover:text-red-600"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={condition.label || ''}
                                                            onChange={(e) => {
                                                                const conditions = [...(nodeData.conditions || [])];
                                                                conditions[index] = { ...conditions[index], label: e.target.value };
                                                                setNodeData({ ...nodeData, conditions });
                                                            }}
                                                            placeholder="Label (e.g. Yes)"
                                                            className="w-full p-2 text-xs rounded-md border border-input bg-background"
                                                        />
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={condition.pattern || ''}
                                                            onChange={(e) => {
                                                                const conditions = [...(nodeData.conditions || [])];
                                                                conditions[index] = { ...conditions[index], pattern: e.target.value };
                                                                setNodeData({ ...nodeData, conditions });
                                                            }}
                                                            placeholder="Keywords (e.g. yes, sure)"
                                                            className="w-full p-2 text-xs rounded-md border border-input bg-background"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {(!nodeData.conditions || nodeData.conditions.length === 0) && (
                                        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-md">
                                            No transitions added. <br /> The flow will continue to the default next step.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                );

            case 'action':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-1">Label</label>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Function Name</label>
                            <input
                                type="text"
                                value={nodeData.functionName || ''}
                                onChange={(e) => setNodeData({ ...nodeData, functionName: e.target.value })}
                                placeholder="e.g., bookAppointment"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                rows={3}
                                value={nodeData.description || ''}
                                onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                                placeholder="What does this action do?"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </>
                );

            case 'condition':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-1">Label</label>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Condition</label>
                            <input
                                type="text"
                                value={nodeData.condition || ''}
                                onChange={(e) => setNodeData({ ...nodeData, condition: e.target.value })}
                                placeholder="e.g., user.age > 18"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </>
                );

            case 'call_transfer':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Transfer To (phone number)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.transferNumber || ''}
                                onChange={(e) => setNodeData({ ...nodeData, transferNumber: e.target.value })}
                                placeholder="+15551234567"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Message before transferring</FieldLabel>
                            <textarea
                                rows={2}
                                value={nodeData.message || ''}
                                onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                placeholder="Sure, transferring you now — one moment."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Live calls: real transfer today for Twilio-connected agents (redirects the call via
                            Twilio's REST API); other telephony providers will speak the message above and end
                            the call until their transfer support is added.
                        </p>
                    </>
                );

            case 'press_digit':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Digits to send (DTMF)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.digits || ''}
                                onChange={(e) => setNodeData({ ...nodeData, digits: e.target.value.replace(/[^0-9*#]/g, '') })}
                                placeholder="e.g. 1 or 4321#"
                                className="w-full p-2 rounded-md border border-input bg-background font-mono"
                            />
                        </div>
                        <div>
                            <FieldLabel>Message (optional, spoken first)</FieldLabel>
                            <textarea
                                rows={2}
                                value={nodeData.message || ''}
                                onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                placeholder="One moment while I select an option..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Real touch-tone audio is synthesized and played into the call — useful for
                            auto-navigating an IVR menu after a transfer.
                        </p>
                    </>
                );

            case 'logic_split':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <FieldLabel>Branches</FieldLabel>
                            <button
                                type="button"
                                onClick={() => setNodeData({
                                    ...nodeData,
                                    branches: [...(nodeData.branches || []), { variable: '', operator: 'equals', value: '' }],
                                })}
                                className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Branch
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(nodeData.branches || []).map((branch, i) => (
                                <div key={i} className="p-2.5 border border-border rounded-md bg-card/50 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">Branch {i + 1}</span>
                                        <button
                                            onClick={() => {
                                                const branches = [...(nodeData.branches || [])];
                                                branches.splice(i, 1);
                                                setNodeData({ ...nodeData, branches });
                                            }}
                                            className="text-muted-foreground hover:text-red-500"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={branch.variable || ''}
                                        onChange={(e) => {
                                            const branches = [...(nodeData.branches || [])];
                                            branches[i] = { ...branches[i], variable: e.target.value };
                                            setNodeData({ ...nodeData, branches });
                                        }}
                                        placeholder="Variable name (e.g. plan)"
                                        className="w-full p-1.5 text-xs rounded-md border border-input bg-background"
                                    />
                                    <div className="flex gap-1.5">
                                        <select
                                            value={branch.operator || 'equals'}
                                            onChange={(e) => {
                                                const branches = [...(nodeData.branches || [])];
                                                branches[i] = { ...branches[i], operator: e.target.value };
                                                setNodeData({ ...nodeData, branches });
                                            }}
                                            className="w-2/5 p-1.5 text-xs rounded-md border border-input bg-background"
                                        >
                                            <option value="equals">equals</option>
                                            <option value="not_equals">not equals</option>
                                            <option value="contains">contains</option>
                                            <option value="greater_than">greater than</option>
                                            <option value="less_than">less than</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={branch.value || ''}
                                            onChange={(e) => {
                                                const branches = [...(nodeData.branches || [])];
                                                branches[i] = { ...branches[i], value: e.target.value };
                                                setNodeData({ ...nodeData, branches });
                                            }}
                                            placeholder="Value (e.g. pro)"
                                            className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background"
                                        />
                                    </div>
                                </div>
                            ))}
                            {(!nodeData.branches || nodeData.branches.length === 0) && (
                                <div className="text-center py-3 text-xs text-muted-foreground border border-dashed border-border rounded-md">
                                    No branches yet — everything falls through to Default / else.
                                </div>
                            )}
                        </div>
                    </>
                );

            case 'extract_variable':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <FieldLabel>Variables to extract</FieldLabel>
                            <button
                                type="button"
                                onClick={() => setNodeData({
                                    ...nodeData,
                                    variables: [...(nodeData.variables || []), { name: '', description: '' }],
                                })}
                                className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Variable
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(nodeData.variables || []).map((v, i) => (
                                <div key={i} className="p-2.5 border border-border rounded-md bg-card/50 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={v.name || ''}
                                            onChange={(e) => {
                                                const vars = [...(nodeData.variables || [])];
                                                vars[i] = { ...vars[i], name: e.target.value };
                                                setNodeData({ ...nodeData, variables: vars });
                                            }}
                                            placeholder="Name (e.g. email)"
                                            className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background font-mono"
                                        />
                                        <button
                                            onClick={() => {
                                                const vars = [...(nodeData.variables || [])];
                                                vars.splice(i, 1);
                                                setNodeData({ ...nodeData, variables: vars });
                                            }}
                                            className="text-muted-foreground hover:text-red-500"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={v.description || ''}
                                        onChange={(e) => {
                                            const vars = [...(nodeData.variables || [])];
                                            vars[i] = { ...vars[i], description: e.target.value };
                                            setNodeData({ ...nodeData, variables: vars });
                                        }}
                                        placeholder="What is this? (e.g. the caller's email address)"
                                        className="w-full p-1.5 text-xs rounded-md border border-input bg-background"
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Runs silently (no spoken reply of its own) — the agent's LLM pulls these values out of
                            the conversation so far, then the flow continues immediately to whatever's next.
                        </p>
                    </>
                );

            case 'code':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Expression</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.expression || ''}
                                onChange={(e) => setNodeData({ ...nodeData, expression: e.target.value })}
                                placeholder="e.g. price * quantity"
                                className="w-full p-2 rounded-md border border-input bg-background font-mono"
                            />
                        </div>
                        <div>
                            <FieldLabel>Store result as variable</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.outputVariable || ''}
                                onChange={(e) => setNodeData({ ...nodeData, outputVariable: e.target.value })}
                                placeholder="e.g. total"
                                className="w-full p-2 rounded-md border border-input bg-background font-mono"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Only simple arithmetic/comparisons over existing variables are allowed (no function
                            calls, no imports) — this deliberately isn't a general code sandbox.
                        </p>
                    </>
                );

            case 'in_call_sms':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>SMS message</FieldLabel>
                            <textarea
                                rows={3}
                                value={nodeData.message || ''}
                                onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                placeholder="Here's the link: https://... (supports {{variables}})"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>What the agent says after sending</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.confirmationMessage || ''}
                                onChange={(e) => setNodeData({ ...nodeData, confirmationMessage: e.target.value })}
                                placeholder="I've just sent that to you by text message."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Live calls: sends for real today on Twilio-connected agents (to the caller's number);
                            other telephony providers will skip the send but still speak the confirmation.
                        </p>
                    </>
                );

            case 'agent_transfer':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Hand off to agent</FieldLabel>
                            <select
                                value={nodeData.targetAgentId || ''}
                                onChange={(e) => {
                                    const id = e.target.value ? parseInt(e.target.value, 10) : null;
                                    const picked = agents.find((a) => a.id === id);
                                    setNodeData({ ...nodeData, targetAgentId: id, targetAgentName: picked?.name || '' });
                                }}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="">Select an agent...</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <FieldLabel>Message before handoff</FieldLabel>
                            <textarea
                                rows={2}
                                value={nodeData.message || ''}
                                onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                placeholder="One moment, connecting you with the right specialist."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            The rest of the conversation continues under the target agent's own prompt/voice/LLM —
                            and its own workflow, if it has one.
                        </p>
                    </>
                );

            case 'custom_function':
                return (
                    <>
                        <div>
                            <FieldLabel>Start from a template</FieldLabel>
                            <select
                                defaultValue=""
                                onChange={(e) => {
                                    const tpl = FUNCTION_TEMPLATES.find((t) => t.id === e.target.value);
                                    if (tpl && tpl.id !== 'blank') setNodeData({ ...nodeData, ...tpl.data });
                                    e.target.value = '';
                                }}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="" disabled>Choose a template to pre-fill (optional)...</option>
                                {FUNCTION_TEMPLATES.map((t) => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <FieldLabel>Function name</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.name || ''}
                                onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                                placeholder="e.g. get_weather"
                                className="w-full p-2 rounded-md border border-input bg-background font-mono"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Used to name the result variables: <code>&lt;name&gt;_success</code> and, on
                                failure, <code>&lt;name&gt;_error</code> — branch on these with a Logic Split.
                            </p>
                        </div>
                        <div>
                            <FieldLabel>Description (for your own reference)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.description || ''}
                                onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                                placeholder="What does this call do?"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={nodeData.method || 'POST'}
                                onChange={(e) => setNodeData({ ...nodeData, method: e.target.value })}
                                className="w-28 p-2 rounded-md border border-input bg-background"
                            >
                                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={nodeData.url || ''}
                                onChange={(e) => setNodeData({ ...nodeData, url: e.target.value })}
                                placeholder="https://api.example.com/endpoint?id={{customer_id}}"
                                className="flex-1 p-2 rounded-md border border-input bg-background font-mono text-xs"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <FieldLabel>Headers</FieldLabel>
                            <button
                                type="button"
                                onClick={() => setNodeData({
                                    ...nodeData,
                                    headers: [...(nodeData.headers || []), { key: '', value: '' }],
                                })}
                                className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Header
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {(nodeData.headers || []).map((h, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={h.key || ''}
                                        onChange={(e) => {
                                            const headers = [...(nodeData.headers || [])];
                                            headers[i] = { ...headers[i], key: e.target.value };
                                            setNodeData({ ...nodeData, headers });
                                        }}
                                        placeholder="Header (e.g. Authorization)"
                                        className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background font-mono"
                                    />
                                    <input
                                        type="text"
                                        value={h.value || ''}
                                        onChange={(e) => {
                                            const headers = [...(nodeData.headers || [])];
                                            headers[i] = { ...headers[i], value: e.target.value };
                                            setNodeData({ ...nodeData, headers });
                                        }}
                                        placeholder="Value (supports {{variables}})"
                                        className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            const headers = [...(nodeData.headers || [])];
                                            headers.splice(i, 1);
                                            setNodeData({ ...nodeData, headers });
                                        }}
                                        className="text-muted-foreground hover:text-red-500"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {nodeData.method !== 'GET' && (
                            <div>
                                <FieldLabel>Request body (JSON, supports {'{{variables}}'})</FieldLabel>
                                <textarea
                                    rows={4}
                                    value={nodeData.body || ''}
                                    onChange={(e) => setNodeData({ ...nodeData, body: e.target.value })}
                                    placeholder='{"email": "{{email}}"}'
                                    className="w-full p-2 rounded-md border border-input bg-background font-mono text-xs"
                                />
                            </div>
                        )}

                        <div>
                            <FieldLabel>Timeout (seconds)</FieldLabel>
                            <input
                                type="number"
                                min={1}
                                max={60}
                                value={nodeData.timeoutSeconds || 10}
                                onChange={(e) => setNodeData({ ...nodeData, timeoutSeconds: parseInt(e.target.value, 10) || 10 })}
                                className="w-24 p-2 rounded-md border border-input bg-background"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <FieldLabel>Map response into variables</FieldLabel>
                            <button
                                type="button"
                                onClick={() => setNodeData({
                                    ...nodeData,
                                    outputs: [...(nodeData.outputs || []), { variable: '', path: '' }],
                                })}
                                className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Output
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {(nodeData.outputs || []).map((o, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={o.variable || ''}
                                        onChange={(e) => {
                                            const outputs = [...(nodeData.outputs || [])];
                                            outputs[i] = { ...outputs[i], variable: e.target.value };
                                            setNodeData({ ...nodeData, outputs });
                                        }}
                                        placeholder="Variable name"
                                        className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background font-mono"
                                    />
                                    <input
                                        type="text"
                                        value={o.path || ''}
                                        onChange={(e) => {
                                            const outputs = [...(nodeData.outputs || [])];
                                            outputs[i] = { ...outputs[i], path: e.target.value };
                                            setNodeData({ ...nodeData, outputs });
                                        }}
                                        placeholder="JSON path (e.g. current.temp)"
                                        className="flex-1 p-1.5 text-xs rounded-md border border-input bg-background font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            const outputs = [...(nodeData.outputs || [])];
                                            outputs.splice(i, 1);
                                            setNodeData({ ...nodeData, outputs });
                                        }}
                                        className="text-muted-foreground hover:text-red-500"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Runs silently and always continues to whatever's next — a failed call just skips
                            the mapped outputs, so pair with a Logic Split checking <code>&lt;name&gt;_success</code>
                            to branch on failure.
                        </p>

                        <MockResponseFields nodeData={nodeData} setNodeData={setNodeData} />
                    </>
                );

            case 'mcp_tool_call': {
                const loadTools = async () => {
                    if (!nodeData.serverUrl) {
                        setMcpError('Enter the MCP server URL first.');
                        return;
                    }
                    setMcpLoading(true);
                    setMcpError('');
                    try {
                        const res = await client.post('/mcp/list-tools', {
                            server_url: nodeData.serverUrl,
                            auth_header: nodeData.authHeader || null,
                        });
                        setMcpTools(res.data.tools || []);
                        if ((res.data.tools || []).length === 0) {
                            setMcpError('Connected, but that server exposes no tools.');
                        }
                    } catch (err) {
                        setMcpTools([]);
                        setMcpError(err.response?.data?.detail || 'Failed to connect to that MCP server.');
                    } finally {
                        setMcpLoading(false);
                    }
                };

                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>MCP server URL (Streamable HTTP)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.serverUrl || ''}
                                onChange={(e) => setNodeData({ ...nodeData, serverUrl: e.target.value, toolName: '' })}
                                placeholder="https://your-mcp-server.com/mcp"
                                className="w-full p-2 rounded-md border border-input bg-background font-mono text-xs"
                            />
                        </div>
                        <div>
                            <FieldLabel>Auth header (optional)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.authHeader || ''}
                                onChange={(e) => setNodeData({ ...nodeData, authHeader: e.target.value })}
                                placeholder="Bearer sk-..."
                                className="w-full p-2 rounded-md border border-input bg-background font-mono text-xs"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={loadTools}
                            disabled={mcpLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md border border-violet-500 text-violet-500 hover:bg-violet-500/10 disabled:opacity-50"
                        >
                            {mcpLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {mcpLoading ? 'Connecting...' : 'Load Tools'}
                        </button>
                        {mcpError && <p className="text-[11px] text-red-500">{mcpError}</p>}

                        {(mcpTools.length > 0 || nodeData.toolName) && (
                            <div>
                                <FieldLabel>Tool to call</FieldLabel>
                                <select
                                    value={nodeData.toolName || ''}
                                    onChange={(e) => {
                                        const tool = mcpTools.find((t) => t.name === e.target.value);
                                        setNodeData({
                                            ...nodeData,
                                            toolName: e.target.value,
                                            toolDescription: tool?.description || '',
                                            toolInputSchema: tool?.input_schema || {},
                                        });
                                    }}
                                    className="w-full p-2 rounded-md border border-input bg-background"
                                >
                                    <option value="">Select a tool...</option>
                                    {mcpTools.map((t) => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                    {nodeData.toolName && !mcpTools.some((t) => t.name === nodeData.toolName) && (
                                        <option value={nodeData.toolName}>{nodeData.toolName} (saved)</option>
                                    )}
                                </select>
                                {nodeData.toolDescription && (
                                    <p className="text-[11px] text-muted-foreground mt-1">{nodeData.toolDescription}</p>
                                )}
                            </div>
                        )}

                        <div>
                            <FieldLabel>Store result as variable</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.outputVariable || ''}
                                onChange={(e) => setNodeData({ ...nodeData, outputVariable: e.target.value })}
                                placeholder={nodeData.toolName || 'e.g. lookup_result'}
                                className="w-full p-2 rounded-md border border-input bg-background font-mono"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Runs silently: the agent's LLM fills in the tool's arguments from the conversation
                            so far, calls it for real over MCP, then continues immediately. Also sets
                            <code> &lt;name&gt;_success</code> — pair with a Logic Split to branch on failure.
                        </p>

                        <MockResponseFields nodeData={nodeData} setNodeData={setNodeData} />
                    </>
                );
            }

            case 'ending':
                return (
                    <>
                        <div>
                            <FieldLabel>Label</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.label || ''}
                                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Final message</FieldLabel>
                            <textarea
                                rows={3}
                                value={nodeData.endMessage || ''}
                                onChange={(e) => setNodeData({ ...nodeData, endMessage: e.target.value })}
                                placeholder="Thanks for calling — goodbye!"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Ends the call/conversation immediately after speaking this message.
                        </p>
                    </>
                );

            case 'note':
                return (
                    <div>
                        <FieldLabel>Note text</FieldLabel>
                        <textarea
                            rows={5}
                            value={nodeData.text || ''}
                            onChange={(e) => setNodeData({ ...nodeData, text: e.target.value })}
                            placeholder="Leave a note for anyone else reading this flow..."
                            className="w-full p-2 rounded-md border border-input bg-background"
                        />
                    </div>
                );

            case 'wait_delay':
                return (
                    <>
                        <div>
                            <FieldLabel>Delay Duration (seconds)</FieldLabel>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={nodeData.delaySeconds || 2}
                                onChange={(e) => setNodeData({ ...nodeData, delaySeconds: parseInt(e.target.value) || 2 })}
                                placeholder="2"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Pause the workflow for this many seconds before continuing.
                            </p>
                        </div>
                    </>
                );

            case 'set_variable':
                return (
                    <>
                        <div>
                            <FieldLabel>Variable Name</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.variableName || ''}
                                onChange={(e) => setNodeData({ ...nodeData, variableName: e.target.value })}
                                placeholder="e.g., user_name"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Variable Value</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.variableValue || ''}
                                onChange={(e) => setNodeData({ ...nodeData, variableValue: e.target.value })}
                                placeholder="e.g., John Doe or {{existing_variable}}"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Use {`{{variable_name}}`} to reference existing variables.
                            </p>
                        </div>
                    </>
                );

            case 'send_whatsapp':
                return (
                    <>
                        <div>
                            <FieldLabel>WhatsApp Provider</FieldLabel>
                            <select
                                value={nodeData.provider || 'twilio_whatsapp'}
                                onChange={(e) => setNodeData({ ...nodeData, provider: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="twilio_whatsapp">Twilio WhatsApp</option>
                                <option value="exotel">Exotel WhatsApp</option>
                                <option value="aisensy">AISENSY</option>
                                <option value="gupshup">Gupshup</option>
                                <option value="360dialog">360Dialog</option>
                                <option value="interakt">Interakt</option>
                            </select>
                        </div>
                        <div>
                            <FieldLabel>Message Type</FieldLabel>
                            <select
                                value={nodeData.messageType || 'session'}
                                onChange={(e) => setNodeData({ ...nodeData, messageType: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="session">Session Message (free-form, 24hr window)</option>
                                <option value="template">Template Message (pre-approved, anytime)</option>
                            </select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {nodeData.messageType === 'template' 
                                    ? 'Template messages must be pre-approved by Meta. Use for business-initiated messages.'
                                    : 'Session messages can be sent freely within 24 hours after user messages you first.'}
                            </p>
                        </div>
                        <div>
                            <FieldLabel>To Number (with country code)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.toNumber || ''}
                                onChange={(e) => setNodeData({ ...nodeData, toNumber: e.target.value })}
                                placeholder="e.g., +919876543210 or {{phone_number}}"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        
                        {nodeData.messageType === 'template' ? (
                            <>
                                <div>
                                    <FieldLabel>Template Name</FieldLabel>
                                    <input
                                        type="text"
                                        value={nodeData.templateName || ''}
                                        onChange={(e) => setNodeData({ ...nodeData, templateName: e.target.value })}
                                        placeholder="e.g., order_confirmation"
                                        className="w-full p-2 rounded-md border border-input bg-background"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Use the template name approved in your WhatsApp Business Manager.
                                    </p>
                                </div>
                                <div>
                                    <FieldLabel>Template Parameters (JSON)</FieldLabel>
                                    <textarea
                                        rows={3}
                                        value={nodeData.templateParams || ''}
                                        onChange={(e) => setNodeData({ ...nodeData, templateParams: e.target.value })}
                                        placeholder='{"1": "John", "2": "Order #123"}'
                                        className="w-full p-2 rounded-md border border-input bg-background font-mono text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Provide template variable values as JSON. Example: {`{"1": "{{user_name}}", "2": "{{order_id}}"}`}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <FieldLabel>Message</FieldLabel>
                                    <textarea
                                        rows={4}
                                        value={nodeData.message || ''}
                                        onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                        placeholder="Type your WhatsApp message..."
                                        className="w-full p-2 rounded-md border border-input bg-background"
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Media URL (optional)</FieldLabel>
                                    <input
                                        type="text"
                                        value={nodeData.mediaUrl || ''}
                                        onChange={(e) => setNodeData({ ...nodeData, mediaUrl: e.target.value })}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full p-2 rounded-md border border-input bg-background"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Send an image, document, or other media attachment.
                                    </p>
                                </div>
                            </>
                        )}
                    </>
                );

            case 'send_sms':
                return (
                    <>
                        <div>
                            <FieldLabel>SMS Provider</FieldLabel>
                            <select
                                value={nodeData.provider || 'twilio'}
                                onChange={(e) => setNodeData({ ...nodeData, provider: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="twilio">Twilio</option>
                                <option value="exotel">Exotel</option>
                                <option value="plivo">Plivo</option>
                            </select>
                        </div>
                        <div>
                            <FieldLabel>To Number (with country code)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.toNumber || ''}
                                onChange={(e) => setNodeData({ ...nodeData, toNumber: e.target.value })}
                                placeholder="e.g., +919876543210 or {{phone_number}}"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Message</FieldLabel>
                            <textarea
                                rows={4}
                                value={nodeData.message || ''}
                                onChange={(e) => setNodeData({ ...nodeData, message: e.target.value })}
                                placeholder="Type your SMS message..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </>
                );

            case 'send_email':
                return (
                    <>
                        <div>
                            <FieldLabel>To Email</FieldLabel>
                            <input
                                type="email"
                                value={nodeData.toEmail || ''}
                                onChange={(e) => setNodeData({ ...nodeData, toEmail: e.target.value })}
                                placeholder="e.g., user@example.com or {{email}}"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Subject</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.subject || ''}
                                onChange={(e) => setNodeData({ ...nodeData, subject: e.target.value })}
                                placeholder="Email subject line..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Email Body</FieldLabel>
                            <textarea
                                rows={6}
                                value={nodeData.body || ''}
                                onChange={(e) => setNodeData({ ...nodeData, body: e.target.value })}
                                placeholder="Type your email message..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>From Email (optional)</FieldLabel>
                            <input
                                type="email"
                                value={nodeData.fromEmail || ''}
                                onChange={(e) => setNodeData({ ...nodeData, fromEmail: e.target.value })}
                                placeholder="Leave blank to use default SMTP sender"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </>
                );

            case 'play_audio':
                return (
                    <>
                        <div>
                            <FieldLabel>Audio File URL</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.audioUrl || ''}
                                onChange={(e) => setNodeData({ ...nodeData, audioUrl: e.target.value })}
                                placeholder="https://example.com/audio.mp3"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Provide a publicly accessible URL to an audio file (MP3, WAV, etc.)
                            </p>
                        </div>
                        <div>
                            <FieldLabel>Fallback Text (for text-only testing)</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.fallbackText || ''}
                                onChange={(e) => setNodeData({ ...nodeData, fallbackText: e.target.value })}
                                placeholder="[Audio message]"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                    </>
                );

            case 'menu_ivr':
                return (
                    <>
                        <div>
                            <FieldLabel>Menu Prompt</FieldLabel>
                            <textarea
                                rows={3}
                                value={nodeData.menuText || ''}
                                onChange={(e) => setNodeData({ ...nodeData, menuText: e.target.value })}
                                placeholder="Press 1 for Sales, 2 for Support..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Menu Options</FieldLabel>
                            <p className="text-xs text-muted-foreground mb-2">
                                Define DTMF options (digits 0-9, *, #) and their labels. Wire each option to different paths in the workflow.
                            </p>
                            {(nodeData.options || []).map((option, idx) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={option.digit || ''}
                                        onChange={(e) => {
                                            const opts = [...(nodeData.options || [])];
                                            opts[idx] = { ...opts[idx], digit: e.target.value };
                                            setNodeData({ ...nodeData, options: opts });
                                        }}
                                        placeholder="1"
                                        maxLength={1}
                                        className="w-16 p-2 rounded-md border border-input bg-background"
                                    />
                                    <input
                                        type="text"
                                        value={option.label || ''}
                                        onChange={(e) => {
                                            const opts = [...(nodeData.options || [])];
                                            opts[idx] = { ...opts[idx], label: e.target.value };
                                            setNodeData({ ...nodeData, options: opts });
                                        }}
                                        placeholder="Sales"
                                        className="flex-1 p-2 rounded-md border border-input bg-background"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const opts = [...(nodeData.options || [])];
                                            opts.splice(idx, 1);
                                            setNodeData({ ...nodeData, options: opts });
                                        }}
                                        className="px-2 text-red-400 hover:text-red-300"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    const opts = [...(nodeData.options || []), { digit: '', label: '' }];
                                    setNodeData({ ...nodeData, options: opts });
                                }}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                + Add Option
                            </button>
                        </div>
                    </>
                );

            case 'collect_input':
                return (
                    <>
                        <div>
                            <FieldLabel>Prompt Text</FieldLabel>
                            <textarea
                                rows={2}
                                value={nodeData.promptText || ''}
                                onChange={(e) => setNodeData({ ...nodeData, promptText: e.target.value })}
                                placeholder="Please provide your email address..."
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                        </div>
                        <div>
                            <FieldLabel>Input Type</FieldLabel>
                            <select
                                value={nodeData.inputType || 'text'}
                                onChange={(e) => setNodeData({ ...nodeData, inputType: e.target.value })}
                                className="w-full p-2 rounded-md border border-input bg-background"
                            >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone Number</option>
                                <option value="date">Date</option>
                            </select>
                        </div>
                        <div>
                            <FieldLabel>Store As Variable</FieldLabel>
                            <input
                                type="text"
                                value={nodeData.variableName || 'collected_input'}
                                onChange={(e) => setNodeData({ ...nodeData, variableName: e.target.value })}
                                placeholder="collected_input"
                                className="w-full p-2 rounded-md border border-input bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                The collected input will be stored in this variable for use in later nodes.
                            </p>
                        </div>
                    </>
                );

            default:
                return (
                    <div>
                        <label className="block text-sm font-medium mb-1">Label</label>
                        <input
                            type="text"
                            value={nodeData.label || ''}
                            onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                            className="w-full p-2 rounded-md border border-input bg-background"
                        />
                    </div>
                );
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {selectedNode.type} node
                </h4>
            </div>

            {renderFields()}

            <button
                onClick={handleSave}
                className="w-full bg-primary text-primary-foreground py-2 text-sm rounded-md hover:bg-primary/90 font-medium"
            >
                {justSaved ? 'Saved ✓' : 'Save Changes'}
            </button>
        </div>
    );
};

export default NodePropertiesPanel;
