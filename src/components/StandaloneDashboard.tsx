import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronDown,
    TrendingUp,
    MoreHorizontal,
    ArrowUpRight,
    Phone,
    Bot,
    MessageSquare,
    Clock,
    Activity,
    Loader2
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { agentApi } from '../lib/api';
import { useVapi } from '../contexts/VapiContext';

export function StandaloneDashboard() {
    const [activeTab, setActiveTab] = useState('Overview');
    const { vapiClient } = useVapi();
    const [loading, setLoading] = useState(true);

    // Data States
    const [summary, setSummary] = useState<any>(null);
    const [dailyCalls, setDailyCalls] = useState<any[]>([]);
    const [activeAgentsCount, setActiveAgentsCount] = useState(0);
    const [totalAgentsCount, setTotalAgentsCount] = useState(0);
    const [topIntents, setTopIntents] = useState<any[]>([]);
    const [sentimentStats, setSentimentStats] = useState({ positive: 0, neutral: 0, negative: 0 });
    const [callOrigins, setCallOrigins] = useState<any[]>([]);
    const [costSavings, setCostSavings] = useState({ total: 0, minutesSaved: 0 });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [costRange, setCostRange] = useState<'Today' | 'Week' | 'Month'>('Month');
    const [agentsRange, setAgentsRange] = useState<'Today' | 'Week' | 'Month'>('Week');
    const [allCalls, setAllCalls] = useState<any[]>([]);

    // Analytics Tab State
    const [analyticsMetrics, setAnalyticsMetrics] = useState({
        inboundCount: 0,
        outboundCount: 0,
        answerRate: 0,
        totalMinutes: 0,
        avgDuration: 0
    });
    const [volumeTrend, setVolumeTrend] = useState<any[]>([]);
    const [endedReasons, setEndedReasons] = useState<any[]>([]);
    const [agentPerformance, setAgentPerformance] = useState<any[]>([]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // 1. Fetch Dashboard Summary
                const dashboardSummary = await d1Client.getDashboardSummary();
                setSummary(dashboardSummary);

                // 2. Fetch Webhook Calls for detailed analysis
                const callsData = await d1Client.getWebhookCalls({ limit: 1000 });
                const calls = callsData.results || [];
                setAllCalls(calls);

                // 3. Process Daily Calls (Last 30 days)
                const last30Days = Array.from({ length: 31 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (30 - i));
                    return d.toISOString().split('T')[0];
                });

                const callsByDate = calls.reduce((acc: any, call: any) => {
                    const date = new Date(call.created_at * 1000).toISOString().split('T')[0];
                    acc[date] = (acc[date] || 0) + 1;
                    return acc;
                }, {});

                setDailyCalls(last30Days.map(date => ({
                    date,
                    count: callsByDate[date] || 0,
                    day: new Date(date).getDate()
                })));

                // 4. Process Intents
                const intentsMap = calls.reduce((acc: any, call: any) => {
                    if (call.intent) {
                        acc[call.intent] = (acc[call.intent] || 0) + 1;
                    }
                    return acc;
                }, {});

                const sortedIntents = Object.entries(intentsMap)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 3)
                    .map(([name, count], index) => ({
                        name,
                        type: 'Intent',
                        confidence: '95%', // Mock confidence for now
                        count: count,
                        color: index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : 'bg-orange-500',
                        lightColor: index === 0 ? 'bg-blue-200' : index === 1 ? 'bg-purple-200' : 'bg-orange-200'
                    }));
                setTopIntents(sortedIntents);

                // 5. Process Sentiment
                setSentimentStats({
                    positive: dashboardSummary.positiveCalls || 0,
                    neutral: dashboardSummary.neutralCalls || 0,
                    negative: dashboardSummary.negativeCalls || 0
                });

                // 6. Fetch Agents
                try {
                    const agents = await agentApi.getAll(vapiClient);
                    setTotalAgentsCount(agents.length);
                    setActiveAgentsCount(agents.filter(a => a.is_active).length);
                } catch (e) {
                    console.error("Failed to fetch agents", e);
                    // Fallback to mock if API fails
                    setTotalAgentsCount(12);
                    setActiveAgentsCount(8);
                }

                // 7. Calculate Cost Savings (Initial - Month)
                // Assumption: $0.50 per minute for AI vs $1.50 for human = $1.00 saved per minute
                // We'll calculate this dynamically in a useEffect based on costRange, but set initial here
                const minutes = Math.round(dashboardSummary.totalCallMinutes || 0);
                setCostSavings({
                    total: minutes * 1.0,
                    minutesSaved: minutes
                });

                // 8. Call Origins (Mock for now as we don't have geo data in simple webhook calls yet)
                setCallOrigins([
                    { country: 'USA', count: Math.round(calls.length * 0.45), flag: '🇺🇸' },
                    { country: 'Australia', count: Math.round(calls.length * 0.15), flag: '🇦🇺' },
                    { country: 'Germany', count: Math.round(calls.length * 0.10), flag: '🇩🇪' },
                    { country: 'Spain', count: Math.round(calls.length * 0.08), flag: '🇪🇸' },
                    { country: 'Other', count: Math.round(calls.length * 0.22), flag: '🌍' },
                ]);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [vapiClient]);

    // Effect to update Cost Savings when range changes
    useEffect(() => {
        if (allCalls.length === 0) return;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        const startOfWeek = new Date(now.setDate(now.getDate() - 7)).getTime() / 1000;
        const startOfMonth = new Date(now.setDate(now.getDate() - 30)).getTime() / 1000;

        let filteredCalls = [];
        if (costRange === 'Today') {
            filteredCalls = allCalls.filter((c: any) => c.created_at >= startOfDay);
        } else if (costRange === 'Week') {
            filteredCalls = allCalls.filter((c: any) => c.created_at >= startOfWeek);
        } else {
            filteredCalls = allCalls.filter((c: any) => c.created_at >= startOfMonth);
        }

        const totalSeconds = filteredCalls.reduce((acc: number, c: any) => acc + (c.duration_seconds || 0), 0);
        const minutes = Math.round(totalSeconds / 60);

        setCostSavings({
            total: minutes * 1.0, // $1.00 saved per minute
            minutesSaved: minutes
        });

    }, [costRange, allCalls]);

    // Process Analytics Data when allCalls changes
    useEffect(() => {
        if (allCalls.length === 0) return;

        // 1. Basic Metrics
        let inbound = 0;
        let outbound = 0;
        let answered = 0;
        let totalDuration = 0;

        allCalls.forEach((call: any) => {
            const type = call.raw_payload?.message?.call?.type;
            if (type === 'inboundPhoneCall') inbound++;
            else if (type === 'outboundPhoneCall') outbound++;

            if (call.recording_url) answered++;
            totalDuration += (call.duration_seconds || 0);
        });

        setAnalyticsMetrics({
            inboundCount: inbound,
            outboundCount: outbound,
            answerRate: allCalls.length > 0 ? Math.round((answered / allCalls.length) * 100) : 0,
            totalMinutes: Math.round(totalDuration / 60),
            avgDuration: allCalls.length > 0 ? Math.round(totalDuration / allCalls.length) : 0
        });

        // 2. Volume Trend (Last 7 days or 7 days ending on latest call)
        const generateTrend = () => {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            // Helper to safely parse date
            const getCallDate = (call: any) => {
                if (!call.created_at) return null;
                // Handle seconds (typical for unix timestamp) vs milliseconds
                const timestamp = typeof call.created_at === 'number'
                    ? (call.created_at < 10000000000 ? call.created_at * 1000 : call.created_at)
                    : new Date(call.created_at).getTime();

                if (isNaN(timestamp)) return null;
                return new Date(timestamp).toISOString().split('T')[0];
            };

            // Check if we have recent calls (last 7 days)
            const hasRecentCalls = allCalls.some((call: any) => {
                const callDate = getCallDate(call);
                if (!callDate) return false;
                const diffTime = Math.abs(new Date(todayStr).getTime() - new Date(callDate).getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            });

            let endDate = new Date();

            // If no recent calls, find the latest call date
            if (!hasRecentCalls && allCalls.length > 0) {
                const latestCall = allCalls.reduce((latest: any, call: any) => {
                    const callDate = getCallDate(call);
                    const latestDate = latest ? getCallDate(latest) : null;
                    return !latest || (callDate && latestDate && callDate > latestDate) ? call : latest;
                }, null);

                if (latestCall) {
                    const timestamp = typeof latestCall.created_at === 'number'
                        ? (latestCall.created_at < 10000000000 ? latestCall.created_at * 1000 : latestCall.created_at)
                        : new Date(latestCall.created_at).getTime();
                    endDate = new Date(timestamp);
                }
            }

            const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(endDate);
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
            });

            const trendMap = allCalls.reduce((acc: any, call: any) => {
                const date = getCallDate(call);
                if (date) {
                    if (!acc[date]) {
                        acc[date] = { total: 0, connected: 0, missed: 0 };
                    }
                    acc[date].total += 1;
                    if (call.recording_url) {
                        acc[date].connected += 1;
                    } else {
                        acc[date].missed += 1;
                    }
                }
                return acc;
            }, {});

            return days.map(date => ({
                date,
                label: new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
                value: trendMap[date]?.total || 0,
                connected: trendMap[date]?.connected || 0,
                missed: trendMap[date]?.missed || 0
            }));
        };

        setVolumeTrend(generateTrend());

        // 3. Ended Reasons
        const reasonsMap = allCalls.reduce((acc: any, call: any) => {
            const reason = call.ended_reason || 'unknown';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});

        setEndedReasons(Object.entries(reasonsMap)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 5));

        // 4. Agent Performance
        const agentMap = allCalls.reduce((acc: any, call: any) => {
            const agentId = call.raw_payload?.message?.call?.assistantId || 'Unknown';
            acc[agentId] = (acc[agentId] || 0) + 1;
            return acc;
        }, {});

        // Map IDs to names if possible (using mock names for now as we don't have full map here easily)
        setAgentPerformance(Object.entries(agentMap)
            .map(([id, count]) => ({
                name: id === 'Unknown' ? 'Unknown Agent' : `Agent ${id.substring(0, 4)}...`,
                count
            }))
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 5));

    }, [allCalls]);



    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    <p className="text-gray-400 animate-pulse">Loading Voice AI Analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans p-6 overflow-y-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Voice AI Dashboard</h1>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-[#1C1C1E] rounded-full p-1">
                    {['Overview', 'Analytics', 'Calls', 'Agents', 'Logs'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === tab
                                ? 'bg-white text-black shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* User Profile & Search */}
                <div className="flex items-center gap-4">
                    <button className="p-2 rounded-full bg-[#1C1C1E] text-gray-400 hover:text-white transition-colors">
                        <Search className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 bg-[#1C1C1E] rounded-full pl-2 pr-4 py-1.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-sm">
                            <div className="font-medium">Olivia Brooks</div>
                            <div className="text-xs text-gray-500">admin@voiceai.net</div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                    </div>
                </div>
            </header>

            {/* Main Grid - Overview Tab */}
            {activeTab === 'Overview' && (
                <div className="grid grid-cols-12 gap-6">

                    {/* Cost Savings Card - Large */}
                    <div className="col-span-12 lg:col-span-5 bg-[#1C1C1E] rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="text-gray-500" />
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-gray-200">Cost Savings</h3>
                            <div className="flex bg-black/30 rounded-full p-1 text-xs">
                                {(['Today', 'Week', 'Month'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setCostRange(range)}
                                        className={`px-3 py-1 rounded-full transition-colors ${costRange === range
                                            ? 'bg-white text-black font-medium'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-end gap-4 mb-8">
                            <div className="text-5xl font-light tracking-tight">${costSavings.total.toLocaleString()}</div>
                            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg text-sm font-medium mb-2">
                                <ArrowUpRight className="w-3 h-3" />
                                12.4%
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 mb-8">Estimated savings {costRange === 'Today' ? 'today' : costRange === 'Week' ? 'this week' : 'this month'}</div>

                        <div className="flex items-end gap-4 mb-2">
                            <div className="text-3xl font-light">{costSavings.minutesSaved.toLocaleString()}</div>
                            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg text-xs font-medium mb-1">
                                <ArrowUpRight className="w-3 h-3" />
                                8.2%
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 mb-8">Minutes of human time saved</div>

                        {/* Mock Chart Area - Keeping visual for now as implementing real D3/Recharts is complex for this step */}
                        <div className="h-48 w-full relative">
                            {/* Gradient Line Mockup */}
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#3B82F6" />
                                        <stop offset="50%" stopColor="#8B5CF6" />
                                        <stop offset="100%" stopColor="#EC4899" />
                                    </linearGradient>
                                    <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,100 C50,80 100,120 150,90 C200,60 250,100 300,70 C350,40 400,80 450,60 C500,40 550,70 600,50 L600,150 L0,150 Z"
                                    fill="url(#fillGradient)"
                                />
                                <path
                                    d="M0,100 C50,80 100,120 150,90 C200,60 250,100 300,70 C350,40 400,80 450,60 C500,40 550,70 600,50"
                                    fill="none"
                                    stroke="url(#chartGradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                                <circle cx="300" cy="70" r="6" fill="#1C1C1E" stroke="#8B5CF6" strokeWidth="3" />
                            </svg>

                            {/* X Axis Labels */}
                            {/* X Axis Labels */}
                            <div className="flex justify-between text-xs text-gray-600 mt-2 px-1">
                                {costRange === 'Today' && (
                                    <>
                                        <span>9am</span>
                                        <span>12pm</span>
                                        <span>3pm</span>
                                        <span>6pm</span>
                                        <span>9pm</span>
                                    </>
                                )}
                                {costRange === 'Week' && (
                                    <>
                                        <span>Mon</span>
                                        <span>Tue</span>
                                        <span>Wed</span>
                                        <span>Thu</span>
                                        <span>Fri</span>
                                        <span>Sat</span>
                                        <span>Sun</span>
                                    </>
                                )}
                                {costRange === 'Month' && (
                                    <>
                                        <span>1</span>
                                        <span>8</span>
                                        <span>15</span>
                                        <span>22</span>
                                        <span>29</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Daily Calls - Medium */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-[#1C1C1E] rounded-3xl p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                Last 30 Days <ChevronDown className="w-4 h-4" />
                            </div>
                            <button className="p-2 rounded-full bg-black/30 text-gray-400 hover:text-white">
                                <ArrowUpRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-2 mb-auto">
                            {/* Header */}
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <div key={i} className="text-center text-xs text-gray-600 py-1">{d}</div>
                            ))}
                            {/* Days */}
                            {dailyCalls.map((dayData, i) => {
                                const count = dayData.count;
                                const isSelected = selectedDate === dayData.date;
                                const intensity = count > 10 ? 'bg-blue-400 text-black font-bold' :
                                    count > 5 ? 'bg-blue-500/60 text-white' :
                                        count > 0 ? 'bg-blue-500/20 text-blue-300' : 'text-gray-600';

                                return (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedDate(isSelected ? null : dayData.date)}
                                        className={`
                                        aspect-square flex items-center justify-center text-xs rounded-full relative
                                        ${isSelected ? 'bg-white text-black ring-2 ring-blue-500 z-10 scale-110' : intensity}
                                        hover:bg-white hover:text-black transition-all cursor-pointer
                                    `}
                                        title={`${dayData.date}: ${count} calls`}
                                    >
                                        {dayData.day}
                                        {count > 15 && (
                                            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-white"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <div className="text-3xl font-light">
                                {selectedDate
                                    ? dailyCalls.find(d => d.date === selectedDate)?.count || 0
                                    : summary?.totalCalls?.toLocaleString() || 0}
                            </div>
                            <div className="p-3 bg-black/30 rounded-xl">
                                <Phone className="w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                            {selectedDate
                                ? `Calls on ${new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                : 'Total calls handled'}
                        </div>
                    </div>

                    {/* Active Agents - Medium */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-[#1C1C1E] rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-gray-200">Active Agents</h3>
                            <div className="flex bg-black/30 rounded-full p-1 text-xs">
                                {(['Today', 'Week', 'Month'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setAgentsRange(range)}
                                        className={`px-3 py-1 rounded-full transition-colors ${agentsRange === range
                                            ? 'bg-white text-black font-medium'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <div className="text-4xl font-light mb-1">{activeAgentsCount}</div>
                                <div className="text-sm text-gray-500">Active now</div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-[#2C2C2E] p-3 rounded-2xl flex items-center gap-2 min-w-[100px]">
                                    <Bot className="w-5 h-5 text-gray-300" />
                                    <span className="text-lg font-medium">{totalAgentsCount}</span>
                                </div>
                                <div className="bg-[#2C2C2E] p-3 rounded-2xl flex items-center gap-2 min-w-[100px]">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                    <span className="text-lg font-medium">
                                        {totalAgentsCount > 0 ? Math.round((activeAgentsCount / totalAgentsCount) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bar Chart Mock - Dynamic based on active agents */}
                        <div className="flex items-end justify-between h-40 gap-2">
                            {[40, 60, 30, 80, 100, 50, 70].map((h, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                                    {i === 4 && (
                                        <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded-lg mb-1">{activeAgentsCount * 3}</div>
                                    )}
                                    <div className="w-full bg-[#2C2C2E] rounded-t-xl relative overflow-hidden" style={{ height: '100%' }}>
                                        <div
                                            className={`absolute bottom-0 w-full rounded-t-xl transition-all duration-500 ${i === 4 ? 'bg-[#BFDBFE]' : 'bg-gray-700/30 group-hover:bg-gray-600'}`}
                                            style={{ height: `${h}%` }}
                                        >
                                            {i === 4 && (
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-300 text-black text-xs font-bold px-2 py-1 rounded">Peak</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Intents */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-[#1C1C1E] rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-gray-200">Top Intents</h3>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                All Agents <ChevronDown className="w-3 h-3" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {topIntents.length > 0 ? topIntents.map((intent, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer">
                                    <div className={`w-12 h-12 rounded-xl ${intent.color} flex items-center justify-center text-white`}>
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-200 truncate">{intent.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded text-black font-medium ${intent.lightColor}`}>
                                                {intent.type}
                                            </span>
                                            <span className="text-xs text-gray-500">{intent.confidence}</span>
                                        </div>
                                    </div>
                                    <div className="bg-[#2C2C2E] px-2 py-1 rounded-lg text-sm font-medium text-gray-300">
                                        {intent.count}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-gray-500 text-center py-8">No intent data available</div>
                            )}
                        </div>
                    </div>

                    {/* Call Sentiment */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-[#1C1C1E] rounded-3xl p-6 relative">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-medium text-gray-200">Call Sentiment</h3>
                            <MoreHorizontal className="text-gray-500 w-5 h-5" />
                        </div>

                        <div className="h-64 relative flex items-center justify-center">
                            {/* Dynamic Bubble Chart */}
                            {(() => {
                                const total = sentimentStats.positive + sentimentStats.neutral + sentimentStats.negative || 1;
                                const posPct = Math.round((sentimentStats.positive / total) * 100);
                                const neuPct = Math.round((sentimentStats.neutral / total) * 100);
                                const negPct = Math.round((sentimentStats.negative / total) * 100);

                                return (
                                    <>
                                        <div className="absolute top-10 left-10 w-24 h-24 rounded-full bg-[#86EFAC] flex flex-col items-center justify-center z-10 shadow-lg transition-all duration-500 hover:scale-110">
                                            <span className="text-2xl font-bold text-black">{posPct}%</span>
                                            <span className="text-xs text-gray-700">Positive</span>
                                        </div>

                                        <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-[#E5E7EB] flex flex-col items-center justify-center shadow-lg transition-all duration-500 hover:scale-110">
                                            <span className="text-lg font-bold text-black">{neuPct}%</span>
                                            <span className="text-[10px] text-gray-700">Neutral</span>
                                        </div>

                                        <div className="absolute bottom-8 right-16 w-20 h-20 rounded-full bg-[#FCA5A5] flex flex-col items-center justify-center z-20 shadow-lg transition-all duration-500 hover:scale-110">
                                            <span className="text-xl font-bold text-black">{negPct}%</span>
                                            <span className="text-[10px] text-gray-700">Negative</span>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Decorative circles */}
                            <div className="absolute inset-0 border border-white/5 rounded-full scale-90"></div>
                            <div className="absolute inset-0 border border-white/5 rounded-full scale-75"></div>
                        </div>
                    </div>

                    {/* Call Origins Map */}
                    <div className="col-span-12 lg:col-span-6 bg-[#1C1C1E] rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-gray-200">Call Origins</h3>
                            <div className="text-right">
                                <div className="text-3xl font-light">{summary?.totalCalls?.toLocaleString() || 0}</div>
                                <div className="text-sm text-gray-500">Total calls worldwide</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-8 h-48 relative opacity-60">
                                {/* Dot Map Mock - using a repeating pattern for effect */}
                                <div className="absolute inset-0 grid grid-cols-[repeat(40,1fr)] gap-0.5">
                                    {Array.from({ length: 400 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`rounded-full w-0.5 h-0.5 ${Math.random() > 0.8 ? 'bg-blue-400' : 'bg-gray-700'}`}
                                            style={{ opacity: Math.random() }}
                                        ></div>
                                    ))}
                                </div>
                                {/* Highlighted regions */}
                                <div className="absolute top-1/3 left-1/4 w-12 h-12 bg-blue-500/30 blur-xl rounded-full animate-pulse"></div>
                                <div className="absolute top-1/4 right-1/3 w-16 h-16 bg-blue-500/30 blur-xl rounded-full animate-pulse delay-75"></div>
                            </div>

                            <div className="col-span-4 space-y-3">
                                {callOrigins.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span>{item.flag}</span>
                                            <span>{item.country}</span>
                                        </div>
                                        <span className="font-medium text-gray-200">{item.count.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* Analytics Tab Content */}
            {activeTab === 'Analytics' && (
                <div className="grid grid-cols-12 gap-6">
                    {/* Top Metrics Row */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative group hover:border-white/10 transition-all">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <span className="text-gray-400 font-medium">Total Calls</span>
                            </div>
                            <div className="text-4xl font-light text-white mb-1">{allCalls.length}</div>
                            <div className="text-xs text-gray-500">Inbound & Outbound</div>
                        </div>

                        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative group hover:border-white/10 transition-all">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-500/10 rounded-xl text-green-400">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <span className="text-gray-400 font-medium">Answer Rate</span>
                            </div>
                            <div className="text-4xl font-light text-white mb-1">{analyticsMetrics.answerRate}%</div>
                            <div className="text-xs text-gray-500">Calls answered by AI</div>
                        </div>

                        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative group hover:border-white/10 transition-all">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <span className="text-gray-400 font-medium">Total Minutes</span>
                            </div>
                            <div className="text-4xl font-light text-white mb-1">{analyticsMetrics.totalMinutes}</div>
                            <div className="text-xs text-gray-500">Avg duration: {analyticsMetrics.avgDuration}s</div>
                        </div>

                        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative group hover:border-white/10 transition-all">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <span className="text-gray-400 font-medium">Inbound/Outbound</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="text-4xl font-light text-white mb-1">{analyticsMetrics.inboundCount}</div>
                                <div className="text-sm text-gray-500 mb-2">/ {analyticsMetrics.outboundCount}</div>
                            </div>
                            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="bg-orange-500 h-full rounded-full"
                                    style={{ width: `${(analyticsMetrics.inboundCount / (allCalls.length || 1)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Call Volume Trend */}
                    <div className="col-span-12 lg:col-span-8 bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6">
                            <div className="flex bg-black/30 rounded-full p-1 text-xs">
                                <button className="px-3 py-1 rounded-full bg-white text-black font-medium">Week</button>
                                <button className="px-3 py-1 rounded-full text-gray-400 hover:text-white">Month</button>
                            </div>
                        </div>
                        <h3 className="text-lg font-medium text-gray-200 mb-6">Call Volume Trend</h3>

                        {/* Background Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

                        <div className="h-64 w-full relative z-10">
                            {(() => {
                                if (volumeTrend.length === 0) return null;
                                const maxValue = Math.max(...volumeTrend.map(d => d.value)) || 1;

                                // Calculate points for each metric
                                const calculatePoints = (dataKey: string) => {
                                    return volumeTrend.map((d, i) => {
                                        const x = (i / (volumeTrend.length - 1)) * 92 + 4; // 4% padding on each side
                                        const val = d[dataKey] || 0;
                                        const y = 100 - ((val / maxValue) * 75 + 5); // 5% padding top, 75% chart height
                                        return { x, y, value: val };
                                    });
                                };

                                const totalPoints = calculatePoints('value');
                                const connectedPoints = calculatePoints('connected');
                                const missedPoints = calculatePoints('missed');

                                // Create path strings (straight lines)
                                const createPath = (points: any[]) => {
                                    if (points.length === 0) return '';
                                    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                };

                                // Create area path (for gradient fill)
                                const createAreaPath = (points: any[]) => {
                                    if (points.length === 0) return '';
                                    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                    return `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
                                };

                                return (
                                    <div className="w-full h-full flex flex-col">
                                        {/* Legend */}
                                        <div className="flex gap-4 text-xs font-medium mb-4 justify-end">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-0.5 bg-blue-500"></div>
                                                <span className="text-gray-400">Total Inbound</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-0.5 bg-emerald-500"></div>
                                                <span className="text-gray-400">Connected</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-0.5 bg-red-500"></div>
                                                <span className="text-gray-400">Missed</span>
                                            </div>
                                        </div>

                                        <div className="relative w-full flex-1">
                                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <defs>
                                                    <linearGradient id="blueGrad" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
                                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                                                    </linearGradient>
                                                    <linearGradient id="greenGrad" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
                                                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                                                    </linearGradient>
                                                    <linearGradient id="redGrad" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.1" />
                                                        <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>

                                                {/* Grid lines */}
                                                {[20, 40, 60, 80].map(y => (
                                                    <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="white" strokeOpacity="0.03" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                                ))}

                                                {/* Area fills */}
                                                <path d={createAreaPath(totalPoints)} fill="url(#blueGrad)" />
                                                <path d={createAreaPath(connectedPoints)} fill="url(#greenGrad)" />
                                                <path d={createAreaPath(missedPoints)} fill="url(#redGrad)" />

                                                {/* Lines */}
                                                <path d={createPath(totalPoints)} fill="none" stroke="#3B82F6" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d={createPath(connectedPoints)} fill="none" stroke="#10B981" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d={createPath(missedPoints)} fill="none" stroke="#EF4444" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

                                                {/* Interactive layer */}
                                                {volumeTrend.map((d, i) => {
                                                    const x = totalPoints[i].x;
                                                    return (
                                                        <g key={i} className="group">
                                                            {/* Hover trigger area */}
                                                            <rect
                                                                x={x - 3}
                                                                y="0"
                                                                width="6"
                                                                height="100"
                                                                fill="transparent"
                                                                className="cursor-pointer"
                                                            />

                                                            {/* Vertical line on hover */}
                                                            <line
                                                                x1={x}
                                                                y1="5"
                                                                x2={x}
                                                                y2="100"
                                                                stroke="white"
                                                                strokeOpacity="0.1"
                                                                strokeWidth="1"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                vectorEffect="non-scaling-stroke"
                                                            />

                                                            {/* Data points */}
                                                            <circle cx={x} cy={totalPoints[i].y} r="3" fill="#3B82F6" stroke="#1C1C1E" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity" vectorEffect="non-scaling-stroke" />
                                                            <circle cx={x} cy={connectedPoints[i].y} r="3" fill="#10B981" stroke="#1C1C1E" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity" vectorEffect="non-scaling-stroke" />
                                                            <circle cx={x} cy={missedPoints[i].y} r="3" fill="#EF4444" stroke="#1C1C1E" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity" vectorEffect="non-scaling-stroke" />

                                                            {/* Tooltip */}
                                                            <foreignObject
                                                                x={x < 50 ? x + 2 : x - 32}
                                                                y={Math.min(totalPoints[i].y, connectedPoints[i].y, missedPoints[i].y) - 25}
                                                                width="30"
                                                                height="50"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                                            >
                                                                <div className="bg-[#1C1C1E] p-2 rounded-lg shadow-2xl border border-white/10 text-xs">
                                                                    <div className="font-medium text-white mb-1 whitespace-nowrap text-center">{d.label.split(' ')[0]}</div>
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="w-2 h-0.5 bg-blue-500"></div>
                                                                            <span className="text-white font-medium">{d.value}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="w-2 h-0.5 bg-emerald-500"></div>
                                                                            <span className="text-white font-medium">{d.connected}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="w-2 h-0.5 bg-red-500"></div>
                                                                            <span className="text-white font-medium">{d.missed}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </foreignObject>
                                                        </g>
                                                    );
                                                })}
                                            </svg>
                                        </div>

                                        {/* X-Axis Labels */}
                                        <div className="flex justify-between mt-3 px-2">
                                            {volumeTrend.map((day, i) => (
                                                <span key={i} className="text-xs font-medium text-gray-500">{day.label}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Call Ended Reasons */}
                    <div className="col-span-12 lg:col-span-4 bg-[#1C1C1E] border border-white/5 rounded-3xl p-6">
                        <h3 className="text-lg font-medium text-gray-200 mb-6">Call Ended Reasons</h3>
                        <div className="space-y-5">
                            {endedReasons.map((item, i) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-300 capitalize group-hover:text-white transition-colors">{item.reason.replace(/-/g, ' ')}</span>
                                        <span className="text-gray-500 font-medium">{item.count}</span>
                                    </div>
                                    <div className="w-full bg-[#2C2C2E] h-2 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-purple-500' :
                                                i === 1 ? 'bg-blue-500' :
                                                    i === 2 ? 'bg-emerald-500' : 'bg-gray-500'
                                                }`}
                                            style={{ width: `${(item.count / (allCalls.length || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Agent Performance */}
                    <div className="col-span-12 lg:col-span-6 bg-[#1C1C1E] border border-white/5 rounded-3xl p-6">
                        <h3 className="text-lg font-medium text-gray-200 mb-6">Agent Performance</h3>
                        <div className="space-y-4">
                            {agentPerformance.map((agent, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-medium text-white border border-white/10">
                                        {agent.name.substring(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-200 font-medium">{agent.name}</span>
                                            <span className="text-gray-400 text-xs">{agent.count} calls</span>
                                        </div>
                                        <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-emerald-500 h-full rounded-full group-hover:bg-emerald-400 transition-colors"
                                                style={{ width: `${(agent.count / (Math.max(...agentPerformance.map(a => a.count)) || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {agentPerformance.length === 0 && (
                                <div className="text-gray-500 text-center py-4">No agent data available</div>
                            )}
                        </div>
                    </div>

                    {/* Call Outcome Funnel */}
                    <div className="col-span-12 lg:col-span-6 bg-[#1C1C1E] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[80px] rounded-full pointer-events-none"></div>

                        <h3 className="text-lg font-medium text-gray-200 mb-6 relative z-10">Call Outcome Funnel</h3>
                        <div className="space-y-2 relative z-10">
                            {/* Funnel Visualization */}
                            <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/80 border border-white/5 rounded-xl mx-0 hover:bg-[#3C3C3E] transition-colors cursor-pointer group">
                                <span className="text-gray-300 group-hover:text-white">Total Calls</span>
                                <span className="font-medium text-white bg-black/20 px-2 py-1 rounded">{allCalls.length}</span>
                            </div>
                            <div className="flex justify-center">
                                <div className="w-0.5 h-3 bg-gray-700"></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/60 border border-white/5 rounded-xl mx-4 hover:bg-[#3C3C3E] transition-colors cursor-pointer group">
                                <span className="text-gray-300 group-hover:text-white">Answered</span>
                                <span className="font-medium text-white bg-black/20 px-2 py-1 rounded">
                                    {allCalls.filter(c => c.recording_url).length}
                                </span>
                            </div>
                            <div className="flex justify-center">
                                <div className="w-0.5 h-3 bg-gray-700"></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/40 border border-white/5 rounded-xl mx-8 hover:bg-[#3C3C3E] transition-colors cursor-pointer group">
                                <span className="text-gray-300 group-hover:text-white">Qualified</span>
                                <span className="font-medium text-white bg-black/20 px-2 py-1 rounded">
                                    {allCalls.filter(c => c.outcome === 'Successful').length}
                                </span>
                            </div>
                            <div className="flex justify-center">
                                <div className="w-0.5 h-3 bg-gray-700"></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/20 border border-white/5 rounded-xl mx-12 hover:bg-[#3C3C3E] transition-colors cursor-pointer group">
                                <span className="text-gray-300 group-hover:text-white">Appointments</span>
                                <span className="font-medium text-white bg-black/20 px-2 py-1 rounded">
                                    {allCalls.filter(c => c.intent === 'Scheduling').length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Calls Tab Content */}
            {activeTab === 'Calls' && (
                <div className="space-y-6">
                    {/* Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full"></div>
                            <div className="relative z-10">
                                <div className="text-sm text-blue-400 mb-2 font-medium">Total Calls</div>
                                <div className="text-4xl font-light text-white">{allCalls.length}</div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full"></div>
                            <div className="relative z-10">
                                <div className="text-sm text-emerald-400 mb-2 font-medium">Completed</div>
                                <div className="text-4xl font-light text-white">{allCalls.filter(c => c.recording_url).length}</div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/40 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full"></div>
                            <div className="relative z-10">
                                <div className="text-sm text-red-400 mb-2 font-medium">Missed</div>
                                <div className="text-4xl font-light text-white">{allCalls.filter(c => !c.recording_url).length}</div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full"></div>
                            <div className="relative z-10">
                                <div className="text-sm text-purple-400 mb-2 font-medium">Avg Duration</div>
                                <div className="text-4xl font-light text-white">
                                    {Math.floor((allCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / allCalls.length) / 60) || 0}m
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calls Table */}
                    <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-light text-white mb-1">Recent Calls</h2>
                                    <p className="text-sm text-gray-500">All inbound and outbound call records</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/5">
                                        Filter
                                    </button>
                                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/5">
                                        Export
                                    </button>
                                </div>
                            </div>

                            {/* Table Container */}
                            <div className="relative">
                                {/* Table Header - Fixed */}
                                <div className="bg-[#1C1C1E] border-b border-white/5">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">Date & Time</th>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Type</th>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Duration</th>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">Status</th>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">Outcome</th>
                                                <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Actions</th>
                                            </tr>
                                        </thead>
                                    </table>
                                </div>

                                {/* Table Body - Scrollable */}
                                <div className="overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-white/5">
                                            {allCalls.map((call, i) => (
                                                <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4 px-6 w-[180px]">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-white">
                                                                {new Date(call.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-xs text-gray-500 mt-0.5">
                                                                {new Date(call.created_at * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 w-[120px]">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${call.raw_payload?.message?.call?.type === 'inboundPhoneCall'
                                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                            }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${call.raw_payload?.message?.call?.type === 'inboundPhoneCall' ? 'bg-blue-400' : 'bg-orange-400'
                                                                }`}></div>
                                                            {call.raw_payload?.message?.call?.type === 'inboundPhoneCall' ? 'Inbound' : 'Outbound'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 w-[100px]">
                                                        <span className="text-sm text-gray-300 font-mono">
                                                            {Math.floor((call.duration_seconds || 0) / 60)}:{String((call.duration_seconds || 0) % 60).padStart(2, '0')}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 w-[140px]">
                                                        {call.recording_url ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                                Completed
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                                                Missed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 flex-1">
                                                        <span className="text-sm text-gray-400 capitalize">
                                                            {(call.ended_reason || 'Unknown').replace(/-/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 w-[100px]">
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {call.recording_url && (
                                                                <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="text-white font-medium">{Math.min(allCalls.length, 50)}</span> of <span className="text-white font-medium">{allCalls.length}</span> calls
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition-colors">
                                        Previous
                                    </button>
                                    <button className="px-3 py-1.5 bg-white text-black hover:bg-white/90 rounded-lg text-sm font-medium transition-colors">
                                        1
                                    </button>
                                    <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition-colors">
                                        2
                                    </button>
                                    <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition-colors">
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
