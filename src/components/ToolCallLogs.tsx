import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertCircle, Clock, Phone, User, Calendar, RefreshCw, Search } from 'lucide-react';

interface ToolCallLog {
  id: string;
  user_id: string;
  workspace_id: string | null;
  vapi_call_id: string | null;
  tool_name: string;
  phone_number: string | null;
  status: 'success' | 'not_found' | 'error' | 'not_configured';
  request_timestamp: number;
  response_timestamp: number | null;
  response_time_ms: number | null;
  customer_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  household: string | null;
  error_message: string | null;
  created_at: number;
}

interface Stats {
  total: number;
  success: number;
  notFound: number;
  errors: number;
  notConfigured: number;
  avgResponseTimeMs: number;
}

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

export function ToolCallLogs() {
  const [logs, setLogs] = useState<ToolCallLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      let url = `${API_URL}/api/tool-call-logs?limit=100`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (phoneSearch) url += `&phone=${phoneSearch}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching tool call logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleSearch = () => {
    setLoading(true);
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Success
          </span>
        );
      case 'not_found':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            Not Found
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        );
      case 'not_configured':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            Not Configured
          </span>
        );
      default:
        return null;
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CustomerConnect Logs</h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Monitor all customer lookup requests from the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">lookup_customer</code> tool.
      </p>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Calls</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.success}</p>
            <p className="text-xs text-green-700 dark:text-green-400">Found</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.notFound}</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Not Found</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.errors}</p>
            <p className="text-xs text-red-700 dark:text-red-400">Errors</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.avgResponseTimeMs}ms</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Avg Response</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="not_found">Not Found</option>
          <option value="error">Error</option>
          <option value="not_configured">Not Configured</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search phone..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm w-40"
          />
          <button
            onClick={handleSearch}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No tool call logs yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Logs will appear here when the AI calls the lookup_customer tool
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Phone</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Appointment</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Response</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{formatTimestamp(log.created_at)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-mono">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {log.phone_number || '-'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="py-3 px-4">
                    {log.customer_name ? (
                      <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100">
                        <User className="w-3 h-3 text-gray-400" />
                        <span>{log.customer_name}</span>
                        {log.household && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({log.household})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {log.appointment_date ? (
                      <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{log.appointment_date}</span>
                        {log.appointment_time && (
                          <span className="text-gray-500 dark:text-gray-400">
                            @ {log.appointment_time}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {log.response_time_ms ? (
                      <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {log.response_time_ms}ms
                      </span>
                    ) : log.error_message ? (
                      <span className="text-red-600 dark:text-red-400 text-xs" title={log.error_message}>
                        {log.error_message.substring(0, 30)}...
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

