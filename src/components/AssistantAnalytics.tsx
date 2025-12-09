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
  MessageSquare,
  ChevronUp,
  Filter,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { agentApi } from '../lib/api';
import { useVapi } from '../contexts/VapiContext';
import { d1Client } from '../lib/d1';
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

  // Get agent ID from URL query params - this is the source of truth
  const agentId = new URLSearchParams(window.location.search).get('agent');

  const [agentName, setAgentName] = useState<string>('');
  const [calls, setCalls] = useState<AnalyticsCall[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [expandedSummaries, setExpandedSummaries] = useState<{ [key: string]: boolean }>({});

  const [callTypeFilter, setCallTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  // Load agent name and calls on mount
  useEffect(() => {
    if (agentId && vapiClient) {
      loadData(agentId);
    } else if (!agentId) {
      setLoading(false);
    }
  }, [agentId, vapiClient]);

  const loadData = async (id: string) => {
    try {
      setLoading(true);

      // Load agent name, VAPI calls, and enriched data from database in parallel
      const [agentsResult, callsResult, webhookCalls] = await Promise.all([
        agentApi.getAll(vapiClient, selectedOrgId ? { orgId: selectedOrgId } : undefined),
        vapiClient?.listCalls({ assistantId: id, limit: 100 }),
        d1Client.getWebhookCalls({ limit: 500 }) // Get enriched data from database
      ]);

      const agent = agentsResult.find(a => a.id === id);
      if (agent) {
        setAgentName(agent.name);
      }

      if (callsResult) {
        setCalls(callsResult as unknown as AnalyticsCall[]);
      }

      // Build a map of vapi_call_id -> customer name from enriched database data
      if (webhookCalls?.results) {
        const nameMap: Record<string, string> = {};
        webhookCalls.results.forEach((call: any) => {
          if (call.vapi_call_id) {
            // Priority: customer_name (from analysis) > caller_name (from Twilio) > structured_data.name
            const name = call.customer_name || call.caller_name || call.structured_data?.name;
            if (name) {
              nameMap[call.vapi_call_id] = name;
            }
          }
        });
        setCustomerNames(nameMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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

    return true;
  });


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Dashboard Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  localStorage.setItem('currentView', 'config');
                  window.location.href = '/';
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Back to Voice Agents"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {agentName || 'Agent Analytics'}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Call history and performance</p>
                </div>
              </div>
            </div>

            {/* Compact Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-600">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{metrics.totalCalls}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">calls</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-600">
                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDuration(metrics.avgDuration)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">avg</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-600">
                <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">${metrics.totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
            <button
              onClick={() => setCallTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${callTypeFilter === 'all'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              All Calls
            </button>
            <button
              onClick={() => setCallTypeFilter('inbound')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${callTypeFilter === 'inbound'
                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-200 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              <PhoneIncoming className="w-3 h-3" />
              Inbound
            </button>
            <button
              onClick={() => setCallTypeFilter('outbound')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${callTypeFilter === 'outbound'
                ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-200 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              <Phone className="w-3 h-3" />
              Outbound
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
            <Filter className="w-4 h-4" />
            <span>{filteredCalls.length} results</span>
          </div>
        </div>

        {/* Calls List */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
          {filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <Phone className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No calls found</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                This assistant hasn't participated in any calls matching your current filters.
              </p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-6 space-y-4">
              {filteredCalls.map((call) => {
                const duration = getCallDuration(call);
                const isExpanded = expandedSummaries[call.id];
                const hasRecording = !!call.recordingUrl;

                return (
                  <div
                    key={call.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Play/Type Icon */}
                      <div className="flex-shrink-0 pt-1">
                        <button
                          onClick={() => hasRecording && handlePlayPause(call.id)}
                          disabled={!hasRecording}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${hasRecording
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:scale-105 active:scale-95'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                          {playingId === call.id ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          )}
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {customerNames[call.id] || call.customer?.name || call.customer?.number || 'Unknown Caller'}
                              {call.analysis?.sentiment && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${call.analysis.sentiment === 'positive'
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                                  : call.analysis.sentiment === 'negative'
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                                  }`}>
                                  {call.analysis.sentiment}
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {call.customer?.number && (
                                <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                  {call.customer.number}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(call.startedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(duration)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${call.type === 'inboundPhoneCall'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800'
                              : call.type === 'outboundPhoneCall'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800'
                                : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800'
                              }`}>
                              {call.type === 'inboundPhoneCall' && <PhoneIncoming className="w-3 h-3" />}
                              {call.type === 'outboundPhoneCall' && <Phone className="w-3 h-3" />}
                              {call.type === 'webCall' && <Activity className="w-3 h-3" />}
                              <span className="capitalize">{call.type.replace('PhoneCall', '')}</span>
                            </div>
                            {call.cost != null && (
                              <div className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 font-mono">
                                ${call.cost.toFixed(4)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Audio Player (Expanded) */}
                        {hasRecording && (
                          <div className="mt-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 border border-gray-100 dark:border-gray-700/50">
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
                              <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
                                {formatDuration(Math.floor(currentTime[call.id] || 0))}
                              </span>
                              <div
                                className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden cursor-pointer group/slider relative"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = e.clientX - rect.left;
                                  const percentage = x / rect.width;
                                  const audio = document.getElementById(`audio-${call.id}`) as HTMLAudioElement;
                                  if (audio) {
                                    audio.currentTime = percentage * duration;
                                  }
                                }}
                              >
                                <div
                                  className={`h-full bg-indigo-500 group-hover/slider:bg-indigo-400 rounded-full transition-all duration-100 relative ${playingId === call.id ? 'animate-pulse' : ''
                                    }`}
                                  style={{
                                    width: duration > 0
                                      ? `${((currentTime[call.id] || 0) / duration) * 100}%`
                                      : '0%'
                                  }}
                                >
                                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white shadow rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity" />
                                </div>
                              </div>
                              <span className="text-xs font-mono text-gray-500 w-10">
                                {formatDuration(duration)}
                              </span>
                              <a
                                href={call.recordingUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                                title="Download Recording"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Summary Accordion */}
                        {call.summary && (
                          <div className="mt-4">
                            <button
                              onClick={() => setExpandedSummaries(prev => ({ ...prev, [call.id]: !prev[call.id] }))}
                              className="group/summary flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5" />
                              )}
                              <span className="group-hover/summary:underline">
                                {isExpanded ? 'Hide Summary' : 'View Calling Summary'}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="mt-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/30 text-sm text-gray-700 dark:text-gray-300 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
                                {call.summary}
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
    </div>
  );
}
