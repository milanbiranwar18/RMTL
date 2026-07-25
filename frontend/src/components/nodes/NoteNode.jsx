import React, { memo } from 'react';
import { StickyNote } from 'lucide-react';
import NodeContextMenu from '../NodeContextMenu';
import { useNodeActions } from '../../context/NodeActionsContext';

// Purely a visual annotation for documenting a flow — deliberately has NO handles, so it can
// never actually be wired into the graph and never affects execution (the workflow engine
// skips over it entirely; see workflow_engine.py). Just a sticky note on the canvas.
const NoteNode = ({ data, id }) => {
    const { onDuplicate, onDelete, onEdit } = useNodeActions();
    return (
        <div className="relative min-w-[200px] max-w-[240px] px-3 py-3 rounded-lg shadow-md bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 -rotate-1">
            <NodeContextMenu nodeId={id} nodeType="Note" onDuplicate={onDuplicate} onDelete={onDelete} onEdit={onEdit} />
            <div className="flex items-center gap-1.5 mb-1.5 text-amber-700 dark:text-amber-300">
                <StickyNote className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Note</span>
            </div>
            <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">
                {data.text || 'Click to add a note for anyone else reading this flow...'}
            </p>
        </div>
    );
};

export default memo(NoteNode);
