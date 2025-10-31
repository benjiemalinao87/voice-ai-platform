import { useState, useEffect } from 'react';
import { Phone, Clock, PhoneIncoming } from 'lucide-react';

interface ActiveCall {
  id: string;
  vapi_call_id: string;
  customer_number: string | null;
  caller_name: string | null;
  carrier_name: string | null;
  line_type: string | null;
  status: string;
  started_at: number;
  updated_at: number;
}

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

export function LiveCallFeed() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveCalls = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/active-calls`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active calls');
      }

      const data = await response.json();
      setActiveCalls(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching active calls:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchActiveCalls();

    // Poll every 3 seconds for updates
    const interval = setInterval(fetchActiveCalls, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startedAt: number) => {
    const now = Math.floor(Date.now() / 1000);
    const duration = now - startedAt;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'in-progress':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ringing':
        return <PhoneIncoming className="w-4 h-4 animate-bounce" />;
      case 'in-progress':
        return <Phone className="w-4 h-4 animate-pulse" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Active Calls
        </h3>
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Active Calls
          {activeCalls.length > 0 && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              {activeCalls.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Live
        </div>
      </div>

      {activeCalls.length === 0 ? (
        <div className="text-center py-8">
          <Phone className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-gray-600 dark:text-gray-400">No active calls</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Active calls will appear here in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCalls.map((call) => (
            <div
              key={call.id}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      {call.caller_name || 'Unknown Caller'}
                    </h4>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                      {getStatusIcon(call.status)}
                      {call.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {call.customer_number || 'N/A'}
                    </span>
                    {call.carrier_name && (
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {call.carrier_name}
                        {call.line_type && ` • ${call.line_type}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <Clock className="w-4 h-4" />
                  <LiveTimer startedAt={call.started_at} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Separate component for live timer that updates every second
function LiveTimer({ startedAt }: { startedAt: number }) {
  const [duration, setDuration] = useState('0:00');

  useEffect(() => {
    const updateDuration = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - startedAt;
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return <span>{duration}</span>;
}
