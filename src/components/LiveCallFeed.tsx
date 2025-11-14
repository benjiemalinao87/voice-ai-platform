import { useState, useEffect, useRef } from 'react';
import { Phone, Clock, PhoneIncoming, PhoneOff, PhoneForwarded, Volume2, Trash2, Headphones, VolumeX } from 'lucide-react';

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

// Minimum call duration (in seconds) before "Listen Live" is available
const MIN_CALL_DURATION_FOR_LISTEN = 30;
const MIN_BUFFER_CHUNKS = 10; // ~0.5-1s of audio at 8kHz (640 samples per chunk)

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
  const [listeningToCall, setListeningToCall] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.8);

  // Audio streaming refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioBufferQueue = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const bufferSizeRef = useRef<number>(0);
  const processingIntervalRef = useRef<number | null>(null);

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

  const stopListening = () => {
    // Stop all active audio sources
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    });
    activeSourcesRef.current.clear();
    audioBufferQueue.current = [];
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    bufferSizeRef.current = 0;

    if (processingIntervalRef.current) {
      window.clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    gainNodeRef.current = null;
    setListeningToCall(null);
  };

  const handleListenLive = async (callId: string) => {
    // If already listening to this call, stop
    if (listeningToCall === callId) {
      stopListening();
      return;
    }

    // If listening to another call, stop that first
    if (listeningToCall) {
      stopListening();
    }

    setActionLoading(callId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${callId}/listen`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get listen URL');
      }

      const data = await response.json();
      const listenUrl = data.listenUrl;

      console.log('[Live Listen] Starting audio stream:', { callId, listenUrl });

      // Initialize Web Audio API
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = audioVolume;
      gainNode.connect(audioContext.destination);
      gainNodeRef.current = gainNode;

      // Connect to WebSocket
      const ws = new WebSocket(listenUrl);
      websocketRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[Live Listen] WebSocket connected');
        setListeningToCall(callId);
        setActionLoading(null);
        // Reset playback timing when starting (will be set with buffer on first chunk)
        nextPlayTimeRef.current = 0;

        if (!processingIntervalRef.current) {
          processingIntervalRef.current = window.setInterval(() => {
            try {
              processAudioQueue();
            } catch (err) {
              console.error('[Live Listen] Error processing audio queue:', err);
            }
          }, 20); // Process queue every 20ms for smooth playback
        }
      };

      // Just create buffer at 8kHz directly - let Web Audio API handle resampling
      // This uses the browser's native high-quality resampling instead of manual interpolation

      const processAudioQueue = () => {
        if (!audioContext || !gainNode) return;
        if (audioBufferQueue.current.length === 0) return;
        if (!isPlayingRef.current && audioBufferQueue.current.length < MIN_BUFFER_CHUNKS) {
          return;
        }

        const currentTime = audioContext.currentTime;

        // Initialize playback timing on first chunk
        if (nextPlayTimeRef.current === 0) {
          // Start with 1 second jitter buffer since call is already established
          nextPlayTimeRef.current = currentTime + 1.0;
          isPlayingRef.current = true;
          console.log('[Live Listen] Starting playback with 1000ms jitter buffer (call pre-established)');
        }

        const float32Data = audioBufferQueue.current.shift()!;

        try {
          // Create buffer at source 8kHz rate - Web Audio API will automatically
          // resample to output rate with high-quality built-in algorithm
          const sourceSampleRate = 8000;
          const audioBuffer = audioContext.createBuffer(1, float32Data.length, sourceSampleRate);
          audioBuffer.getChannelData(0).set(float32Data);

          // Check if we're falling behind
          if (nextPlayTimeRef.current < currentTime) {
            console.warn('[Live Listen] Playback falling behind, resyncing with 300ms buffer');
            nextPlayTimeRef.current = currentTime + 0.3;
          }

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gainNode);
          source.start(nextPlayTimeRef.current);

          // Clean up when done - IMPORTANT for memory management
          source.onended = () => {
            source.disconnect();
            activeSourcesRef.current.delete(source);
          };

          activeSourcesRef.current.add(source);

          // Update next play time
          nextPlayTimeRef.current += audioBuffer.duration;

          // Update buffer size tracking
          bufferSizeRef.current = Math.max(0, nextPlayTimeRef.current - currentTime);

        } catch (error) {
          console.error('[Live Listen] Error creating audio buffer:', error);
        }
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          try {
            // PCM audio data from VAPI is 16-bit signed integer, 8000 Hz, mono
            const pcmData = new Int16Array(event.data);

            // Skip empty packets
            if (pcmData.length === 0) return;

            const chunkSizeMs = (pcmData.length / 8000) * 1000;

            // Diagnostic: Check audio quality
            let minVal = Infinity, maxVal = -Infinity, zeroCount = 0;
            for (let i = 0; i < Math.min(pcmData.length, 100); i++) {
              const val = pcmData[i];
              if (val === 0) zeroCount++;
              minVal = Math.min(minVal, val);
              maxVal = Math.max(maxVal, val);
            }

            console.log(`[Live Listen] Received ${pcmData.length} samples (${chunkSizeMs.toFixed(1)}ms) | Range: ${minVal} to ${maxVal} | Zeros: ${zeroCount}/100`);

            // Convert to Float32Array for Web Audio API with ADAPTIVE GAIN
            // VAPI sends very low amplitude audio with ~50% zeros
            // Calculate RMS to adaptively boost the signal
            let sumSquares = 0;
            let nonZeroCount = 0;
            for (let i = 0; i < pcmData.length; i++) {
              if (pcmData[i] !== 0) {
                sumSquares += pcmData[i] * pcmData[i];
                nonZeroCount++;
              }
            }

            // Calculate RMS of non-zero samples
            const rms = nonZeroCount > 0 ? Math.sqrt(sumSquares / nonZeroCount) : 0;

            // Target RMS for clear audio (roughly 30% of max amplitude)
            const targetRMS = 32768 * 0.3;

            // Calculate adaptive gain (with safety limits)
            let adaptiveGain = rms > 0 ? targetRMS / rms : 1.0;
            adaptiveGain = Math.min(adaptiveGain, 500); // Cap at 500x max
            adaptiveGain = Math.max(adaptiveGain, 1);   // Minimum 1x

            console.log(`[Live Listen] RMS: ${rms.toFixed(1)} | Adaptive Gain: ${adaptiveGain.toFixed(1)}x`);

            const float32Data = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
              float32Data[i] = (pcmData[i] / 32768.0) * adaptiveGain;
              // Soft clip to prevent harsh distortion
              if (float32Data[i] > 1.0) float32Data[i] = 1.0;
              if (float32Data[i] < -1.0) float32Data[i] = -1.0;
            }

            // Add to buffer queue
            audioBufferQueue.current.push(float32Data);

            // Accumulate buffer before starting playback (jitter buffer)
            // Since call has already been running for 30s, we can be more aggressive with buffering
            const currentBufferSize = audioBufferQueue.current.length;

            if (!isPlayingRef.current && currentBufferSize >= MIN_BUFFER_CHUNKS) {
              console.log(`[Live Listen] Buffer ready (${currentBufferSize} chunks), starting playback`);
              processAudioQueue();
            } else if (isPlayingRef.current) {
              processAudioQueue();
            } else {
              console.log(`[Live Listen] Buffering... (${currentBufferSize}/${MIN_BUFFER_CHUNKS} chunks)`);
            }
            
            // Prevent buffer queue from growing too large (be more generous with limit)
            if (audioBufferQueue.current.length > 50) {
              console.warn('[Live Listen] Buffer queue too large, dropping oldest chunks');
              audioBufferQueue.current.splice(0, 10); // Drop 10 oldest chunks
            }

            // Monitor buffer health
            if (audioContext) {
              const bufferHealth = bufferSizeRef.current * 1000;
              if (bufferHealth < 50 && isPlayingRef.current) {
                console.warn(`[Live Listen] Low buffer: ${bufferHealth.toFixed(0)}ms`);
              }
            }

          } catch (error) {
            console.error('[Live Listen] Error processing audio:', error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('[Live Listen] WebSocket error:', error);
        alert('Failed to establish audio connection');
        stopListening();
        setActionLoading(null);
      };

      ws.onclose = () => {
        console.log('[Live Listen] WebSocket closed - cleaning up audio resources');
        
        // Always clean up audio resources when WebSocket closes
        activeSourcesRef.current.forEach(source => {
          try {
            source.stop();
            source.disconnect();
          } catch (e) {
            // Ignore errors from already stopped sources
          }
        });
        activeSourcesRef.current.clear();
        audioBufferQueue.current = [];
        nextPlayTimeRef.current = 0;
        isPlayingRef.current = false;
        bufferSizeRef.current = 0;

        if (processingIntervalRef.current) {
          window.clearInterval(processingIntervalRef.current);
          processingIntervalRef.current = null;
        }

        if (audioContextRef.current) {
          audioContextRef.current.close().catch(err => {
            console.error('[Live Listen] Error closing AudioContext:', err);
          });
          audioContextRef.current = null;
        }
        gainNodeRef.current = null;
        
        // Clear the listening state
        setListeningToCall(null);
        
        console.log('[Live Listen] Cleanup complete');
      };

    } catch (error) {
      console.error('Error starting live listen:', error);
      alert(`Failed to listen: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setActionLoading(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

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

  // Check if call has been active long enough for stable audio streaming
  const isCallReadyForListening = (call: ActiveCall): boolean => {
    const now = Math.floor(Date.now() / 1000);
    const duration = now - call.started_at;
    return duration >= MIN_CALL_DURATION_FOR_LISTEN && call.status === 'in-progress';
  };

  // Get remaining time until listen is available
  const getTimeUntilListenAvailable = (call: ActiveCall): number => {
    const now = Math.floor(Date.now() / 1000);
    const duration = now - call.started_at;
    return Math.max(0, MIN_CALL_DURATION_FOR_LISTEN - duration);
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
                        <div className="flex items-center gap-2">
                          {isCallReadyForListening(call) ? (
                            <button
                              onClick={() => handleListenLive(call.vapi_call_id)}
                              disabled={actionLoading === call.vapi_call_id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                listeningToCall === call.vapi_call_id
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                  : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                              }`}
                              title={listeningToCall === call.vapi_call_id ? 'Stop listening' : 'Listen to call live (high-quality audio)'}
                            >
                              {listeningToCall === call.vapi_call_id ? (
                                <>
                                  <VolumeX className="w-4 h-4 animate-pulse" />
                                  Listening...
                                </>
                              ) : (
                                <>
                                  <Headphones className="w-4 h-4" />
                                  Listen Live
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 animate-pulse" />
                              <span className="text-gray-600 dark:text-gray-400">
                                Listen available in {getTimeUntilListenAvailable(call)}s
                              </span>
                            </div>
                          )}
                          {listeningToCall === call.vapi_call_id && (
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                              <Volume2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={audioVolume * 100}
                                onChange={(e) => {
                                  const newVolume = parseInt(e.target.value) / 100;
                                  setAudioVolume(newVolume);
                                  if (gainNodeRef.current) {
                                    gainNodeRef.current.gain.value = newVolume;
                                  }
                                }}
                                className="w-24 h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                title={`Volume: ${Math.round(audioVolume * 100)}%`}
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-8">
                                {Math.round(audioVolume * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
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
