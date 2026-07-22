import React, { useState } from 'react';
import { MoreVertical, Copy, Trash2, Edit } from 'lucide-react';

const NodeContextMenu = ({ nodeId, nodeType, onDuplicate, onDelete, onEdit }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Don't show menu for BEGIN node
    if (nodeType === 'begin') {
        return null;
    }

    const handleDuplicate = (e) => {
        e.stopPropagation();
        onDuplicate(nodeId);
        setIsOpen(false);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onDelete(nodeId);
        setIsOpen(false);
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        if (onEdit) onEdit(nodeId);
        setIsOpen(false);
    };

    return (
        <div className="absolute top-1 right-1 z-10">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Node actions"
            >
                <MoreVertical className="w-4 h-4" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close menu */}
                    <div
                        className="fixed inset-0 z-0"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute top-8 right-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px] z-10">
                        <button
                            onClick={handleEdit}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-popover-foreground text-left text-sm"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={handleDuplicate}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-popover-foreground text-left text-sm"
                        >
                            <Copy className="w-4 h-4" />
                            Duplicate
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-500 text-left text-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default NodeContextMenu;
