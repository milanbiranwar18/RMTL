import React, { useState } from 'react';
import { X, MessageSquare, Zap, GitBranch } from 'lucide-react';

const NodePropertiesPanel = ({ selectedNode, onUpdate, onClose }) => {
    const [nodeData, setNodeData] = useState(selectedNode?.data || {});

    if (!selectedNode) return null;

    const handleSave = () => {
        onUpdate(selectedNode.id, nodeData);
        onClose();
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
        <div className="absolute top-0 right-0 w-80 h-full bg-card border-l border-border p-4 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Node Properties</h3>
                <button onClick={onClose} className="p-1 hover:bg-accent rounded">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                {renderFields()}

                <button
                    onClick={handleSave}
                    className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default NodePropertiesPanel;
