import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';

const BeginNode = ({ data, isConnectable }) => {
    return (
        <div className="px-4 py-3 shadow-lg rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-400 min-w-[180px]">
            <div className="flex items-center gap-2 mb-2 text-white">
                <Play className="w-5 h-5" />
                <div className="font-bold text-sm">BEGIN</div>
            </div>

            <div className="text-xs text-blue-100">
                {data.label || 'Start of conversation'}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                id="default"
                isConnectable={isConnectable}
                className="w-3 h-3 bg-blue-300"
            />
        </div>
    );
};

export default memo(BeginNode);
