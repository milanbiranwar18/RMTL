import React, { createContext, useContext } from 'react';

const NodeActionsContext = createContext({
    onDuplicate: () => { },
    onDelete: () => { },
    onEdit: () => { },
});

export const useNodeActions = () => useContext(NodeActionsContext);

export default NodeActionsContext;
