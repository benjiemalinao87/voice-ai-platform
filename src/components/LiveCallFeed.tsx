import { useState, useEffect } from 'react';
import { Phone, Clock, PhoneIncoming, PhoneOff, PhoneForwarded, Volume2 } from 'lucide-react';

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
  const [transferNumber, setTransferNumber] = useState<string>('');
  const [showTransferInput, setShowTransferInput] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previousCallIds, setPreviousCallIds] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Play notification sound for new calls
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create a pleasant notification tone (two beeps)
      const playBeep = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration);

        oscillator.start(audioContext.currentTime + startTime);
        oscillator.stop(audioContext.currentTime + startTime + duration);
      };

      // Two-tone notification (like a phone ring)
      playBeep(800, 0, 0.15);
      playBeep(600, 0.15, 0.15);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

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

      // Detect new calls and play notification
      if (!isInitialLoad) {
        const newCallIds = new Set(data.map((call: ActiveCall) => call.vapi_call_id));
        const hasNewCalls = data.some((call: ActiveCall) => !previousCallIds.has(call.vapi_call_id));

        if (hasNewCalls) {
          playNotificationSound();
        }

        setPreviousCallIds(newCallIds);
      } else {
        // On initial load, just store the call IDs without playing sound
        setPreviousCallIds(new Set(data.map((call: ActiveCall) => call.vapi_call_id)));
        setIsInitialLoad(false);
      }

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

  const handleEndCall = async (callId: string) => {
    if (!confirm('Are you sure you want to end this call?')) return;

    setActionLoading(callId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${callId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to end call');
      }

      // Refresh active calls
      await fetchActiveCalls();
    } catch (error) {
      console.error('Error ending call:', error);
      alert(`Failed to end call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransferCall = async (callId: string) => {
    if (!transferNumber.trim()) {
      alert('Please enter a phone number to transfer to');
      return;
    }

    setActionLoading(callId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${callId}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber: transferNumber })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transfer call');
      }

      // Clear transfer input and refresh
      setTransferNumber('');
      setShowTransferInput(null);
      await fetchActiveCalls();
    } catch (error) {
      console.error('Error transferring call:', error);
      alert(`Failed to transfer call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

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
      case 'forwarding':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
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
      case 'forwarding':
        return <PhoneForwarded className="w-4 h-4 animate-pulse" />;
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
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Live
          </div>
          <div className="flex items-center gap-1.5" title="Sound alerts enabled for new calls">
            <Volume2 className="w-3.5 h-3.5" />
            Sound
          </div>
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

              {/* Call Control Actions */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                {showTransferInput === call.vapi_call_id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={transferNumber}
                      onChange={(e) => setTransferNumber(e.target.value)}
                      placeholder="Enter phone number (e.g., +1234567890)"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={actionLoading === call.vapi_call_id}
                    />
                    <button
                      onClick={() => handleTransferCall(call.vapi_call_id)}
                      disabled={actionLoading === call.vapi_call_id}
                      className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => {
                        setShowTransferInput(null);
                        setTransferNumber('');
                      }}
                      disabled={actionLoading === call.vapi_call_id}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {call.status === 'forwarding' ? (
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <PhoneForwarded className="w-4 h-4 animate-pulse" />
                        Call being transferred...
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowTransferInput(call.vapi_call_id)}
                          disabled={actionLoading === call.vapi_call_id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PhoneForwarded className="w-4 h-4" />
                          Transfer
                        </button>
                        <button
                          onClick={() => handleEndCall(call.vapi_call_id)}
                          disabled={actionLoading === call.vapi_call_id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PhoneOff className="w-4 h-4" />
                          End Call
                        </button>
                        {actionLoading === call.vapi_call_id && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                            Processing...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
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
