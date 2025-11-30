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
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Template categories with examples
const TEMPLATE_CATEGORIES = [
  {
    name: 'General',
    icon: '🎯',
    templates: [
      'Pizza ordering with 3 options',
      'Appointment booking agent',
      'Customer support with transfer',
      'FAQ bot with 5 common questions',
    ]
  },
  {
    name: 'Home Services',
    icon: '🏠',
    templates: [
      'HVAC service scheduling with emergency option',
      'Plumbing quote request with issue types',
      'Roofing inspection booking agent',
      'Window installation consultation',
      'Landscaping estimate scheduler',
    ]
  },
  {
    name: 'Home Improvement',
    icon: '🔨',
    templates: [
      'Kitchen remodel consultation booking',
      'Bathroom renovation quote agent',
      'Flooring installation scheduler',
      'Painting estimate with room options',
      'General contractor callback request',
    ]
  },
  {
    name: 'Solar & Energy',
    icon: '☀️',
    templates: [
      'Solar panel consultation booking',
      'Energy audit scheduling agent',
      'EV charger installation inquiry',
      'Home battery consultation',
    ]
  },
  {
    name: 'Healthcare',
    icon: '🏥',
    templates: [
      'Medical appointment scheduling',
      'Prescription refill request',
      'Insurance verification agent',
      'Patient callback scheduler',
    ]
  },
  {
    name: 'Real Estate',
    icon: '🏡',
    templates: [
      'Property showing scheduler',
      'Home valuation request agent',
      'Rental inquiry with property types',
      'Open house RSVP booking',
    ]
  },
];
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
      content: 'Hi! I\'m your AI Flow Assistant. Describe the voice agent you want to create, and I\'ll generate the flow for you.\n\nBrowse templates below or type your own description!'
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const currentCategory = TEMPLATE_CATEGORIES[currentCategoryIndex];
  
  const nextCategory = () => {
    setCurrentCategoryIndex((prev) => 
      prev === TEMPLATE_CATEGORIES.length - 1 ? 0 : prev + 1
    );
  };
  
  const prevCategory = () => {
    setCurrentCategoryIndex((prev) => 
      prev === 0 ? TEMPLATE_CATEGORIES.length - 1 : prev - 1
    );
  };

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

      {/* Quick Examples with Pagination */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        {/* Category Navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevCategory}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{currentCategory.icon}</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {currentCategory.name}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({currentCategoryIndex + 1}/{TEMPLATE_CATEGORIES.length})
            </span>
          </div>
          <button
            onClick={nextCategory}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Category Dots */}
        <div className="flex justify-center gap-1 mb-2">
          {TEMPLATE_CATEGORIES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentCategoryIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentCategoryIndex 
                  ? 'bg-purple-500' 
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        
        {/* Templates */}
        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
          {currentCategory.templates.map((template, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(template)}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-300 rounded-lg transition-colors text-left truncate"
              title={template}
            >
              {template}
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

