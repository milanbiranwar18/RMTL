import {
    PhoneForwarded, Hash, Users, MessageCircle, Code2, PhoneOff, Variable, Webhook, PlugZap,
    Clock, Mail, Volume2, ListTree, Keyboard, Settings, Send, Smartphone,
} from 'lucide-react';
import { createSimpleNode } from './SimpleNode';

export const CallTransferNode = createSimpleNode({
    icon: PhoneForwarded,
    borderClass: 'border-blue-500',
    iconClass: 'text-blue-500',
    title: 'Call Transfer',
    preview: (d) => d.transferNumber ? `Transfer to ${d.transferNumber}` : 'Set a transfer number...',
});

export const PressDigitNode = createSimpleNode({
    icon: Hash,
    borderClass: 'border-purple-500',
    iconClass: 'text-purple-500',
    title: 'Press Digit',
    preview: (d) => d.digits ? `Send DTMF: ${d.digits}` : 'Set digits to send...',
});

export const AgentTransferNode = createSimpleNode({
    icon: Users,
    borderClass: 'border-indigo-500',
    iconClass: 'text-indigo-500',
    title: 'Agent Transfer',
    preview: (d) => d.targetAgentName ? `Hand off to ${d.targetAgentName}` : 'Pick a target agent...',
});

export const InCallSmsNode = createSimpleNode({
    icon: MessageCircle,
    borderClass: 'border-teal-500',
    iconClass: 'text-teal-500',
    title: 'In-Call SMS',
    preview: (d) => d.message ? d.message : 'Set the SMS message...',
});

export const ExtractVariableNode = createSimpleNode({
    icon: Variable,
    borderClass: 'border-cyan-500',
    iconClass: 'text-cyan-500',
    title: 'Extract Variable',
    preview: (d) => (d.variables || []).length
        ? `Extract: ${(d.variables || []).map(v => v.name).filter(Boolean).join(', ')}`
        : 'Define variables to extract...',
});

export const CodeNode = createSimpleNode({
    icon: Code2,
    borderClass: 'border-slate-500',
    iconClass: 'text-slate-500',
    title: 'Code',
    preview: (d) => d.expression ? `${d.outputVariable || 'result'} = ${d.expression}` : 'Set an expression...',
});

export const CustomFunctionNode = createSimpleNode({
    icon: Webhook,
    borderClass: 'border-pink-500',
    iconClass: 'text-pink-500',
    title: 'Custom Function',
    preview: (d) => d.url ? `${d.method || 'POST'} ${d.url}` : 'Configure an API endpoint to call...',
});

export const McpToolCallNode = createSimpleNode({
    icon: PlugZap,
    borderClass: 'border-violet-500',
    iconClass: 'text-violet-500',
    title: 'MCP Tool Call',
    preview: (d) => d.toolName ? `Call "${d.toolName}" on an MCP server` : 'Connect to an MCP server...',
});

export const EndingNode = createSimpleNode({
    icon: PhoneOff,
    borderClass: 'border-red-500',
    iconClass: 'text-red-500',
    title: 'Ending',
    preview: (d) => d.endMessage || 'Ends the call after speaking this message.',
    noOutput: true,
});

// New workflow nodes

export const WaitDelayNode = createSimpleNode({
    icon: Clock,
    borderClass: 'border-gray-500',
    iconClass: 'text-gray-500',
    title: 'Wait/Delay',
    preview: (d) => d.delaySeconds ? `Wait ${d.delaySeconds} second${d.delaySeconds !== 1 ? 's' : ''}` : 'Set wait duration...',
});

export const SetVariableNode = createSimpleNode({
    icon: Settings,
    borderClass: 'border-fuchsia-500',
    iconClass: 'text-fuchsia-500',
    title: 'Set Variable',
    preview: (d) => d.variableName ? `${d.variableName} = ${d.variableValue || '...'}` : 'Set a variable name...',
});

export const SendWhatsAppNode = createSimpleNode({
    icon: Send,
    borderClass: 'border-green-500',
    iconClass: 'text-green-500',
    title: 'Send WhatsApp',
    preview: (d) => d.toNumber ? `WhatsApp to ${d.toNumber}` : 'Configure WhatsApp message...',
});

export const SendSmsNode = createSimpleNode({
    icon: Smartphone,
    borderClass: 'border-blue-500',
    iconClass: 'text-blue-500',
    title: 'Send SMS',
    preview: (d) => d.toNumber ? `SMS to ${d.toNumber}` : 'Configure SMS message...',
});

export const SendEmailNode = createSimpleNode({
    icon: Mail,
    borderClass: 'border-red-400',
    iconClass: 'text-red-400',
    title: 'Send Email',
    preview: (d) => d.toEmail ? `Email to ${d.toEmail}` : 'Configure email...',
});

export const PlayAudioNode = createSimpleNode({
    icon: Volume2,
    borderClass: 'border-purple-500',
    iconClass: 'text-purple-500',
    title: 'Play Audio',
    preview: (d) => d.audioUrl ? 'Play audio file' : 'Set audio URL...',
});

export const MenuIvrNode = createSimpleNode({
    icon: ListTree,
    borderClass: 'border-green-400',
    iconClass: 'text-green-400',
    title: 'Menu/IVR',
    preview: (d) => (d.options || []).length ? `${(d.options || []).length} menu option${(d.options || []).length !== 1 ? 's' : ''}` : 'Configure menu options...',
});

export const CollectInputNode = createSimpleNode({
    icon: Keyboard,
    borderClass: 'border-lime-400',
    iconClass: 'text-lime-400',
    title: 'Collect Input',
    preview: (d) => d.inputType ? `Collect ${d.inputType} as "${d.variableName || 'collected_input'}"` : 'Configure input type...',
});
