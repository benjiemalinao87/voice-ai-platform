import { useState, useEffect } from 'react';
import {
  Bot,
  Phone,
  PhoneIncoming,
  Clock,
  Calendar,
  Play,
  Pause,
  Download,
  DollarSign,
  BarChart2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { VapiClient, createVapiClient } from '../lib/vapi';
import { agentApi } from '../lib/api';
import { useVapi } from '../contexts/VapiContext';
import type { Agent } from '../types';

interface AnalyticsCall {
  id: string;
  status: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  customer?: {
    number?: string;
    name?: string;
  };
  analysis?: {
    sentiment?: string;
    successEvaluation?: string;
  };
  endedReason?: string;
}

export function AssistantAnalytics() {
  const { vapiClient, selectedOrgId } = useVapi();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [calls, setCalls] = useState<AnalyticsCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [expandedSummaries, setExpandedSummaries] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, [vapiClient, selectedOrgId]);

  // Load calls when agent is selected
  useEffect(() => {
    if (selectedAgentId) {
      loadCallsForAgent(selectedAgentId);
    } else {
      setCalls([]);
    }
  }, [selectedAgentId]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await agentApi.getAll(vapiClient, selectedOrgId ? { orgId: selectedOrgId } : undefined);
      setAgents(data);
      // Auto-select first agent if available
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCallsForAgent = async (agentId: string) => {
    try {
      setLoadingCalls(true);
      const settings = await d1Client.getUserSettings();
      let vapi: VapiClient | null = null;

      if (settings.privateKey) {
        vapi = createVapiClient(settings.privateKey);
      } else if (import.meta.env.VITE_VAPI_PRIVATE_KEY) {
        vapi = createVapiClient(import.meta.env.VITE_VAPI_PRIVATE_KEY);
      }

      if (vapi) {
        const callsData = await vapi.listCalls({
          assistantId: agentId,
          limit: 100
        });
        setCalls(callsData as unknown as AnalyticsCall[]);
      }
    } catch (error) {
      console.error('Error loading calls:', error);
      setCalls([]);
    } finally {
      setLoadingCalls(false);
    }
  };

  const handlePlayPause = (callId: string) => {
    const audio = document.getElementById(`audio-${callId}`) as HTMLAudioElement;
    if (!audio) return;

    if (playingId === callId) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing audio
      if (playingId) {
        const currentAudio = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
        if (currentAudio) currentAudio.pause();
      }
      audio.play();
      setPlayingId(callId);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate duration from startedAt and endedAt if not provided
  const getCallDuration = (call: AnalyticsCall): number => {
    if (call.duration) return call.duration;
    if (call.startedAt && call.endedAt) {
      return (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
    }
    return 0;
  };

  // Calculate metrics for selected agent
  const calculateMetrics = () => {
    if (!calls.length) return {
      totalCalls: 0,
      totalDuration: 0,
      avgDuration: 0,
      totalCost: 0
    };

    const totalCalls = calls.length;
    let totalDuration = 0;
    let totalCost = 0;

    calls.forEach(call => {
      totalDuration += getCallDuration(call);
      totalCost += call.cost || 0;
    });

    return {
      totalCalls,
      totalDuration,
      avgDuration: totalCalls > 0 ? totalDuration / totalCalls : 0,
      totalCost
    };
  };

  const metrics = calculateMetrics();

  // Filter calls
  const filteredCalls = calls.filter(call => {
    // Filter by call type
    if (callTypeFilter === 'inbound' && call.type !== 'inboundPhoneCall') return false;
    if (callTypeFilter === 'outbound' && call.type !== 'outboundPhoneCall') return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const customerName = call.customer?.name?.toLowerCase() || '';
      const customerNumber = call.customer?.number?.toLowerCase() || '';
      const summary = call.summary?.toLowerCase() || '';
      return customerName.includes(query) || customerNumber.includes(query) || summary.includes(query);
    }

    return true;
  });

  // Filter agents by search
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Left Panel - Assistants List */}
      <div className="w-72 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Assistants</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assistants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredAgents.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No assistants found
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  selectedAgentId === agent.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  selectedAgentId === agent.id
                    ? 'bg-blue-100 dark:bg-blue-900/50'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Bot className={`w-4 h-4 ${
                    selectedAgentId === agent.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    selectedAgentId === agent.id
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {agent.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Calls Dashboard */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedAgentId ? (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Select an assistant to view calls</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header with Stats */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedAgent?.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Call history and analytics
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Calls</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.totalCalls}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Duration</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(metrics.avgDuration)}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Cost</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${metrics.totalCost.toFixed(2)}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Last Active</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {calls.length > 0 && calls[0].startedAt
                      ? new Date(calls[0].startedAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setCallTypeFilter('all')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    callTypeFilter === 'all'
                      ? 'bg-gray-600 dark:bg-gray-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCallTypeFilter('inbound')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    callTypeFilter === 'inbound'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  Inbound
                </button>
                <button
                  onClick={() => setCallTypeFilter('outbound')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    callTypeFilter === 'outbound'
                      ? 'bg-green-600 dark:bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Outbound
                </button>
              </div>

              <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Calls List */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Call History</h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingCalls ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredCalls.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    No calls found for this assistant
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredCalls.map((call) => {
                      const duration = getCallDuration(call);
                      return (
                        <div key={call.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <div className="flex items-start gap-3">
                            {/* Large Play Button */}
                            <button
                              onClick={() => call.recordingUrl && handlePlayPause(call.id)}
                              disabled={!call.recordingUrl}
                              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                call.recordingUrl
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {playingId === call.id ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5 ml-0.5" />
                              )}
                            </button>

                            {/* Call Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Customer Name/Phone */}
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {call.customer?.name || call.customer?.number || 'Unknown Caller'}
                                </span>

                                {call.customer?.number && call.customer?.name && (
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({call.customer.number})
                                  </span>
                                )}

                                {/* Call Type Badge */}
                                {call.type === 'inboundPhoneCall' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                    <PhoneIncoming className="w-3 h-3" />
                                    Inbound
                                  </span>
                                )}
                                {call.type === 'outboundPhoneCall' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                                    <Phone className="w-3 h-3" />
                                    Outbound
                                  </span>
                                )}
                                {call.type === 'webCall' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                    Web Call
                                  </span>
                                )}
                              </div>

                              {/* Date, Duration, Status */}
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(call.startedAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDuration(duration)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  call.status === 'ended'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {call.status}
                                </span>
                                {call.cost && (
                                  <span className="text-xs text-gray-400">
                                    ${call.cost.toFixed(2)}
                                  </span>
                                )}
                              </div>

                              {/* Audio Progress Bar */}
                              {call.recordingUrl && (
                                <div className="mt-2">
                                  <audio
                                    id={`audio-${call.id}`}
                                    src={call.recordingUrl}
                                    onTimeUpdate={(e) => {
                                      const audio = e.currentTarget;
                                      setCurrentTime(prev => ({
                                        ...prev,
                                        [call.id]: audio.currentTime
                                      }));
                                    }}
                                    onEnded={() => setPlayingId(null)}
                                    className="hidden"
                                  />
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full bg-blue-600 dark:bg-blue-500 transition-all ${
                                          playingId === call.id ? 'animate-pulse' : ''
                                        }`}
                                        style={{
                                          width: duration > 0
                                            ? `${((currentTime[call.id] || 0) / duration) * 100}%`
                                            : '0%'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 w-20 text-right">
                                      {formatDuration(Math.floor(currentTime[call.id] || 0))} / {formatDuration(duration)}
                                    </span>
                                    <a
                                      href={call.recordingUrl}
                                      download
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                      title="Download recording"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Summary (Expandable) */}
                              {call.summary && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => setExpandedSummaries(prev => ({
                                      ...prev,
                                      [call.id]: !prev[call.id]
                                    }))}
                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    {expandedSummaries[call.id] ? 'Hide Summary' : 'View Summary'}
                                    {expandedSummaries[call.id] ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                  {expandedSummaries[call.id] && (
                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-blue-800">
                                      {call.summary}
                                      {call.analysis?.sentiment && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sentiment:</span>
                                          <span className={`text-xs font-medium capitalize ${
                                            call.analysis.sentiment === 'positive' ? 'text-green-600 dark:text-green-400' :
                                            call.analysis.sentiment === 'negative' ? 'text-red-600 dark:text-red-400' :
                                            'text-gray-600 dark:text-gray-400'
                                          }`}>
                                            {call.analysis.sentiment}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
