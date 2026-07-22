import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

const ConditionNode = ({ data, isConnectable }) => {
    return (
        <div className="px-4 py-3 shadow-lg rounded-lg bg-card border-2 border-yellow-500 min-w-[200px]">
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3"
            />

            <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4 text-yellow-500" />
                <div className="font-semibold text-sm">Condition</div>
            </div>

            <div className="text-xs text-muted-foreground">
                {data.label || 'If/else logic...'}
            </div>

            {data.condition && (
                <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                    {data.condition}
                </div>
            )}

            <div className="flex justify-between mt-2">
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="true"
                    isConnectable={isConnectable}
                    className="w-3 h-3"
                    style={{ left: '30%' }}
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="false"
                    isConnectable={isConnectable}
                    className="w-3 h-3"
                    style={{ left: '70%' }}
                />
            </div>

            <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                <span className="ml-2">True</span>
                <span className="mr-2">False</span>
            </div>
        </div>
    );
};

export default memo(ConditionNode);
