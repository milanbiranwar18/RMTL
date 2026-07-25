import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';

const BeginNode = ({ data, isConnectable }) => {
    return (
        <div className="px-3.5 py-3 shadow-lg shadow-blue-950/20 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-300/70 min-w-[150px]">
            <div className="flex items-center gap-2 mb-1.5 text-white">
                <Play className="w-4 h-4" />
                <div className="font-semibold text-xs tracking-wide">BEGIN</div>
            </div>

            <div className="text-xs text-blue-100">
                {data.label || 'Start of conversation'}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="default"
                isConnectable={isConnectable}
                className="w-3 h-3 !bg-blue-300 !border-2 !border-blue-700"
            />
        </div>
    );
};

export default memo(BeginNode);
