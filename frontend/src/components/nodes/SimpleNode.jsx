import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import NodeContextMenu from '../NodeContextMenu';
import { useNodeActions } from '../../context/NodeActionsContext';

// Factory for the "simple" workflow node types — single input, single output, one short preview
// line. Covers Call Transfer / Press Digit / Agent Transfer / In-Call SMS / Code / Ending, which
// all share the exact same shape and only differ in icon/color/label/preview text. Logic Split
// (multiple named branch outputs) and Note (no handles at all) are different enough to get their
// own dedicated components instead.
export const createSimpleNode = ({ icon: Icon, borderClass, iconClass, title, preview, noOutput = false }) => {
    const Comp = ({ data, isConnectable, id }) => {
        const { onDuplicate, onDelete, onEdit } = useNodeActions();
        return (
            <div className={`relative px-3.5 py-3 shadow-lg shadow-black/15 rounded-lg bg-card/95 border ${borderClass} min-w-[210px]`}>
                <NodeContextMenu nodeId={id} nodeType={title} onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} />

                <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3" />

                <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${iconClass}`} />
                    <div className="font-semibold text-sm">{data.label || title}</div>
                </div>

                <div className="text-xs text-muted-foreground line-clamp-2">
                    {preview ? preview(data) : `Configure ${title.toLowerCase()}...`}
                </div>

                {!noOutput && (
                    <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3" />
                )}
            </div>
        );
    };
    Comp.displayName = `SimpleNode(${title})`;
    return memo(Comp);
};

export default createSimpleNode;
