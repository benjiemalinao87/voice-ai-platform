import { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneOff, PhoneForwarded, Volume2, Trash2 } from 'lucide-react';

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
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Play notification sound for new calls
  const playNotificationSound = () => {
    console.log('🔔 Playing incoming call notification sound...');

    // Try Web Audio API first (synthesized ring tone)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume audio context if it's suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('AudioContext resumed');
        });
      }

      // Create a phone-like ring tone (classic telephone ring pattern)
      const playRing = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // Quick fade in/out for each ring pulse
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + startTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + startTime + duration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + startTime + duration);

        oscillator.start(audioContext.currentTime + startTime);
        oscillator.stop(audioContext.currentTime + startTime + duration);
      };

      // Classic phone ring pattern: two rings with pause (440Hz + 480Hz for richer sound)
      playRing(440, 0, 0.4);
      playRing(480, 0, 0.4);
      // Pause
      playRing(440, 0.6, 0.4);
      playRing(480, 0.6, 0.4);

      console.log('✅ Notification sound played successfully');
    } catch (error) {
      console.error('❌ Error playing notification sound with Web Audio API:', error);

      // Fallback: Try HTML Audio element with data URI (simple beep)
      try {
        // Generate a simple beep sound as data URI
        const audio = new Audio();

        // Create a simple sine wave beep
        const sampleRate = 44100;
        const frequency = 800; // 800Hz beep
        const duration = 0.3;
        const samples = Math.floor(sampleRate * duration);

        // Create WAV file data
        const dataSize = samples * 2; // 16-bit mono
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        // WAV header
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Generate sine wave samples
        const data = new Int16Array(samples);
        for (let i = 0; i < samples; i++) {
          const t = i / sampleRate;
          const value = Math.sin(2 * Math.PI * frequency * t) * 0.5;
          data[i] = Math.floor(value * 32767);
        }

        // Combine header and data
        const blob = new Blob([header, data.buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        audio.src = url;
        audio.volume = 0.7;
        audio.play().then(() => {
          console.log('✅ Fallback beep sound played');
          // Clean up after playing
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }).catch((err) => {
          console.error('❌ Failed to play fallback sound:', err);
        });
      } catch (fallbackError) {
        console.error('❌ Fallback sound also failed:', fallbackError);
      }
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

      // Detect new calls and play notification - only for "ringing" status
      if (!isInitialLoad) {
        const newCallIds = new Set<string>(data.map((call: ActiveCall) => call.vapi_call_id));
        // Check for new ringing calls specifically
        const hasNewRingingCalls = data.some((call: ActiveCall) => 
          !previousCallIds.has(call.vapi_call_id) && call.status === 'ringing'
        );

        if (hasNewRingingCalls) {
          playNotificationSound();
          // Optional: Also show browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            const ringingCall = data.find((call: ActiveCall) => 
              !previousCallIds.has(call.vapi_call_id) && call.status === 'ringing'
            );
            if (ringingCall) {
              new Notification('Incoming Call', {
                body: ringingCall.caller_name || ringingCall.customer_number || 'Unknown Caller',
                icon: '/favicon.ico',
                tag: ringingCall.vapi_call_id
              });
            }
          }
        }

        setPreviousCallIds(newCallIds);
      } else {
        // On initial load, just store the call IDs without playing sound
        setPreviousCallIds(new Set<string>(data.map((call: ActiveCall) => call.vapi_call_id)));
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
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(err => {
        console.debug('Notification permission request failed:', err);
      });
    }

    // Initial fetch
    fetchActiveCalls();

    // Poll every 2 seconds for updates (faster polling for better real-time feel)
    const interval = setInterval(fetchActiveCalls, 2000);

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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server error (${response.status})`;

        // Provide more helpful error messages
        if (response.status === 404) {
          throw new Error('Call not found. It may have already ended.');
        } else if (response.status === 400) {
          throw new Error(errorMessage);
        } else {
          throw new Error(`Failed to end call: ${errorMessage}`);
        }
      }

      // Refresh active calls
      await fetchActiveCalls();
    } catch (error) {
      console.error('Error ending call:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to end call: ${message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanupStaleCalls = async () => {
    if (!confirm('Remove calls that have been inactive for more than 2 hours?')) return;

    setCleanupLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/active-calls/cleanup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup stale calls');
      }

      const data = await response.json();

      // Refresh active calls
      await fetchActiveCalls();

      // Show success message
      if (data.deletedCalls > 0) {
        alert(`Successfully removed ${data.deletedCalls} stale call(s)`);
      } else {
        alert('No stale calls found');
      }
    } catch (error) {
      console.error('Error cleaning up stale calls:', error);
      alert(`Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCleanupLoading(false);
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
        <div className="flex items-center gap-3">
          {activeCalls.length > 0 && (
            <button
              onClick={handleCleanupStaleCalls}
              disabled={cleanupLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove stale calls (inactive for 2+ hours)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {cleanupLoading ? 'Cleaning...' : 'Cleanup'}
            </button>
          )}
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
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
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
