import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sliders, MousePointerClick } from 'lucide-react';
import AgentSettingsPanel from './AgentSettingsPanel';
import NodePropertiesPanel from './NodePropertiesPanel';

// The single, permanently-docked right-hand panel for the Workflow Builder — replaces what used
// to be two separate floating overlays (a toggled "Agent Settings" panel and a canvas-overlaid
// "Node Properties" panel, both absolutely positioned at the same spot and liable to stack on
// top of each other). Matches Retell's own "Global Settings / Node Settings" docked-panel
// pattern: one fixed-width column, two tabs, nothing ever overlaps the canvas or fights for the
// same screen real estate.
const SettingsDock = ({ agent, isDraft, onUpdateAgent, selectedNode, onUpdateNode, agents = [] }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('global');

    // Jump to Node Settings the moment a node is clicked — this is the whole reason the "Node
    // Settings" tab exists, so it should surface automatically instead of making the user hunt
    // for it every time they click a node.
    useEffect(() => {
        if (selectedNode) setActiveTab('node');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNode?.id]);

    return (
        <div
            className={`relative h-full min-h-0 flex flex-col bg-card/95 border-l border-border shrink-0 transition-all duration-200 ${isCollapsed ? 'w-11' : 'w-[320px]'
                }`}
        >
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-card border border-border rounded-l-md p-2 hover:bg-accent z-10"
                title={isCollapsed ? 'Expand settings' : 'Collapse settings'}
            >
                {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {isCollapsed ? (
                <div className="flex-1 flex flex-col items-center pt-4 gap-1 text-muted-foreground">
                    <Sliders className="w-4 h-4" />
                </div>
            ) : (
                <>
                    <div className="h-14 shrink-0 border-b border-border p-2 flex items-center gap-1 bg-card">
                        <button
                            type="button"
                            onClick={() => setActiveTab('global')}
                            className={`h-9 flex-1 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'global'
                                    ? 'bg-accent text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                        >
                            <Sliders className="w-3.5 h-3.5" />
                            Global Settings
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('node')}
                            className={`h-9 flex-1 flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'node'
                                    ? 'bg-accent text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                        >
                            <MousePointerClick className="w-3.5 h-3.5" />
                            Node Settings
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'global' ? (
                            <AgentSettingsPanel agent={agent} isDraft={isDraft} onUpdate={onUpdateAgent} />
                        ) : (
                            <NodePropertiesPanel
                                key={selectedNode?.id || 'none'}
                                selectedNode={selectedNode}
                                onUpdate={onUpdateNode}
                                agents={agents}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SettingsDock;
