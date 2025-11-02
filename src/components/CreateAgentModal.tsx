import { useState, useEffect } from 'react';
import { X, Bot, Volume2, MessageSquare, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import type { Agent, Webhook as WebhookType } from '../types';
import { d1Client } from '../lib/d1';
import { SystemPromptHelper } from './SystemPromptHelper';

interface CreateAgentModalProps {
  onClose: () => void;
  onCreate: (agentData: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'api_key'>, webhookUrl?: string) => Promise<void>;
}

// Voice options matching VoiceAgentsList and AgentConfig
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

export function CreateAgentModal({ onClose, onCreate }: CreateAgentModalProps) {
  const [creating, setCreating] = useState(false);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [showPromptHelper, setShowPromptHelper] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    voice_id: 'Kylie',
    voice_name: 'Kylie',
    system_prompt: '',
    conversation_prompt: '',
    tone: 'professional' as 'professional' | 'friendly' | 'casual',
    response_style: 'adaptive' as 'concise' | 'detailed' | 'adaptive',
    is_active: true,
    phone_number: null as string | null,
  });

  // Fetch available webhooks on mount
  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoadingWebhooks(true);
      const webhookList = await d1Client.listWebhooks();
      const activeWebhooks = webhookList.filter(w => w.is_active);
      setWebhooks(activeWebhooks);

      // Automatically select the first available webhook
      if (activeWebhooks.length > 0) {
        setSelectedWebhookId(activeWebhooks[0].id);
      }
    } catch (error) {
      console.error('Error loading webhooks:', error);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter an agent name');
      return;
    }

    if (!formData.system_prompt.trim()) {
      alert('Please enter a system prompt');
      return;
    }

    try {
      setCreating(true);

      // Get selected webhook URL if one is selected
      const webhookUrl = selectedWebhookId
        ? webhooks.find(w => w.id === selectedWebhookId)?.webhook_url
        : undefined;

      await onCreate(formData, webhookUrl);
      onClose();
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    setFormData({
      ...formData,
      voice_id: voiceId,
      voice_name: voiceId,
    });
  };

  const selectedVoice = VOICE_OPTIONS.find(v => v.id === formData.voice_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Create Voice AI Agent
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Agent Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Bot className="w-4 h-4" />
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Customer Support Agent"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          {/* Voice Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Volume2 className="w-4 h-4" />
              Voice *
            </label>
            <select
              value={formData.voice_id}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
            {selectedVoice && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {selectedVoice.description}
              </p>
            )}
          </div>

          {/* Behavior Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <SettingsIcon className="w-4 h-4" />
                Tone
              </label>
              <select
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <SettingsIcon className="w-4 h-4" />
                Response Style
              </label>
              <select
                value={formData.response_style}
                onChange={(e) => setFormData({ ...formData, response_style: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
                <option value="adaptive">Adaptive</option>
              </select>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <MessageSquare className="w-4 h-4" />
                System Prompt *
              </label>
              <button
                type="button"
                onClick={() => setShowPromptHelper(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Helper
              </button>
            </div>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="Define the agent's role, personality, and behavior..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={6}
              required
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This is the core instruction that defines how the AI agent behaves. Click "AI Helper" for guided prompt generation.
            </p>
          </div>

          {/* First Message */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4" />
              First Message (Opening Greeting)
            </label>
            <textarea
              value={formData.conversation_prompt}
              onChange={(e) => setFormData({ ...formData, conversation_prompt: e.target.value })}
              placeholder="Hello! How can I help you today?"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The first message the agent says when a call starts
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              Activate agent immediately after creation
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Voice AI Agent'}
          </button>
        </div>
      </div>

      {/* System Prompt Helper Modal */}
      {showPromptHelper && (
        <SystemPromptHelper
          onGenerate={(prompt, firstMessage) => {
            setFormData({
              ...formData,
              system_prompt: prompt,
              conversation_prompt: firstMessage
            });
            setShowPromptHelper(false);
          }}
          onClose={() => setShowPromptHelper(false)}
        />
      )}
    </div>
  );
}
