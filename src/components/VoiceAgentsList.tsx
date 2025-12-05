import { useState, useEffect } from 'react';
import { Bot, Volume2, Power, Settings, ChevronRight, Phone, Plus, Trash2, Workflow, Edit3 } from 'lucide-react';
import type { Agent } from '../types';
import { d1Client } from '../lib/d1';

interface VoiceAgentsListProps {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onDeleteAgent: (agentId: string) => void;
}

// Voice options mapping - matches AgentConfig
const VOICE_OPTIONS = [
  // Female Voices
  { id: 'Paige', name: 'Paige', description: '26 year old female - Deeper tone, Calming, Professional' },
  { id: 'Hana', name: 'Hana', description: '22 year old female - Asian, Soft, Soothing, Gentle' },
  { id: 'Kylie', name: 'Kylie', description: '23 year old female - American' },
  { id: 'Savannah', name: 'Savannah', description: '25 year old female - American, Southern accent' },
  { id: 'Spencer', name: 'Spencer', description: '26 year old female - Energetic, Quirky, Lighthearted, Cheeky' },
  { id: 'Leah', name: 'Leah', description: 'Female - Warm, Gentle' },
  { id: 'Tara', name: 'Tara', description: 'Female - Conversational, Clear' },
  { id: 'Jess', name: 'Jess', description: 'Female - Energetic, Youthful' },
  { id: 'Mia', name: 'Mia', description: 'Female - Professional, Articulate' },
  { id: 'Zoe', name: 'Zoe', description: 'Female - Calm, Soothing' },
  { id: 'Lily', name: 'Lily', description: 'Female voice' },
  { id: 'Neha', name: 'Neha', description: 'Female voice' },
  // Male Voices
  { id: 'Rohan', name: 'Rohan', description: '24 year old male - Indian American, Optimistic, Cheerful, Energetic' },
  { id: 'Elliot', name: 'Elliot', description: '25 year old male - Canadian, Soothing, Friendly, Professional' },
  { id: 'Cole', name: 'Cole', description: '22 year old male - Deeper tone, Calming, Professional' },
  { id: 'Harry', name: 'Harry', description: '24 year old male - Clear, Energetic, Professional' },
  { id: 'Leo', name: 'Leo', description: 'Male - Authoritative, Deep' },
  { id: 'Zac', name: 'Zac', description: 'Male - Enthusiastic, Dynamic' },
  { id: 'Dan', name: 'Dan', description: 'Male - Friendly, Casual' },
];

// Helper to get display name for voice
function getVoiceDisplayName(agent: Agent): string {
  // Prefer voice_id (actual voice name) over voice_name (provider)
  if (agent.voice_id) {
    const voice = VOICE_OPTIONS.find(v => v.id === agent.voice_id);
    if (voice) {
      return voice.name;
    }
    // If voice_id exists but not in our list, use it as-is
    return agent.voice_id;
  }

  // If voice_name is a provider identifier, don't show it
  if (agent.voice_name && agent.voice_name.toLowerCase() !== 'vapi') {
    return agent.voice_name;
  }

  return '';
}

export function VoiceAgentsList({ agents, onSelectAgent, onCreateAgent, onDeleteAgent }: VoiceAgentsListProps) {
  const [agentFlowStatus, setAgentFlowStatus] = useState<Record<string, boolean>>({});

  // Check which agents have flow data
  useEffect(() => {
    const checkFlows = async () => {
      if (agents.length === 0) return;
      
      const agentIds = agents.map(a => a.id);
      try {
        const hasFlow = await d1Client.checkAgentFlows(agentIds);
        setAgentFlowStatus(hasFlow);
      } catch (error) {
        console.error('Error checking agent flows:', error);
      }
    };
    
    checkFlows();
  }, [agents]);

  const handleDelete = (e: React.MouseEvent, agentId: string, agentName: string) => {
    e.stopPropagation(); // Prevent triggering onSelectAgent

    if (confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) {
      onDeleteAgent(agentId);
    }
  };

  const handleEditFlow = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation(); // Prevent triggering onSelectAgent
    window.location.href = `/agents/edit/${agentId}`;
  };
  if (agents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <Bot className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Voice AI Agents Yet</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Create your first voice assistant to get started. Voice AI agents handle calls, answer questions, and interact with your customers.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.href = '/agents/create'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
          >
            <Workflow className="w-5 h-5" />
            Visual Flow Builder
          </button>
          <button
            onClick={onCreateAgent}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Quick Create
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Voice AI Agents</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and configure your voice assistants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = '/agents/create'}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
          >
            <Workflow className="w-4 h-4" />
            Visual Flow
          </button>
          <button
            onClick={onCreateAgent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Quick Create
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 text-left group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${agent.is_active
                    ? 'bg-blue-100 dark:bg-blue-900/20'
                    : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                  <Bot className={`w-5 h-5 ${agent.is_active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                    }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex items-center gap-1 ${agent.is_active
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                      }`}>
                      <Power className={`w-3 h-3 ${agent.is_active ? 'fill-current' : ''}`} />
                      <span className="text-xs font-medium">
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleEditFlow(e, agent.id)}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  title={agentFlowStatus[agent.id] ? "Edit as visual flow" : "Create visual flow for this agent"}
                >
                  <Workflow className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, agent.id, agent.name)}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete agent"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              {(() => {
                const voiceDisplayName = getVoiceDisplayName(agent);
                return voiceDisplayName ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Volume2 className="w-4 h-4" />
                    <span>{voiceDisplayName}</span>
                  </div>
                ) : null;
              })()}
              {agent.phone_number && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span>{agent.phone_number}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Settings className="w-4 h-4" />
                <span className="capitalize">{agent.tone || 'Not set'}</span>
                <span className="text-gray-400">•</span>
                <span className="capitalize">{agent.response_style || 'Not set'}</span>
              </div>
            </div>

            {agent.system_prompt && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {agent.system_prompt}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

