import { useState, useEffect } from 'react';
import { 
  Bot, 
  Volume2, 
  Brain, 
  Mic, 
  Clock, 
  MessageSquare,
  Link,
  ChevronDown,
  ChevronUp,
  Phone,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { d1Client } from '../../lib/d1';
import type { Webhook as WebhookType } from '../../types';
import { VoiceTest, type VapiCallEvent } from '../VoiceTest';

// Voice options matching existing components
const VOICE_OPTIONS = [
  { id: 'Paige', name: 'Paige', description: '26 year old white female - Deeper tone, Calming, Professional' },
  { id: 'Rohan', name: 'Rohan', description: '24 years old male - Indian american, Bright, Optimistic, Cheerful, Energetic' },
  { id: 'Hana', name: 'Hana', description: '22 year old female - Asian, Soft, Soothing, Gentle' },
  { id: 'Elliot', name: 'Elliot', description: '25 years old male - Canadian, Soothing, Friendly, Professional' },
  { id: 'Cole', name: 'Cole', description: '22 year old white male - Deeper tone, Calming, Professional' },
  { id: 'Harry', name: 'Harry', description: '24 year old white male - Clear, Energetic, Professional' },
  { id: 'Spencer', name: 'Spencer', description: '26 year old female - Energetic, Quirky, Lighthearted, Cheeky, Amused' },
  { id: 'Kylie', name: 'Kylie', description: 'Age 23, Female - American' },
  { id: 'Lily', name: 'Lily', description: 'Female voice' },
  { id: 'Neha', name: 'Neha', description: 'Female voice' },
  { id: 'Savannah', name: 'Savannah', description: '25 years old female - American' },
];

const MODEL_OPTIONS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, best for complex tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, fastest response' },
];

const TRANSCRIBER_OPTIONS = [
  { id: 'nova-2-phonecall', name: 'Nova 2 Phone Call', description: 'Optimized for phone calls' },
  { id: 'nova-2-general', name: 'Nova 2 General', description: 'General purpose' },
  { id: 'nova-2-meeting', name: 'Nova 2 Meeting', description: 'Optimized for meetings' },
];

export interface AgentConfig {
  name: string;
  voiceId: string;
  model: string;
  temperature: number;
  transcriberModel: string;
  silenceTimeout: number;
  firstMessage: string;
  webhookId: string;
}

interface AgentConfigPanelProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  createdAssistantId?: string | null;
  publicKey?: string | null;
  onCallEvent?: (event: VapiCallEvent) => void;  // Callback for real-time flow visualization
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AgentConfigPanel({ config, onChange, createdAssistantId, publicKey, onCallEvent, isCollapsed = false, onToggleCollapse }: AgentConfigPanelProps) {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    voice: true,
    model: false,
    advanced: false,
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoadingWebhooks(true);
      const webhookList = await d1Client.listWebhooks();
      const activeWebhooks = webhookList.filter(w => w.is_active);
      setWebhooks(activeWebhooks);
      
      // Auto-select first webhook if none selected
      if (!config.webhookId && activeWebhooks.length > 0) {
        onChange({ ...config, webhookId: activeWebhooks[0].id });
      }
    } catch (error) {
      console.error('Error loading webhooks:', error);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedVoice = VOICE_OPTIONS.find(v => v.id === config.voiceId);
  const selectedModel = MODEL_OPTIONS.find(m => m.id === config.model);

  // Collapsed state - minimal sidebar
  if (isCollapsed) {
    return (
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300 ease-out">
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        {/* Vertical icons for quick reference */}
        <div className="flex-1 flex flex-col items-center pt-2 gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center" title="Agent Config">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          {createdAssistantId && publicKey && (
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center animate-pulse" title="Voice Test Available">
              <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden transition-all duration-300 ease-out">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Agent Configuration
          </h2>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure your voice AI agent
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Voice Test Section - Show when agent is created */}
        {createdAssistantId && publicKey && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Voice Test</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Test your AI assistant with a web call
              </p>
              <VoiceTest
                assistantId={createdAssistantId}
                publicKey={publicKey}
                onCallEvent={onCallEvent}
              />
            </div>
          </div>
        )}

        {/* Basic Settings */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Basic Info
            </span>
            {expandedSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.basic && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => onChange({ ...config, name: e.target.value })}
                  placeholder="e.g., Customer Support Agent"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  First Message
                </label>
                <textarea
                  value={config.firstMessage}
                  onChange={(e) => onChange({ ...config, firstMessage: e.target.value })}
                  placeholder="Hello! How can I help you today?"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Voice Settings */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('voice')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Voice
            </span>
            {expandedSections.voice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.voice && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Voice
                </label>
                <select
                  value={config.voiceId}
                  onChange={(e) => onChange({ ...config, voiceId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {VOICE_OPTIONS.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                {selectedVoice && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedVoice.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Model Settings */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('model')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Model
            </span>
            {expandedSections.model ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.model && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => onChange({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedModel.description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Temperature: {config.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => onChange({ ...config, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('advanced')}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Advanced
            </span>
            {expandedSections.advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expandedSections.advanced && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transcriber Model
                </label>
                <select
                  value={config.transcriberModel}
                  onChange={(e) => onChange({ ...config, transcriberModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {TRANSCRIBER_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Silence Timeout (seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={config.silenceTimeout}
                  onChange={(e) => onChange({ ...config, silenceTimeout: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  How long to wait for user response before AI continues. Higher values (15-30s) give users more time to respond at decision points.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Link className="w-4 h-4 inline mr-1" />
                  Webhook
                </label>
                {loadingWebhooks ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading webhooks...</div>
                ) : webhooks.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No webhooks available</div>
                ) : (
                  <select
                    value={config.webhookId}
                    onChange={(e) => onChange({ ...config, webhookId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">No webhook</option>
                    {webhooks.map((webhook) => (
                      <option key={webhook.id} value={webhook.id}>
                        {webhook.name || webhook.webhook_url}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const defaultAgentConfig: AgentConfig = {
  name: '',
  voiceId: 'Kylie',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  transcriberModel: 'nova-2-phonecall',
  silenceTimeout: 20,
  firstMessage: 'Hello! How can I help you today?',
  webhookId: '',
};

