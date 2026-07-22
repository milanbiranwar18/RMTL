import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Zap } from 'lucide-react';

const ActionNode = ({ data, isConnectable }) => {
    return (
        <div className="px-4 py-3 shadow-lg rounded-lg bg-card border-2 border-green-500 min-w-[200px]">
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3"
            />

            <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-500" />
                <div className="font-semibold text-sm">Action</div>
            </div>

            <div className="text-xs text-muted-foreground">
                {data.label || 'Execute function...'}
            </div>

            {data.functionName && (
                <div className="mt-2 text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded font-mono">
                    {data.functionName}()
                </div>
            )}

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3"
            />
        </div>
    );
};

export default memo(ActionNode);
