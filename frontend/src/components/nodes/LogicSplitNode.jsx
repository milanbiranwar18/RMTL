import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GitFork } from 'lucide-react';
import NodeContextMenu from '../NodeContextMenu';
import { useNodeActions } from '../../context/NodeActionsContext';

// Routes on previously-extracted *variables* rather than the user's literal words (that's what
// the plain Condition node does) — e.g. "if plan == 'pro'". Each branch gets its own named
// output handle (`branch-{i}`) plus one always-present "Default / else" handle, mirroring how
// DialogueNode renders its per-condition handles.
const LogicSplitNode = ({ data, isConnectable, id }) => {
    const branches = data.branches || [];
    const { onDuplicate, onDelete, onEdit } = useNodeActions();

    return (
        <div className="relative min-w-[230px] shadow-lg shadow-black/15 rounded-lg bg-card/95 border border-orange-500">
            <NodeContextMenu nodeId={id} nodeType="Logic Split" onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} />

            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3" />

            <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                    <GitFork className="w-4 h-4 text-orange-500" />
                    <div className="font-semibold text-sm">{data.label || 'Logic Split'}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                    {branches.length === 0 ? 'Add branches based on a variable...' : `${branches.length} branch${branches.length > 1 ? 'es' : ''} configured`}
                </div>
            </div>

            <div className="border-t border-border">
                {branches.map((branch, i) => (
                    <div key={i} className="relative flex items-center justify-between px-3 py-1.5 text-xs border-b border-border last:border-b-0">
                        <span className="truncate pr-4 text-foreground">
                            {branch.variable ? `${branch.variable} ${branch.operator || '=='} ${branch.value}` : `Branch ${i + 1}`}
                        </span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`branch-${i}`}
                            isConnectable={isConnectable}
                            className="w-3 h-3 !bg-orange-500 !border-2 !border-background !-right-1.5"
                            style={{ top: '50%' }}
                        />
                    </div>
                ))}
                <div className="relative flex items-center justify-between px-3 py-1.5 text-xs italic text-muted-foreground">
                    <span>Default / else</span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="default"
                        isConnectable={isConnectable}
                        className="w-3 h-3 !bg-orange-500 !border-2 !border-background !-right-1.5"
                        style={{ top: '50%' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default memo(LogicSplitNode);
