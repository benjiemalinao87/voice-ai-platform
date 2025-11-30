import { useEffect, useState } from 'react';
import {
  Volume2,
  MessageSquare,
  Settings,
  Key,
  Power,
  Edit3,
  Check,
  X,
  PhoneForwarded,
  Users,
  UserSearch,
  Copy,
  Eye,
  Wand2
} from 'lucide-react';
import { agentApi } from '../lib/api';
import { VoiceTest } from './VoiceTest';
import { KnowledgeBase } from './KnowledgeBase';
import { PromptVisualizerModal } from './PromptVisualizerModal';
import { PromptImproverModal } from './PromptImproverModal';
import { useVapi } from '../contexts/VapiContext';
import type { Agent } from '../types';

interface AgentConfigProps {
  agentId: string;
}

const VOICE_OPTIONS = [
  { 
    id: 'Paige', 
    name: 'Paige', 
    description: '26 year old white female - Deeper tone, Calming, Professional',
    tags: ['Professional', 'Calming', 'Deeper tone']
  },
  { 
    id: 'Rohan', 
    name: 'Rohan', 
    description: '24 years old male - Indian american, Bright, Optimistic, Cheerful, Energetic',
    tags: ['Optimistic', 'Cheerful', 'Energetic']
  },
  { 
    id: 'Hana', 
    name: 'Hana', 
    description: '22 year old female - Asian, Soft, Soothing, Gentle',
    tags: ['Soft', 'Soothing', 'Gentle']
  },
  { 
    id: 'Elliot', 
    name: 'Elliot', 
    description: '25 years old male - Canadian, Soothing, Friendly, Professional',
    tags: ['Soothing', 'Friendly', 'Professional']
  },
  { 
    id: 'Cole', 
    name: 'Cole', 
    description: '22 year old white male - Deeper tone, Calming, Professional',
    tags: ['Professional', 'Calming', 'Deeper tone']
  },
  { 
    id: 'Harry', 
    name: 'Harry', 
    description: '24 year old white male - Clear, Energetic, Professional',
    tags: ['Clear', 'Energetic', 'Professional']
  },
  { 
    id: 'Spencer', 
    name: 'Spencer', 
    description: '26 year old female - Energetic, Quirky, Lighthearted, Cheeky, Amused',
    tags: ['Energetic', 'Quirky', 'Lighthearted', 'Cheeky']
  },
  { 
    id: 'Kylie', 
    name: 'Kylie', 
    description: 'Age 23, Female - American',
    tags: ['Female', 'American']
  },
  { 
    id: 'Lily', 
    name: 'Lily', 
    description: 'Female voice',
    tags: ['Female']
  },
  { 
    id: 'Neha', 
    name: 'Neha', 
    description: 'Female voice',
    tags: ['Female']
  },
  { 
    id: 'Savannah', 
    name: 'Savannah', 
    description: '25 years old female - American',
    tags: ['Female', 'American']
  },
];

const TONE_OPTIONS = ['professional', 'friendly', 'casual'] as const;
const STYLE_OPTIONS = ['concise', 'detailed', 'adaptive'] as const;

export function AgentConfig({ agentId }: AgentConfigProps) {
  const { vapiClient, publicKey } = useVapi();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Agent>>({});
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showImprover, setShowImprover] = useState(false);

  useEffect(() => {
    loadAgent();
  }, [agentId, vapiClient]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const data = await agentApi.getById(agentId, vapiClient);
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
      // Only send changed fields
      const updates: Partial<Agent> = {};

      if (editMode === 'voice') {
        updates.voice_id = formData.voice_id;
        updates.voice_name = formData.voice_name;
      } else if (editMode === 'behavior') {
        updates.tone = formData.tone;
        updates.response_style = formData.response_style;
      } else if (editMode === 'prompts') {
        updates.system_prompt = formData.system_prompt;
        updates.conversation_prompt = formData.conversation_prompt;
      }

      const updated = await agentApi.update(agent.id, updates, vapiClient);
      setAgent(updated);
      setFormData(updated);
      setEditMode(null);
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('Failed to save changes. Please check the console for details.');
    } finally {
      setSaving(false);
    }
  };

  // Save improved prompt directly to database
  const handleApplyImprovedPrompt = async (improvedPrompt: string) => {
    if (!agent) return;

    setSaving(true);
    try {
      const updates: Partial<Agent> = {
        system_prompt: improvedPrompt
      };

      const updated = await agentApi.update(agent.id, updates, vapiClient);
      setAgent(updated);
      setFormData(updated);
      setShowImprover(false);
    } catch (error) {
      console.error('Error saving improved prompt:', error);
      alert('Failed to save improved prompt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!agent) return;

    try {
      const updated = await agentApi.update(agent.id, { is_active: !agent.is_active }, vapiClient);
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
        {publicKey && (
          <div className="mb-6">
            <VoiceTest
              assistantId={agent.id}
              publicKey={publicKey}
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
                      {voice.name} - {voice.description}
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
                <div className="flex items-start justify-between">
                  <div className="w-full">
                    {agent.voice_id && (() => {
                      const voice = VOICE_OPTIONS.find(v => v.id === agent.voice_id);
                      if (voice) {
                        return (
                          <>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{voice.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{voice.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {voice.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </>
                        );
                      }
                      return <p className="text-sm text-gray-500 dark:text-gray-400">No voice selected</p>;
                    })()}
                  </div>
                </div>
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
              <div className="flex items-center gap-2">
                {agent?.system_prompt && (
                  <button
                    onClick={() => setShowVisualizer(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 rounded-lg text-sm font-medium transition-colors"
                    title="Visualize prompt flow as mind map"
                  >
                    <Eye className="w-4 h-4" />
                    Visualize Flow
                  </button>
                )}
                {editMode !== 'prompts' && (
                  <button
                    onClick={() => setEditMode('prompts')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {editMode === 'prompts' ? (
              <div className="space-y-4">
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
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">First Message</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap">{agent.conversation_prompt}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">System Prompt</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap">{agent.system_prompt}</p>
                </div>
                
                {/* Improve Prompt Button */}
                {agent.system_prompt && (
                  <button
                    onClick={() => setShowImprover(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-600 dark:text-amber-400 rounded-lg font-medium transition-all group"
                  >
                    <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Improve Prompt</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 rounded-full">AI-Powered</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Knowledge Base Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <KnowledgeBase agentId={agentId} />
          </div>

          {/* Transfer Settings Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transfer Settings</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <PhoneForwarded className="w-4 h-4" />
                  Warm Transfer
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enable AI-initiated warm transfers to connect customers with human agents. The AI will dial the agent first, 
                  wait for them to answer, then connect the customer.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-2 font-medium">
                    To enable AI-triggered transfers:
                  </p>
                  <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    <li>Configure a transfer phone number in <strong>Settings</strong></li>
                    <li>Ensure Twilio credentials are set up</li>
                    <li>Add transfer instructions to the system prompt (e.g., "Transfer to a human agent when the customer requests it")</li>
                  </ol>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Example System Prompt Addition</h4>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
{`If the customer asks to speak with a human agent or representative:
1. Acknowledge their request politely
2. Say "Let me connect you with one of our team members"
3. Use the transferCall function with the configured agent number`}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* CustomerConnect Tool Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <UserSearch className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer Lookup Tool</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enable automatic customer lookup during calls. When the AI collects a phone number, it can fetch customer data 
                  from CustomerConnect to provide personalized context (existing appointments, household members, etc.).
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Setup Required:</strong> Configure your CustomerConnect credentials in{' '}
                    <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">Settings → API Configuration</span>
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tool Configuration</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Add this tool to your VAPI assistant via the VAPI Dashboard or API:
                </p>
                <div className="relative">
                  <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
{`{
  "type": "function",
  "function": {
    "name": "lookup_customer",
    "description": "Look up customer information by phone number. Call this after collecting the customer's phone number to get appointment details and household information.",
    "parameters": {
      "type": "object",
      "properties": {
        "phone_number": {
          "type": "string",
          "description": "Customer phone number (digits only, e.g., 6267888831)"
        }
      },
      "required": ["phone_number"]
    }
  },
  "server": {
    "url": "${window.location.origin}/webhook/{YOUR_WEBHOOK_ID}"
  }
}`}
                  </pre>
                  <button
                    onClick={() => {
                      const toolConfig = `{
  "type": "function",
  "function": {
    "name": "lookup_customer",
    "description": "Look up customer information by phone number. Call this after collecting the customer's phone number to get appointment details and household information.",
    "parameters": {
      "type": "object",
      "properties": {
        "phone_number": {
          "type": "string",
          "description": "Customer phone number (digits only, e.g., 6267888831)"
        }
      },
      "required": ["phone_number"]
    }
  },
  "server": {
    "url": "${window.location.origin}/webhook/{YOUR_WEBHOOK_ID}"
  }
}`;
                      navigator.clipboard.writeText(toolConfig);
                      alert('Tool configuration copied to clipboard!');
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System Prompt Addition</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Add this instruction to your assistant's system prompt:
                </p>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <code className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
{`After collecting the customer's phone number, call the lookup_customer tool to check for existing appointments and customer information. Use this context to provide personalized assistance.`}
                  </code>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What the AI Receives</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  When a customer is found, the tool returns context like:
                </p>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <code className="text-xs text-green-700 dark:text-green-300 whitespace-pre-wrap">
{`Customer found: Benjie Malinao. Existing appointment: 12-15-2025 at 3:30PM. Household/Decision maker: Test Household. Please acknowledge this information naturally in the conversation.`}
                  </code>
                </div>
              </div>
            </div>
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

      {/* Prompt Visualizer Modal */}
      {showVisualizer && agent?.system_prompt && (
        <PromptVisualizerModal
          systemPrompt={agent.system_prompt}
          agentId={agent.id}
          agentName={agent.name}
          onClose={() => setShowVisualizer(false)}
        />
      )}

      {/* Prompt Improver Modal */}
      {showImprover && agent?.system_prompt && (
        <PromptImproverModal
          currentPrompt={agent.system_prompt}
          onApply={handleApplyImprovedPrompt}
          onClose={() => setShowImprover(false)}
        />
      )}
    </div>
  );
}
