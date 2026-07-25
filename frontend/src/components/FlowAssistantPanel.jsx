import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import client from '../api/client';

const EXAMPLE_PROMPTS = [
    'Add a node that transfers to +1 555 123 4567 if the caller asks for a refund',
    'Add a step that texts the caller a confirmation SMS at the end',
    'Add a note reminding me to fill in the real transfer number',
];

/** The "Conductor"-style chat assistant for the Workflow Builder — describe an edit in plain
 * English, an LLM (BYOK, see services/flow_assistant_service.py) proposes graph operations,
 * this component applies them straight to the live canvas. The canvas (passed in via
 * nodes/edges) is always the source of truth; this never regenerates the whole graph, only
 * the minimal add/update/delete operations the backend proposes. */
const FlowAssistantPanel = ({ nodes, edges, agentId, onApplyOperations, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isLoading]);

    const send = async (text) => {
        const content = (text ?? inputText).trim();
        if (!content || isLoading) return;

        const userMessage = { role: 'user', content };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await client.post('/assistant/edit', {
                nodes,
                edges,
                message: content,
                conversation_history: messages,
                agent_id: agentId || null,
            });
            const { reply, operations } = response.data;
            let appliedCount = 0;
            if (operations && operations.length > 0) {
                appliedCount = onApplyOperations(operations);
            }
            const suffix = appliedCount > 0 ? ` (${appliedCount} change${appliedCount === 1 ? '' : 's'} applied)` : '';
            setMessages((prev) => [...prev, { role: 'assistant', content: (reply || 'Done.') + suffix }]);
        } catch (error) {
            console.error('Flow assistant failed:', error);
            setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong processing that.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`relative h-full flex flex-col bg-card border-l border-border shrink-0 transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-80'}`}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-card border border-border rounded-l-md p-2 hover:bg-accent"
            >
                {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {!isCollapsed && (
                <>
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                        <h2 className="text-sm font-semibold flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-primary" />
                            Flow Assistant
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-accent rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.length === 0 ? (
                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    Describe an edit in plain English — I'll propose changes to the nodes/edges
                                    on your canvas. Try one of these:
                                </p>
                                {EXAMPLE_PROMPTS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => send(p)}
                                        className="w-full text-left text-xs px-2.5 py-2 rounded-md border border-dashed border-border hover:border-primary hover:bg-accent flex items-start gap-1.5"
                                    >
                                        <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                                        {p}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-2.5 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted px-3 py-2 rounded-lg text-sm flex items-center gap-1.5">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-border flex gap-1.5">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && send()}
                            placeholder="Describe an edit..."
                            className="flex-1 px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                        />
                        <button
                            onClick={() => send()}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default FlowAssistantPanel;
