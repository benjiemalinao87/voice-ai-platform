/**
 * AI Flow Chat Sidebar
 * Chat interface for AI-powered flow generation
 */

import { useState, useRef, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Wand2,
  MessageSquare
} from 'lucide-react';
import { generateFlowFromPrompt, autoLayoutNodes, type GeneratedFlow } from './aiFlowGenerator';
import type { FlowNodeData } from './flowToPrompt';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  flowGenerated?: boolean;
  error?: boolean;
}

interface AiFlowChatProps {
  isOpen: boolean;
  onClose: () => void;
  onFlowGenerated: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
}

export function AiFlowChat({ isOpen, onClose, onFlowGenerated }: AiFlowChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your AI Flow Assistant. Describe the voice agent you want to create, and I\'ll generate the flow for you.\n\nExample: "Create a pizza ordering agent with 3 pizza options and a transfer option for complaints"'
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    // Add thinking message
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'system',
      content: 'Generating your flow...'
    }]);

    try {
      const result = await generateFlowFromPrompt(userMessage.content);

      // Remove thinking message
      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      if (result.success && result.flow) {
        // Auto-layout the nodes for better visual arrangement
        const layoutedNodes = autoLayoutNodes(result.flow.nodes, result.flow.edges);
        
        // Apply the generated flow
        onFlowGenerated(layoutedNodes, result.flow.edges);

        // Add success message
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `✨ ${result.flow.summary}\n\nI've created ${result.flow.nodes.length} nodes with ${result.flow.edges.length} connections. You can now edit the flow on the canvas.`,
          flowGenerated: true
        }]);
      } else {
        // Add error message
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I couldn't generate the flow: ${result.error}\n\nPlease try rephrasing your request or check your OpenAI API key in Settings.`,
          error: true
        }]);
      }
    } catch (error: any) {
      // Remove thinking message
      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `An error occurred: ${error.message}\n\nPlease try again.`,
        error: true
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 w-96 h-screen bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">AI Flow Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'system' ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {message.content}
              </div>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : message.error
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md'
                    : message.flowGenerated
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-bl-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    {message.flowGenerated ? (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : message.error ? (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    )}
                    <span className="text-xs font-medium opacity-70">AI Assistant</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Examples */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick examples:</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            'Pizza ordering with 3 options',
            'Appointment booking agent',
            'Customer support with transfer'
          ].map((example, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(example)}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-300 rounded-full transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your voice agent..."
              disabled={isGenerating}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Powered by GPT-4o • Generates complete flow structure
        </p>
      </form>
    </div>
  );
}

