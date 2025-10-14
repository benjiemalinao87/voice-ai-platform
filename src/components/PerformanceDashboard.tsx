import { useEffect, useState } from 'react';
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
  Smile
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { SentimentKeywords } from './SentimentKeywords';
import { MultiLineChart } from './MultiLineChart';
import { callsApi, metricsApi } from '../lib/api';
import type { DashboardMetrics, Call, KeywordTrend } from '../types';

interface PerformanceDashboardProps {
  selectedAgentId?: string;
  dateRange: { from: string; to: string };
}

export function PerformanceDashboard({ selectedAgentId, dateRange }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [keywords, setKeywords] = useState<KeywordTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedAgentId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsData, callsData, keywordsData] = await Promise.all([
        callsApi.getMetrics(selectedAgentId, dateRange.from, dateRange.to),
        callsApi.getAll(selectedAgentId, dateRange.from, dateRange.to),
        callsApi.getKeywordTrends(selectedAgentId)
      ]);

      setMetrics(metricsData);
      setCalls(callsData);
      setKeywords(keywordsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for call volume trends - 7 days with realistic patterns
  const callVolumeLabels = ['Jan 8', 'Jan 9', 'Jan 10', 'Jan 11', 'Jan 12', 'Jan 13', 'Jan 14'];

  // Realistic call volume data showing weekly trends
  const totalInboundData = [52, 58, 65, 48, 61, 55, 63];
  const connectedData = [45, 51, 58, 41, 53, 48, 56];
  const missedData = [7, 7, 7, 7, 8, 7, 7];

  const callVolumeSeries = [
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

  const sentimentData = calls
    .filter(c => c.was_answered)
    .slice(-7)
    .map((call, i) => ({
      label: `Call ${i + 1}`,
      value: (call.sentiment_score + 1) * 50
    }));

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Language Distribution</h3>
            <Globe className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="flex justify-center py-4">
            <DonutChart data={languageData} size={180} innerSize={60} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          title="CRM Success Rate"
          value={`${metrics.crmSuccessRate.toFixed(1)}%`}
          subtitle="Successful integrations"
          icon={Database}
          iconColor="text-emerald-600"
        />
      </div>

      <SentimentKeywords />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Calls</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Duration</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Language</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">Qualified</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">CRM</th>
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
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      call.language === 'es' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {call.language.toUpperCase()}
                    </span>
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
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      call.crm_sync_status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      call.crm_sync_status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                    }`}>
                      {call.crm_sync_status}
                    </span>
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
