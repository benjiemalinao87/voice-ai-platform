import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { d1Client } from '../lib/d1';

interface TransferLog {
  id: string;
  transfer_id: string;
  vapi_call_id: string;
  assistant_id: string;
  agent_phone: string;
  agent_name: string | null;
  attempt_number: number;
  status: 'dialing' | 'answered' | 'no_answer' | 'busy' | 'failed';
  reason: string | null;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
}

interface AutoTransferLogsProps {
  assistantId?: string; // Optional: filter by assistant
}

export function AutoTransferLogs({ assistantId }: AutoTransferLogsProps) {
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [expandedTransfer, setExpandedTransfer] = useState<string | null>(null);
  const [transferDetails, setTransferDetails] = useState<Record<string, TransferLog[]>>({});
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [assistantId, statusFilter, offset]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await d1Client.getAutoTransferLogs({
        assistant_id: assistantId,
        status: statusFilter || undefined,
        limit,
        offset
      });

      setLogs(response.logs || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error('Error loading transfer logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransferDetails = async (transferId: string) => {
    if (transferDetails[transferId]) {
      // Already loaded
      setExpandedTransfer(expandedTransfer === transferId ? null : transferId);
      return;
    }

    try {
      const response = await d1Client.getAutoTransferDetails(transferId);
      setTransferDetails({
        ...transferDetails,
        [transferId]: response.attempts
      });
      setExpandedTransfer(transferId);
    } catch (err) {
      console.error('Error loading transfer details:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'answered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'no_answer':
        return <PhoneMissed className="w-4 h-4 text-yellow-500" />;
      case 'busy':
        return <PhoneOff className="w-4 h-4 text-orange-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'dialing':
        return <Phone className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'no_answer':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'busy':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'dialing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Group logs by transfer_id to show unique transfers
  const uniqueTransfers = logs.reduce((acc, log) => {
    if (!acc.find(l => l.transfer_id === log.transfer_id)) {
      acc.push(log);
    }
    return acc;
  }, [] as TransferLog[]);

  // Calculate stats
  const stats = {
    total: uniqueTransfers.length,
    success: uniqueTransfers.filter(l => l.status === 'answered').length,
    failed: uniqueTransfers.filter(l => l.status !== 'answered' && l.status !== 'dialing').length
  };

  const successRate = stats.total > 0 
    ? Math.round((stats.success / stats.total) * 100) 
    : 0;

  if (loading && logs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading transfer logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
              <p className="text-sm text-gray-500">Total Transfers</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.success}</p>
              <p className="text-sm text-gray-500">Successful</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.failed}</p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{successRate}%</p>
              <p className="text-sm text-gray-500">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Transfer History</h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setOffset(0);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Status</option>
                <option value="answered">Answered</option>
                <option value="no_answer">No Answer</option>
                <option value="busy">Busy</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        {uniqueTransfers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transfer logs found</p>
            <p className="text-sm">Transfer attempts will appear here when auto-transfer is triggered</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Time
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Agent
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Attempt
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Duration
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-3 px-4">
                    Reason
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {uniqueTransfers.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => loadTransferDetails(log.transfer_id)}
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                        {formatTime(log.started_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {log.agent_name || log.agent_phone}
                            </p>
                            {log.agent_name && (
                              <p className="text-xs text-gray-500">{log.agent_phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                          {log.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        #{log.attempt_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {log.reason || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {expandedTransfer === log.transfer_id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedTransfer === log.transfer_id && transferDetails[log.transfer_id] && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 dark:bg-gray-700/30 p-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              All Attempts for this Transfer
                            </p>
                            {transferDetails[log.transfer_id].map((attempt, idx) => (
                              <div
                                key={attempt.id}
                                className="flex items-center gap-4 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                              >
                                <span className="text-sm font-medium text-gray-500 w-8">
                                  #{attempt.attempt_number}
                                </span>
                                <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                                  {attempt.agent_name || attempt.agent_phone}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getStatusColor(attempt.status)}`}>
                                  {getStatusIcon(attempt.status)}
                                  {attempt.status.replace('_', ' ')}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDuration(attempt.duration_seconds)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

