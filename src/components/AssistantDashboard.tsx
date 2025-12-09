import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Bot,
    ArrowLeft,
    Phone,
    Clock,
    MessageSquare,
    BarChart2,
    Calendar,
    PhoneIncoming,
    Play,
    Pause,
    Filter
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { VapiClient, createVapiClient } from '../lib/vapi';
import type { Agent } from '../types';

interface DashboardCall {
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
}

export function AssistantDashboard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [assistant, setAssistant] = useState<Agent | null>(null);
    const [calls, setCalls] = useState<DashboardCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCalls, setLoadingCalls] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadAssistantData();
        }
    }, [id]);

    const loadAssistantData = async () => {
        if (!id) return;

        try {
            setLoading(true);
            // 1. Get Assistant Details
            // We'll use d1Client to get the assistant from our database
            const { assistant: assistantData } = await d1Client.getAssistant(id);
            setAssistant(assistantData);

            // 2. Setup Vapi Client
            const settings = await d1Client.getUserSettings();
            let vapi: VapiClient | null = null;

            if (settings.privateKey) {
                vapi = createVapiClient(settings.privateKey);
            } else if (import.meta.env.VITE_VAPI_PRIVATE_KEY) {
                vapi = createVapiClient(import.meta.env.VITE_VAPI_PRIVATE_KEY);
            }

            if (vapi) {
                setLoadingCalls(true);
                // 3. Fetch Calls for this assistant
                // We can fetch calls specifically for this assistantId
                try {
                    const callsData = await vapi.listCalls({
                        assistantId: id,
                        limit: 50 // Fetch last 50 calls
                    });
                    setCalls(callsData as unknown as DashboardCall[]);
                } catch (callError) {
                    console.error('Error fetching calls:', callError);
                } finally {
                    setLoadingCalls(false);
                }
            }
        } catch (error) {
            console.error('Error loading assistant dashboard:', error);
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
            // Approximate duration if not explicit (using started/ended)
            let duration = call.duration || 0;
            if (!duration && call.startedAt && call.endedAt) {
                duration = (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
            }

            totalDuration += duration;
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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!assistant) {
        return (
            <div className="text-center p-12">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Assistant Not Found</h3>
                <button
                    onClick={() => navigate('/')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Bot className="w-6 h-6 text-blue-600" />
                        {assistant.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        ID: {assistant.id}
                    </p>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.totalCalls}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Duration</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(metrics.avgDuration)}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${metrics.totalCost.toFixed(2)}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Active</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {calls.length > 0 && calls[0].startedAt
                            ? new Date(calls[0].startedAt).toLocaleDateString()
                            : 'N/A'}
                    </p>
                </div>
            </div>

            {/* Calls List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Calls</h3>
                    <div className="flex gap-2">
                        {/* Could add filters here later */}
                    </div>
                </div>

                {loadingCalls ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Loading calls...</p>
                    </div>
                ) : calls.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        No calls found for this assistant.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {calls.map((call) => (
                            <div key={call.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Play Button */}
                                    <button
                                        onClick={() => call.recordingUrl && handlePlayPause(call.id)}
                                        disabled={!call.recordingUrl}
                                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${call.recordingUrl
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {playingId === call.id ? (
                                            <Pause className="w-4 h-4" />
                                        ) : (
                                            <Play className="w-4 h-4 ml-0.5" />
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">
                                                    {call.customer?.name || call.customer?.number || 'Unknown Caller'}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                    <span className="capitalize">{call.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <span>•</span>
                                                    <span>{call.startedAt ? new Date(call.startedAt).toLocaleString() : 'Date Unknown'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${call.status === 'ended' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {call.status}
                                                </span>
                                                <div className="mt-1 text-sm text-gray-500">
                                                    {formatDuration(call.duration)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Analysis/Summary */}
                                        {(call.summary || call.analysis) && (
                                            <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                                                {call.summary && <p className="mb-1">{call.summary}</p>}
                                                {call.analysis?.sentiment && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs font-medium uppercase text-gray-500">Sentiment:</span>
                                                        <span className={`capitalize ${call.analysis.sentiment === 'positive' ? 'text-green-600' :
                                                                call.analysis.sentiment === 'negative' ? 'text-red-600' :
                                                                    'text-gray-600'
                                                            }`}>{call.analysis.sentiment}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Audio Element */}
                                        {call.recordingUrl && (
                                            <audio
                                                id={`audio-${call.id}`}
                                                src={call.recordingUrl}
                                                onEnded={() => setPlayingId(null)}
                                                className="hidden"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
