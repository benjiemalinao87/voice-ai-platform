import { useEffect, useState, useMemo } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Globe,
  FileText,
  Target,
  Calendar,
  Database,
  TrendingUp,
  Clock,
  Zap,
  Smile,
  Users
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { SentimentKeywords } from './SentimentKeywords';
import { MultiLineChart } from './MultiLineChart';
import { AreaChart } from './AreaChart';
import { StackedBarChart } from './StackedBarChart';
import { d1Client } from '../lib/d1';
import type { DashboardMetrics, Call, KeywordTrend } from '../types';

interface PerformanceDashboardProps {
  selectedAgentId?: string;
  dateRange: { from: string; to: string };
}

export function PerformanceDashboard({ selectedAgentId, dateRange }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [keywords, setKeywords] = useState<KeywordTrend[]>([]);
  const [sentimentData, setSentimentData] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [concurrentCalls, setConcurrentCalls] = useState<{ current: number; peak: number } | null>(null);
  const [concurrentCallsTimeSeries, setConcurrentCallsTimeSeries] = useState<{ data: number[]; labels: string[] } | null>(null);
  const [callEndedReasons, setCallEndedReasons] = useState<{ dates: string[]; reasons: Record<string, number[]>; colors: Record<string, string> } | null>(null);
  const [granularity, setGranularity] = useState<'minute' | 'hour' | 'day'>('minute');
  const [assistantNames, setAssistantNames] = useState<Record<string, string>>({});
  const [agentDistribution, setAgentDistribution] = useState<Array<{ label: string; value: number; color: string }>>([]);

  useEffect(() => {
    loadData();
  }, [selectedAgentId, dateRange, granularity]);

  // Calculate real call volume trends from actual data - memoized for performance
  const callVolumeSeries = useMemo(() => {
    if (calls.length === 0) {
      return [
        { name: 'Total Inbound', data: [], color: '#3b82f6' },
        { name: 'Connected', data: [], color: '#10b981' },
        { name: 'Missed', data: [], color: '#ef4444' }
      ];
    }

    // Create date range array from selected date range
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const days: Date[] = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    // Group calls by date
    const callsByDate = new Map<string, { total: number; answered: number; missed: number }>();
    
    days.forEach(date => {
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      callsByDate.set(dateKey, { total: 0, answered: 0, missed: 0 });
    });

    // Aggregate calls by date
    calls.forEach(call => {
      const callDate = new Date(call.call_date);
      const dateKey = callDate.toISOString().split('T')[0];
      
      if (callsByDate.has(dateKey)) {
        const stats = callsByDate.get(dateKey)!;
        stats.total += 1;
        if (call.was_answered) {
          stats.answered += 1;
        } else {
          stats.missed += 1;
        }
      }
    });

    // Create labels and data arrays
    const callVolumeLabels = days.map(date => {
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    });

    const totalInboundData = days.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      return callsByDate.get(dateKey)?.total || 0;
    });

    const connectedData = days.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      return callsByDate.get(dateKey)?.answered || 0;
    });

    const missedData = days.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      return callsByDate.get(dateKey)?.missed || 0;
    });

    return [
      {
        name: 'Total Inbound',
        data: callVolumeLabels.map((label, i) => ({
          label,
          value: totalInboundData[i]
        })),
        color: '#3b82f6' // Blue
      },
      {
        name: 'Connected',
        data: callVolumeLabels.map((label, i) => ({
          label,
          value: connectedData[i]
        })),
        color: '#10b981' // Green
      },
      {
        name: 'Missed',
        data: callVolumeLabels.map((label, i) => ({
          label,
          value: missedData[i]
        })),
        color: '#ef4444' // Red
      }
    ];
  }, [calls, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all dashboard data in parallel to reduce total load time
      // This reduces load time from sum of all calls to max of all calls
      const [
        summary,
        webhookCalls,
        keywordsData,
        concurrentData,
        timeSeriesData,
        reasonsData,
        agentDistributionData
      ] = await Promise.all([
        // 1. Dashboard summary with SQL-optimized metrics (single query, <50ms)
        d1Client.getDashboardSummary(),
        // 2. Webhook calls for the call volume chart and call list
        d1Client.getWebhookCalls({ limit: 1000 }),
        // 3. Keywords data
        d1Client.getKeywords(),
        // 4. Concurrent calls data
        d1Client.getConcurrentCalls().catch(() => ({ current: 0, peak: 0 })),
        // 5. Concurrent calls time-series
        d1Client.getConcurrentCallsTimeSeries({
          granularity: granularity,
          limit: 1000
        }).catch(() => ({ data: [], labels: [] })),
        // 6. Call ended reasons data
        d1Client.getCallEndedReasons({
          start_date: dateRange.from,
          end_date: dateRange.to
        }).catch(() => ({ dates: [], reasons: {}, colors: {} })),
        // 7. Agent distribution data
        d1Client.getAgentDistribution().catch(() => [])
      ]);

      // Calculate derived metrics
      const qualificationRate = summary.answeredCalls > 0
        ? (summary.qualifiedLeadsCount / summary.answeredCalls) * 100
        : 0;

      const appointmentDetectionRate = summary.answeredCalls > 0
        ? (summary.appointmentsDetected / summary.answeredCalls) * 100
        : 0;

      const metricsData: DashboardMetrics = {
        totalCalls: summary.totalCalls,
        answeredCalls: summary.answeredCalls,
        unansweredCalls: summary.unansweredCalls,
        answerRate: summary.answerRate,
        spanishCallsPercent: 0,
        englishCallsPercent: 100,
        avgSummaryLength: summary.avgSummaryLength,
        qualifiedLeadsCount: summary.qualifiedLeadsCount,
        qualificationRate,
        appointmentDetectionRate,
        crmSuccessRate: summary.totalCallMinutes, // Reuse this field for total call minutes
        avgSentiment: 0,
        avgHandlingTime: summary.avgHandlingTime,
        automationRate: summary.answerRate
      };

      // Sentiment breakdown from summary
      const sentimentBreakdown = [
        { label: 'Positive', value: summary.positiveCalls, color: '#10b981' },
        { label: 'Neutral', value: summary.neutralCalls, color: '#3b82f6' },
        { label: 'Negative', value: summary.negativeCalls, color: '#ef4444' }
      ];

      // Convert webhook calls to Call format
      const convertedCalls: Call[] = webhookCalls.map(call => {
        // Extract assistant ID from raw_payload
        let assistantId = '';
        try {
          if (call.raw_payload?.message?.call?.assistantId) {
            assistantId = call.raw_payload.message.call.assistantId;
          }
        } catch (error) {
          console.error('Error extracting assistantId from raw_payload:', error);
        }

        return {
          id: call.id,
          agent_id: assistantId,
          call_date: new Date(call.created_at * 1000).toISOString(),
          duration_seconds: call.duration_seconds || 0,
          was_answered: !!call.recording_url,
          language: 'en',
          summary: call.summary || null,
          summary_length: call.summary?.length || 0,
          is_qualified_lead: call.outcome === 'Successful',
          has_appointment_intent: call.intent === 'Scheduling',
          crm_lead_created: false,
          crm_sync_status: 'pending',
          sentiment_score: call.sentiment === 'Positive' ? 0.7 : call.sentiment === 'Negative' ? -0.7 : 0,
          phone_number: call.customer_number || call.phone_number || '',
          customer_name: call.customer_name || call.caller_name || call.structured_data?.name || call.structured_data?.customerName || null,
          transcript: null,
          created_at: new Date(call.created_at * 1000).toISOString()
        };
      });

      // Transform keywords to KeywordTrend format
      const keywordTrends: KeywordTrend[] = keywordsData.map((kw) => ({
        keyword: kw.keyword,
        count: kw.count,
        trend: 0 // We don't track trends yet
      }));

      // Transform agent distribution data with colors
      const colorPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
      const agentDistChart = agentDistributionData.map((agent, index) => ({
        label: agent.assistant_name,
        value: agent.call_count,
        color: colorPalette[index % colorPalette.length]
      }));

      // Fetch assistant names for all unique assistant IDs
      const uniqueAssistantIds = [...new Set(convertedCalls.map(call => call.agent_id).filter(id => id))];
      const assistantNamesMap: Record<string, string> = {};

      // Fetch assistant details in parallel
      await Promise.all(
        uniqueAssistantIds.map(async (assistantId) => {
          try {
            const { assistant } = await d1Client.getAssistant(assistantId);
            assistantNamesMap[assistantId] = assistant?.name || assistantId;
          } catch (error: any) {
            // Silently handle 404s (deleted assistants) - just use the ID
            if (!error.message?.includes('404')) {
              console.error(`Error fetching assistant ${assistantId}:`, error);
            }
            assistantNamesMap[assistantId] = assistantId.substring(0, 8) + '...'; // Show truncated ID for deleted assistants
          }
        })
      );

      setMetrics(metricsData);
      setCalls(convertedCalls);
      setKeywords(keywordTrends);
      setSentimentData(sentimentBreakdown);
      setConcurrentCalls(concurrentData);
      setConcurrentCallsTimeSeries(timeSeriesData);
      setCallEndedReasons(reasonsData);
      setAssistantNames(assistantNamesMap);
      setAgentDistribution(agentDistChart);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set empty state on error
      setMetrics({
        totalCalls: 0,
        answeredCalls: 0,
        unansweredCalls: 0,
        answerRate: 0,
        spanishCallsPercent: 0,
        englishCallsPercent: 0,
        avgSummaryLength: 0,
        qualifiedLeadsCount: 0,
        qualificationRate: 0,
        appointmentDetectionRate: 0,
        crmSuccessRate: 0,
        avgSentiment: 0,
        avgHandlingTime: 0,
        automationRate: 0
      });
      setCalls([]);
      setKeywords([]);
      setSentimentData([]);
    } finally {
      setLoading(false);
    }
  };

  const languageData = [
    { label: 'English', value: Math.round(metrics?.englishCallsPercent || 0), color: '#3b82f6' },
    { label: 'Spanish', value: Math.round(metrics?.spanishCallsPercent || 0), color: '#8b5cf6' }
  ];

  const keywordData = keywords.slice(0, 8).map(k => ({
    label: k.keyword,
    value: k.count,
    color: '#10b981'
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Top Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="h-[200px] bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Second Metrics Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="h-[250px] bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Bottom Charts Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="h-[300px] bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No data available for selected filters
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls"
          value={metrics.totalCalls.toLocaleString()}
          subtitle={`${metrics.answeredCalls} answered, ${metrics.unansweredCalls} missed`}
          icon={Phone}
          iconColor="text-blue-600"
        />
        <MetricCard
          title="Answer Rate"
          value={`${metrics.answerRate.toFixed(1)}%`}
          subtitle="Calls successfully answered"
          icon={PhoneIncoming}
          iconColor="text-green-600"
        />
        <MetricCard
          title="Qualified Leads"
          value={metrics.qualifiedLeadsCount}
          subtitle={`${metrics.qualificationRate.toFixed(1)}% of answered calls`}
          icon={Target}
          iconColor="text-orange-600"
        />
        <MetricCard
          title="Avg Handling Time"
          value={`${Math.floor(metrics.avgHandlingTime / 60)}:${String(Math.floor(metrics.avgHandlingTime % 60)).padStart(2, '0')}`}
          subtitle="Minutes:seconds per call"
          icon={Clock}
          iconColor="text-slate-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Call Volume Trend</h3>
            <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <MultiLineChart series={callVolumeSeries} height={200} showLegend={true} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Call Distribution by Voice Agent</h3>
            <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="flex justify-center py-4">
            {agentDistribution.length > 0 ? (
              <DonutChart data={agentDistribution} size={200} innerSize={70} />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500">
                No agent distribution data available
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Summary Length"
          value={`${Math.round(metrics.avgSummaryLength)} chars`}
          subtitle="AI-generated summaries"
          icon={FileText}
          iconColor="text-blue-600"
        />
        <MetricCard
          title="Appointment Detection"
          value={`${metrics.appointmentDetectionRate.toFixed(1)}%`}
          subtitle="Calls with scheduling intent"
          icon={Calendar}
          iconColor="text-green-600"
        />
        <MetricCard
          title="Total Call Minutes"
          value={`${metrics.crmSuccessRate.toLocaleString()}`}
          subtitle="Total duration of all calls"
          icon={Clock}
          iconColor="text-emerald-600"
        />
        <MetricCard
          title="Concurrent Calls"
          value={concurrentCalls ? `${concurrentCalls.current}` : '0'}
          subtitle={concurrentCalls ? `Peak: ${concurrentCalls.peak}` : 'Loading...'}
          icon={Users}
          iconColor="text-purple-600"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reason Call Ended</h3>
        </div>
        {callEndedReasons && callEndedReasons.dates.length > 0 && Object.keys(callEndedReasons.reasons).length > 0 ? (
          <StackedBarChart
            dates={callEndedReasons.dates}
            reasons={callEndedReasons.reasons}
            colors={callEndedReasons.colors}
            height={300}
            showLegend={true}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400 dark:text-gray-500">
            No call ended reason data available
          </div>
        )}
      </div>

      <SentimentKeywords
        sentimentData={sentimentData}
        keywordsData={keywords.map((kw, index) => ({
          label: kw.keyword,
          value: kw.count,
          color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#14b8a6', '#f97316'][index % 10]
        }))}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Calls</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Caller</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Assistant</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Phone</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Duration</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Qualified</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {calls.slice(0, 10).map((call) => (
                <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(call.call_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                    {call.customer_name || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                    {call.agent_id ? (
                      <span title={call.agent_id}>
                        {assistantNames[call.agent_id] || call.agent_id}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {call.phone_number || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-4">
                    {call.was_answered ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <PhoneIncoming className="w-4 h-4" />
                        <span className="text-xs font-medium">Answered</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                        <PhoneOff className="w-4 h-4" />
                        <span className="text-xs font-medium">Missed</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {call.is_qualified_lead ? (
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓ Yes</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">No</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[60px]">
                        <div
                          className={`h-2 rounded-full ${
                            call.sentiment_score > 0.3 ? 'bg-green-500 dark:bg-green-400' :
                            call.sentiment_score < -0.3 ? 'bg-red-500 dark:bg-red-400' :
                            'bg-yellow-500 dark:bg-yellow-400'
                          }`}
                          style={{ width: `${((call.sentiment_score + 1) / 2) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-8">
                        {call.sentiment_score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
