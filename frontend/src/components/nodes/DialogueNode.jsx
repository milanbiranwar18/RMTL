import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import NodeContextMenu from '../NodeContextMenu';
import { useNodeActions } from '../../context/NodeActionsContext';

const DialogueNode = ({ data, isConnectable, id }) => {
    const conditions = data.conditions || [];
    const hasConditions = conditions.length > 0;
    const { onDuplicate, onDelete, onEdit } = useNodeActions();

    return (
        <div className="w-[300px] shadow-xl rounded-lg bg-card border border-border text-card-foreground overflow-hidden font-sans">
            <NodeContextMenu
                nodeId={id}
                nodeType="dialogue"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onEdit={onEdit}
            />

            {/* Header */}
            <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm text-foreground">Conversation</span>
                </div>
                <div className="flex gap-1">
                    {/* Placeholder for future controls */}
                </div>
            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="w-3 h-3 !bg-primary !border-2 !border-background"
            />

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Prompt/Text Preview */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border border-border">
                    {data.label ? (
                        <div className="font-medium mb-1 text-foreground">{data.label}</div>
                    ) : null}
                    <div className="line-clamp-3 text-xs">
                        {data.prompt || data.staticText || "No message configured..."}
                    </div>
                </div>

                {/* Transitions Section */}
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transition</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEdit) {
                                    // Open properties panel
                                    onEdit(id);
                                }
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span className="text-lg leading-none">+</span>
                        </button>
                    </div>

                    <div className="space-y-2">
                        {hasConditions && conditions.map((condition, index) => (
                            <div key={index} className="relative group">
                                <div className="flex items-center justify-between bg-muted/50 hover:bg-muted p-2 rounded border border-border transition-colors text-xs">
                                    <span className="text-foreground truncate pr-4">{condition.label || 'Condition'}</span>
                                </div>

                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`condition-${index}`}
                                    isConnectable={isConnectable}
                                    className="w-3 h-3 !bg-primary !border-2 !border-background !-right-1.5"
                                    style={{ top: '50%' }}
                                />
                            </div>
                        ))}

                        {/* Default Handle - Always visible */}
                        <div className="relative group">
                            <div className="flex items-center justify-between bg-muted/50 p-2 rounded border border-border text-xs text-muted-foreground italic">
                                Default / Next
                            </div>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="default"
                                isConnectable={isConnectable}
                                className="w-3 h-3 !bg-primary !border-2 !border-background !-right-1.5"
                                style={{ top: '50%' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(DialogueNode);
