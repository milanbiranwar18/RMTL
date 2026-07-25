import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Mic, X, ChevronLeft, ChevronRight, Braces, Bot, Loader2, Settings2 } from 'lucide-react';
import client from '../api/client';
import DynamicVariablesEditor from './DynamicVariablesEditor';

const TestingPanel = ({ workflow, workflowId, onClose, onNodeExecute }) => {
    // 'text' ("Test LLM" — fast, no audio round-trip), 'voice' ("Test Audio" — full STT/TTS
    // pipeline), 'simulate' ("AI Simulate" — an LLM plays the caller automatically, see
    // /test/simulate) — same three ways Retell lets you test a flow, renamed to match.
    const [testMode, setTestMode] = useState('text');
    const [persona, setPersona] = useState('A regular customer calling in with a typical, realistic request.');
    const [maxTurns, setMaxTurns] = useState(6);
    const [isSimulating, setIsSimulating] = useState(false);
    const [useMocks, setUseMocks] = useState(true);
    const [showTestSettings, setShowTestSettings] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState(''); // live text while speaking
    const [dynamicVariables, setDynamicVariables] = useState({});
    const [showVariables, setShowVariables] = useState(false);
    const dynamicVariablesRef = useRef({});
    dynamicVariablesRef.current = dynamicVariables;
    // Refs so closures always read the latest values
    const isCallActiveRef = useRef(false);
    const currentNodeIdRef = useRef(null);
    const messagesRef = useRef([]);
    const recognitionRef = useRef(null);

    const setCallActive = (val) => {
        isCallActiveRef.current = val;
        setIsCallActive(val);
    };
    const setCurrentNodeSafe = (id) => {
        currentNodeIdRef.current = id;
        setCurrentNodeId(id);
    };
    const addMessage = (msg) => {
        messagesRef.current = [...messagesRef.current, msg];
        setMessages(messagesRef.current);
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        if (!workflowId) {
            alert('Please save the workflow first before testing!');
            return;
        }

        const userMessage = { role: 'user', content: inputText };
        setMessages([...messages, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Call workflow execution API
            console.log('Sending test request:', {
                workflow_id: workflowId,
                user_input: inputText,
                current_node_id: currentNodeId,
                history_length: messages.length
            });

            const cleanVars = Object.fromEntries(
                Object.entries(dynamicVariablesRef.current).filter(([k, v]) => k.trim() && String(v).trim())
            );

            const response = await client.post('/test/workflow', {
                workflow_id: workflowId,
                user_input: inputText,
                // Drop our own "— Flow ended —" system markers before sending — they're UI-only,
                // not part of the actual conversation the LLM should see.
                conversation_history: messages.filter((m) => m.role !== 'system'),
                current_node_id: currentNodeId,
                dynamic_variables: Object.keys(cleanVars).length ? cleanVars : null,
                use_mocks: useMocks,
            });

            // Update current node from response
            if (response.data.node_id && onNodeExecute) {
                setCurrentNodeId(response.data.node_id);
                onNodeExecute(response.data.node_id);
            }

            // Carry forward anything an Extract Variable/Code node just produced, so the next
            // turn (and Logic Split nodes) can see it too.
            if (response.data.variables) {
                setDynamicVariables((prev) => ({ ...prev, ...response.data.variables }));
            }

            if (response.data.success) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.data.response
                }]);
                if (response.data.ended) {
                    setMessages(prev => [...prev, { role: 'system', content: '— Flow ended —' }]);
                }
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Error: ${response.data.response} `
                }]);
            }
        } catch (error) {
            console.error('Failed to execute workflow:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Failed to execute workflow. Make sure OpenAI API key is configured.'
            }]);
        } finally {
            setIsLoading(false);
            setIsLoading(false);
            // Keep the current node active for context and visualization
            // setTimeout(() => {
            //     setCurrentNodeId(null);
            //     if (onNodeExecute) onNodeExecute(null);
            // }, 1000);
        }
    };

    const runSimulation = async () => {
        if (!workflowId) {
            alert('Please save the workflow first before testing!');
            return;
        }
        setIsSimulating(true);
        setMessages([]);
        const cleanVars = Object.fromEntries(
            Object.entries(dynamicVariablesRef.current).filter(([k, v]) => k.trim() && String(v).trim())
        );
        try {
            const response = await client.post('/test/simulate', {
                workflow_id: workflowId,
                persona,
                max_turns: maxTurns,
                dynamic_variables: Object.keys(cleanVars).length ? cleanVars : null,
                use_mocks: useMocks,
            });
            const data = response.data;
            if (data.transcript) setMessages(data.transcript);
            if (data.variables) setDynamicVariables((prev) => ({ ...prev, ...data.variables }));
            if (data.ended) {
                setMessages((prev) => [...prev, { role: 'system', content: '— Flow ended —' }]);
            } else if (!data.success) {
                setMessages((prev) => [...prev, { role: 'system', content: `— Simulation error: ${data.error || 'unknown'} —` }]);
            } else {
                setMessages((prev) => [...prev, { role: 'system', content: `— Simulation stopped after ${data.turns_run} turn(s) —` }]);
            }
        } catch (error) {
            console.error('Simulation failed:', error);
            setMessages([{ role: 'system', content: '— Simulation failed to run —' }]);
        } finally {
            setIsSimulating(false);
        }
    };

    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);

    useEffect(() => {
        // Cleanup audio URL on unmount
        return () => {
            if (window.audioUrl) {
                URL.revokeObjectURL(window.audioUrl);
            }
            stopRecording();
        };
    }, []);

    const startCall = async () => {
        setCallActive(true);
        await sendVoiceMessage(null, true);
    };

    const endCall = () => {
        setCallActive(false);
        stopRecording();
        setLiveTranscript('');
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_) {}
            recognitionRef.current = null;
        }
        if (window._rmvoxAudio) {
            window._rmvoxAudio.pause();
            window._rmvoxAudio = null;
        }
    };

    const startRecording = async () => {
        setLiveTranscript('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/ogg';

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                console.log('Recording stopped | Call active:', isCallActiveRef.current, '| Chunks:', chunks.length);
                stream.getTracks().forEach(t => t.stop());
                if (recognitionRef.current) {
                    try { recognitionRef.current.abort(); } catch (_) {}
                    recognitionRef.current = null;
                }
                setLiveTranscript('');
                const audioBlob = new Blob(chunks, { type: mimeType });
                console.log('Audio blob size:', audioBlob.size);
                if (isCallActiveRef.current && audioBlob.size > 500) {
                    await sendVoiceMessage(audioBlob);
                } else if (isCallActiveRef.current) {
                    // Too short / silence — restart listening
                    console.log('Audio too short, restarting...');
                    startRecording();
                }
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            console.log('Recording started, waiting for speech...');

            // ── Primary stop trigger: SpeechRecognition speech events ──
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'hi-IN';
                recognitionRef.current = recognition;

                let speechEndTimer = null;

                recognition.onresult = (event) => {
                    // Build interim text
                    let interim = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        interim += event.results[i][0].transcript;
                    }
                    setLiveTranscript(interim);

                    // Reset the auto-stop timer every time new speech comes in
                    clearTimeout(speechEndTimer);
                    speechEndTimer = setTimeout(() => {
                        // 1.5s with no new speech → user stopped talking → stop recorder
                        console.log('Speech inactivity timer fired → stopping recorder');
                        if (recorder.state !== 'inactive') {
                            setIsRecording(false);
                            setMediaRecorder(null);
                            recorder.stop();
                        }
                    }, 1500);
                };

                // onspeechend fires immediately when speech pauses — use as fast stop
                recognition.onspeechend = () => {
                    console.log('SpeechRecognition: speech ended → stopping recorder in 800ms');
                    clearTimeout(speechEndTimer);
                    speechEndTimer = setTimeout(() => {
                        if (recorder.state !== 'inactive') {
                            setIsRecording(false);
                            setMediaRecorder(null);
                            recorder.stop();
                        }
                    }, 800);
                };

                recognition.onerror = (e) => {
                    console.warn('SpeechRecognition error:', e.error);
                    // If recognition fails, fall back to a backup timer
                    if (e.error === 'no-speech' || e.error === 'aborted') return;
                };

                recognition.onend = () => {
                    // Recognition ended — if recorder still going & call active, stop recorder
                    if (recorder.state !== 'inactive' && isCallActiveRef.current) {
                        console.log('SpeechRecognition ended → stopping recorder');
                        setIsRecording(false);
                        setMediaRecorder(null);
                        recorder.stop();
                    }
                };

                recognition.start();

                // ── Backup VAD: if SpeechRecognition never fires (e.g. user speaks Hindi
                //    and lang mismatch), use audio level after 8s max recording ──
                const MAX_RECORDING_MS = 8000;
                setTimeout(() => {
                    if (recorder.state !== 'inactive') {
                        console.log('Max recording time reached → stopping');
                        clearTimeout(speechEndTimer);
                        setIsRecording(false);
                        setMediaRecorder(null);
                        recorder.stop();
                    }
                }, MAX_RECORDING_MS);

            } else {
                // No SpeechRecognition (Firefox) — use simple 5s max timer
                console.warn('SpeechRecognition not supported, using timer fallback');
                setTimeout(() => {
                    if (recorder.state !== 'inactive') {
                        setIsRecording(false);
                        setMediaRecorder(null);
                        recorder.stop();
                    }
                }, 5000);
            }

        } catch (error) {
            console.error('Microphone error:', error);
            alert('Could not access microphone. Please allow microphone permission in browser.');
            setCallActive(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const playAudioResponse = (base64Audio, continueListening = true) => {
        try {
            const binaryString = window.atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            // Sarvam returns WAV (PCM), ElevenLabs returns MP3
            const audioBlob = new Blob([bytes], { type: 'audio/wav' });

            if (window._rmvoxAudioUrl) URL.revokeObjectURL(window._rmvoxAudioUrl);
            window._rmvoxAudioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(window._rmvoxAudioUrl);
            window._rmvoxAudio = audio;

            audio.addEventListener('ended', () => {
                console.log('Audio ended. Call active:', isCallActiveRef.current, '| continueListening:', continueListening);
                if (isCallActiveRef.current && continueListening) startRecording();
                else if (!continueListening) setCallActive(false);
            });

            audio.addEventListener('error', (e) => {
                console.error('Audio playback error:', e);
                if (isCallActiveRef.current && continueListening) startRecording();
            });

            audio.play().catch(err => {
                console.error('Play failed:', err);
                if (isCallActiveRef.current && continueListening) startRecording();
            });
        } catch (error) {
            console.error('Error playing audio:', error);
            setCallActive(false);
        }
    };

    const sendVoiceMessage = async (audioBlob, isInitial = false) => {
        if (!workflowId) {
            alert('Please save the workflow first!');
            setCallActive(false);
            return;
        }

        setIsLoading(true);

        const formData = new FormData();
        if (audioBlob && audioBlob.size > 100) {
            formData.append('audio', audioBlob, 'audio.webm');
        } else {
            // Initial trigger — send empty silent blob
            formData.append('audio', new Blob([], { type: 'audio/webm' }), 'audio.webm');
        }

        formData.append('workflow_id', workflowId);
        if (currentNodeIdRef.current) formData.append('current_node_id', currentNodeIdRef.current);
        formData.append('conversation_history', JSON.stringify(messagesRef.current.filter((m) => m.role !== 'system')));
        const cleanVars = Object.fromEntries(
            Object.entries(dynamicVariablesRef.current).filter(([k, v]) => k.trim() && String(v).trim())
        );
        formData.append('dynamic_variables', JSON.stringify(cleanVars));
        formData.append('use_mocks', useMocks ? 'true' : 'false');

        try {
            const response = await client.post('/test/voice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const data = response.data;
            console.log('Voice response:', data);

            if (data.success) {
                if (!isInitial && data.transcription) {
                    addMessage({ role: 'user', content: data.transcription });
                }
                addMessage({ role: 'assistant', content: data.response });

                if (data.variables) {
                    setDynamicVariables((prev) => ({ ...prev, ...data.variables }));
                }

                if (data.node_id) {
                    setCurrentNodeSafe(data.node_id);
                    if (onNodeExecute) onNodeExecute(data.node_id);
                }

                if (data.ended) {
                    addMessage({ role: 'system', content: '— Flow ended, call will hang up —' });
                }

                if (data.audio_base64) {
                    playAudioResponse(data.audio_base64, !data.ended);
                } else if (isCallActiveRef.current && !data.ended) {
                    startRecording();
                } else if (data.ended) {
                    setCallActive(false);
                }
            } else {
                addMessage({ role: 'assistant', content: `Error: ${data.response}` });
                setCallActive(false);
            }
        } catch (error) {
            console.error('Voice test failed:', error);
            addMessage({ role: 'assistant', content: 'Error: Voice processing failed.' });
            setCallActive(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`relative h-full flex flex-col bg-card border-l border-border shrink-0 transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-72'
            }`}>
            {/* Collapse/Expand Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-card border border-border rounded-l-md p-2 hover:bg-accent"
            >
                {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {!isCollapsed && (
                <>
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Test Workflow</h2>
                        <button onClick={onClose} className="p-1 hover:bg-accent rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Mode Selector — same three testing modes Retell offers, renamed to match:
                        Test LLM (text-only, fast), Test Audio (full voice round-trip), AI Simulate
                        (an LLM plays the caller automatically). */}
                    <div className="px-3 py-2 border-b border-border flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => { setTestMode('text'); setIsCallActive(false); stopRecording(); }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md ${testMode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                } `}
                        >
                            <MessageCircle className="w-3 h-3" />
                            Test LLM
                        </button>
                        <button
                            onClick={() => setTestMode('voice')}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md ${testMode === 'voice' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                } `}
                        >
                            <Mic className="w-3 h-3" />
                            Test Audio
                        </button>
                        <button
                            onClick={() => { setTestMode('simulate'); setIsCallActive(false); stopRecording(); }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md ${testMode === 'simulate' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                } `}
                        >
                            <Bot className="w-3 h-3" />
                            AI Simulate
                        </button>
                        <button
                            onClick={() => setShowVariables(!showVariables)}
                            title="Dynamic variables (e.g. override the call's language)"
                            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md ml-auto ${showVariables ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                } `}
                        >
                            <Braces className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setShowTestSettings(!showTestSettings)}
                            title="Test settings (mocks, ...)"
                            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md ${showTestSettings ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                                } `}
                        >
                            <Settings2 className="w-3 h-3" />
                        </button>
                    </div>

                    {showVariables && (
                        <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                            <DynamicVariablesEditor variables={dynamicVariables} onChange={setDynamicVariables} compact />
                        </div>
                    )}

                    {showTestSettings && (
                        <div className="px-3 py-2.5 border-b border-border bg-muted/30 space-y-1.5">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useMocks}
                                    onChange={(e) => setUseMocks(e.target.checked)}
                                    className="rounded"
                                />
                                Use mock responses for Custom Function / MCP nodes
                            </label>
                            <p className="text-[10px] text-muted-foreground pl-5">
                                Only affects nodes with a mock configured in Node Settings — avoids sending a
                                real SMS/Slack message/API call every time you test this flow.
                            </p>
                        </div>
                    )}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.length === 0 ? (
                            <div className="text-center text-muted-foreground mt-8">
                                {testMode === 'text' && 'Start typing to test your workflow...'}
                                {testMode === 'voice' && 'Click "Start Call" to begin...'}
                                {testMode === 'simulate' && 'Describe a caller persona below, then run the simulation...'}
                            </div>
                        ) : (
                            messages.map((msg, idx) => msg.role === 'system' ? (
                                <div key={idx} className="flex justify-center">
                                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground italic">
                                        {msg.content}
                                    </span>
                                </div>
                            ) : (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} `}
                                >
                                    <div
                                        className={`max-w-[70%] p-3 rounded-lg ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                            } `}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted px-3 py-2 rounded-lg animate-pulse text-sm">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        {/* Live transcript bubble — shows while user is speaking */}
                        {isRecording && liveTranscript && (
                            <div className="flex justify-end">
                                <div className="max-w-[75%] px-3 py-2 rounded-lg bg-primary/30 border border-primary/50 text-sm italic text-primary-foreground/80">
                                    <span className="text-[10px] text-primary/70 block mb-0.5">🎙 Speaking...</span>
                                    {liveTranscript}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-2 border-t border-border">
                        {testMode === 'simulate' ? (
                            <div className="space-y-1.5">
                                <textarea
                                    rows={2}
                                    value={persona}
                                    onChange={(e) => setPersona(e.target.value)}
                                    placeholder="Describe the simulated caller, e.g. 'An impatient customer who wants a refund'..."
                                    disabled={isSimulating}
                                    className="w-full p-2 text-xs rounded-md border border-input bg-background disabled:opacity-60"
                                />
                                <div className="flex items-center gap-1.5">
                                    <label className="text-xs text-muted-foreground shrink-0">Max turns</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={maxTurns}
                                        onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 6)}
                                        disabled={isSimulating}
                                        className="w-16 p-1.5 text-xs rounded-md border border-input bg-background disabled:opacity-60"
                                    />
                                    <button
                                        onClick={runSimulation}
                                        disabled={isSimulating}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {isSimulating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        {isSimulating ? 'Simulating...' : 'Run Simulation'}
                                    </button>
                                </div>
                            </div>
                        ) : testMode === 'text' ? (
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="Type your message..."
                                    className="flex-1 px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                                />
                                <button
                                    onClick={sendMessage}
                                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                                >
                                    Send
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                {!isCallActive ? (
                                    <button
                                        onClick={startCall}
                                        className="px-5 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold shadow transition-all hover:scale-105"
                                    >
                                        Start Call
                                    </button>
                                ) : (
                                    <div className="w-full flex flex-col items-center gap-1.5">
                                        <div
                                            onClick={() => isRecording && stopRecording()}
                                            className={`p-4 rounded-full transition-all duration-300 cursor-pointer ${isRecording
                                                ? 'bg-red-500 animate-pulse scale-110 shadow-lg shadow-red-500/50'
                                                : 'bg-blue-500 animate-pulse'
                                                } text-white`}>
                                            <Mic className={`w-5 h-5 ${isRecording ? 'animate-bounce' : ''}`} />
                                        </div>
                                        {/* Live transcript shown inline in voice area */}
                                        {isRecording && liveTranscript ? (
                                            <p className="text-[10px] text-center text-primary italic px-2 leading-tight">
                                                🎙 {liveTranscript}
                                            </p>
                                        ) : (
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {isRecording ? 'Listening...' : 'Agent Speaking...'}
                                            </span>
                                        )}
                                        <button
                                            onClick={endCall}
                                            className="px-3 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-md font-medium"
                                        >
                                            End Call
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default TestingPanel;
