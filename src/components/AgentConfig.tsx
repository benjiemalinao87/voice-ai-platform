import { useEffect, useState } from 'react';
import {
  Volume2,
  MessageSquare,
  Settings,
  Key,
  Power,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { agentApi } from '../lib/api';
import { VoiceTest } from './VoiceTest';
import { vapiConfig } from '../lib/vapi';
import type { Agent } from '../types';

interface AgentConfigProps {
  agentId: string;
}

const VOICE_OPTIONS = [
  { id: 'en-US-neural-pro-1', name: 'Professional Female Voice', language: 'English' },
  { id: 'en-US-neural-pro-2', name: 'Professional Male Voice', language: 'English' },
  { id: 'en-US-neural-casual-1', name: 'Friendly Female Voice', language: 'English' },
  { id: 'en-US-neural-casual-2', name: 'Friendly Male Voice', language: 'English' },
  { id: 'es-US-neural-1', name: 'Spanish Professional Voice', language: 'Spanish' },
  { id: 'es-US-neural-2', name: 'Spanish Friendly Voice', language: 'Spanish' },
];

const TONE_OPTIONS = ['professional', 'friendly', 'casual'] as const;
const STYLE_OPTIONS = ['concise', 'detailed', 'adaptive'] as const;

export function AgentConfig({ agentId }: AgentConfigProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Agent>>({});

  useEffect(() => {
    loadAgent();
  }, [agentId]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const data = await agentApi.getById(agentId);
      setAgent(data);
      setFormData(data || {});
    } catch (error) {
      console.error('Error loading agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agent) return;

    setSaving(true);
    try {
      const updated = await agentApi.update(agent.id, formData);
      setAgent(updated);
      setEditMode(null);
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!agent) return;

    try {
      const updated = await agentApi.update(agent.id, { is_active: !agent.is_active });
      setAgent(updated);
    } catch (error) {
      console.error('Error toggling agent status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Agent not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure agent behavior and settings</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleActive}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                agent.is_active
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Power className="w-4 h-4" />
              {agent.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>

        {/* Voice Test Section - Moved to top for easy access */}
        {vapiConfig.publicKey && (
          <div className="mb-6">
            <VoiceTest
              assistantId={agent.id}
              publicKey={vapiConfig.publicKey}
            />
          </div>
        )}

        <div className="space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Voice Selection</h3>
              </div>
              {editMode !== 'voice' && (
                <button
                  onClick={() => setEditMode('voice')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editMode === 'voice' ? (
              <div className="space-y-3">
                <select
                  value={formData.voice_id}
                  onChange={(e) => {
                    const voice = VOICE_OPTIONS.find(v => v.id === e.target.value);
                    setFormData({
                      ...formData,
                      voice_id: e.target.value,
                      voice_name: voice?.name || ''
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {VOICE_OPTIONS.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.language})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(null);
                      setFormData(agent);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.voice_name}</p>
              </div>
            )}
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Behavior Settings</h3>
              </div>
              {editMode !== 'behavior' && (
                <button
                  onClick={() => setEditMode('behavior')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editMode === 'behavior' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tone
                  </label>
                  <select
                    value={formData.tone}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value as Agent['tone'] })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Response Style
                  </label>
                  <select
                    value={formData.response_style}
                    onChange={(e) => setFormData({ ...formData, response_style: e.target.value as Agent['response_style'] })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {STYLE_OPTIONS.map((style) => (
                      <option key={style} value={style}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(null);
                      setFormData(agent);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tone:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{agent.tone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Response Style:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{agent.response_style}</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Prompts</h3>
              </div>
              {editMode !== 'prompts' && (
                <button
                  onClick={() => setEditMode('prompts')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editMode === 'prompts' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    System Prompt
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Defines the AI's personality, behavior, and instructions
                  </p>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter system prompt..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Message
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    The AI's opening greeting when the call starts
                  </p>
                  <textarea
                    value={formData.conversation_prompt}
                    onChange={(e) => setFormData({ ...formData, conversation_prompt: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="E.g., Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(null);
                      setFormData(agent);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">System Prompt</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap">{agent.system_prompt}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">First Message</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap">{agent.conversation_prompt}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API Access</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">API Key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-gray-800 px-4 py-2 rounded border border-gray-200 dark:border-gray-600 text-sm font-mono text-gray-900 dark:text-gray-100">
                  {agent.api_key || 'No API key generated'}
                </code>
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-medium">
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Use this API key to authenticate requests to your voice AI agent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
