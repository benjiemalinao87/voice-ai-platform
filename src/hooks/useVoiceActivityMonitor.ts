import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface VoiceActivity {
  customer: number; // 0-1, RMS level
  ai: number; // 0-1, RMS level
  isCustomerSpeaking: boolean;
  isAISpeaking: boolean;
}

interface VoiceActivityState {
  [callId: string]: VoiceActivity;
}

// Threshold for detecting speech (RMS level)
const SPEECH_THRESHOLD = 0.05;

// Retry configuration
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_COOLDOWN_MS = 30000; // 30 seconds before retrying a failed call

interface FailedCall {
  attempts: number;
  lastAttempt: number;
}

export function useVoiceActivityMonitor(
  activeCalls: Array<{ vapi_call_id: string; status: string }>,
  enabled: boolean = true
) {
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivityState>({});
  const websocketsRef = useRef<Map<string, WebSocket>>(new Map());
  const audioContextsRef = useRef<Map<string, AudioContext>>(new Map());
  const isMonitoringRef = useRef<Set<string>>(new Set());
  const failedCallsRef = useRef<Map<string, FailedCall>>(new Map());
  const isMountedRef = useRef(true);

  // Fetch batch listen URLs
  const fetchListenUrls = useCallback(async (callIds: string[]): Promise<Map<string, string>> => {
    if (!enabled) return new Map();
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return new Map();

      const response = await fetch(`${API_URL}/api/calls/batch-listen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ callIds })
      });

      if (!response.ok) {
        console.warn('[Voice Monitor] Failed to fetch batch listen URLs:', response.status);
        return new Map();
      }

      const data = await response.json();
      const urlMap = new Map<string, string>();

      for (const result of data.results || []) {
        if (result.listenUrl && !result.error) {
          urlMap.set(result.callId, result.listenUrl);
        }
      }

      return urlMap;
    } catch (error) {
      console.warn('[Voice Monitor] Error fetching listen URLs:', error);
      return new Map();
    }
  }, [enabled]);

  // Process audio data to detect voice activity
  const processAudioData = useCallback((
    audioData: ArrayBuffer,
    callId: string,
    sampleRate: number,
    channels: number
  ) => {
    if (!isMountedRef.current) return;
    
    try {
      const int16Array = new Int16Array(audioData);
      const samplesPerChannel = int16Array.length / channels;

      if (samplesPerChannel <= 0) return;

      let customerSum = 0;
      let aiSum = 0;

      // Calculate RMS for each channel
      for (let i = 0; i < samplesPerChannel; i++) {
        const leftSample = int16Array[i * channels] / 32768.0;      // Customer (Channel 0)
        const rightSample = int16Array[i * channels + 1] / 32768.0; // AI Assistant (Channel 1)
        
        customerSum += leftSample * leftSample;
        aiSum += rightSample * rightSample;
      }

      // Calculate RMS levels
      const customerLevel = Math.sqrt(customerSum / samplesPerChannel);
      const aiLevel = Math.sqrt(aiSum / samplesPerChannel);

      // Update voice activity state
      setVoiceActivity(prev => ({
        ...prev,
        [callId]: {
          customer: customerLevel,
          ai: aiLevel,
          isCustomerSpeaking: customerLevel > SPEECH_THRESHOLD,
          isAISpeaking: aiLevel > SPEECH_THRESHOLD
        }
      }));
    } catch (error) {
      // Silently ignore processing errors
    }
  }, []);

  // Cleanup connection for a call (without triggering reconnect)
  const cleanupCall = useCallback((callId: string, markAsFailed: boolean = false) => {
    const ws = websocketsRef.current.get(callId);
    if (ws) {
      // Remove event handlers to prevent triggering onclose again
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      websocketsRef.current.delete(callId);
    }

    const audioContext = audioContextsRef.current.get(callId);
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContextsRef.current.delete(callId);
    }

    isMonitoringRef.current.delete(callId);

    // Track failed attempts
    if (markAsFailed) {
      const existing = failedCallsRef.current.get(callId) || { attempts: 0, lastAttempt: 0 };
      failedCallsRef.current.set(callId, {
        attempts: existing.attempts + 1,
        lastAttempt: Date.now()
      });
    }

    // Clear voice activity for this call
    if (isMountedRef.current) {
      setVoiceActivity(prev => {
        const next = { ...prev };
        delete next[callId];
        return next;
      });
    }
  }, []);

  // Connect to WebSocket for a single call
  const connectToCall = useCallback(async (callId: string, listenUrl: string) => {
    // Skip if already monitoring or not mounted
    if (isMonitoringRef.current.has(callId) || !isMountedRef.current || !enabled) {
      return;
    }

    // Check if this call has failed too many times recently
    const failedInfo = failedCallsRef.current.get(callId);
    if (failedInfo) {
      if (failedInfo.attempts >= MAX_RETRY_ATTEMPTS) {
        const timeSinceLastAttempt = Date.now() - failedInfo.lastAttempt;
        if (timeSinceLastAttempt < RETRY_COOLDOWN_MS) {
          // Still in cooldown period, skip
          return;
        }
        // Cooldown expired, reset attempts
        failedCallsRef.current.delete(callId);
      }
    }

    isMonitoringRef.current.add(callId);

    try {
      // Create AudioContext for this call (we won't play audio, just analyze)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextsRef.current.set(callId, audioContext);

      // Connect to WebSocket
      const ws = new WebSocket(listenUrl);
      websocketsRef.current.set(callId, ws);

      ws.binaryType = 'arraybuffer';
      let vapiConfig: any = null;
      let hasReceivedData = false;

      ws.onopen = () => {
        if (isMountedRef.current) {
          console.log(`[Voice Monitor] Connected to call ${callId}`);
        }
      };

      ws.onmessage = async (event) => {
        if (!isMountedRef.current) return;
        hasReceivedData = true;
        
        try {
          // Handle different data formats
          let audioData: ArrayBuffer;

          if (event.data instanceof ArrayBuffer) {
            audioData = event.data;
          } else if (event.data instanceof Blob) {
            audioData = await event.data.arrayBuffer();
          } else if (typeof event.data === 'string') {
            // Audio service sends JSON protocol messages
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'start') {
                vapiConfig = message;
              }
              return; // Skip non-audio messages
            } catch {
              return;
            }
          } else {
            return;
          }

          // Skip empty packets
          if (audioData.byteLength === 0) return;

          // Use audio config if available, otherwise use defaults
          const sampleRate = vapiConfig?.sampleRate || 16000;
          const channels = vapiConfig?.channels || 2;

          // Process audio to detect voice activity
          processAudioData(audioData, callId, sampleRate, channels);
        } catch (err) {
          // Silently ignore message processing errors
        }
      };

      ws.onerror = () => {
        // Don't log errors to avoid console spam
        // Mark as failed if we never received any data
        if (!hasReceivedData && isMountedRef.current) {
          cleanupCall(callId, true);
        }
      };

      ws.onclose = () => {
        if (isMountedRef.current) {
          // Only mark as failed if we never received data
          cleanupCall(callId, !hasReceivedData);
        }
      };
    } catch (error) {
      console.warn(`[Voice Monitor] Error connecting to call ${callId}:`, error);
      isMonitoringRef.current.delete(callId);
      
      // Mark as failed
      const existing = failedCallsRef.current.get(callId) || { attempts: 0, lastAttempt: 0 };
      failedCallsRef.current.set(callId, {
        attempts: existing.attempts + 1,
        lastAttempt: Date.now()
      });
    }
  }, [processAudioData, cleanupCall, enabled]);

  // Monitor active calls
  useEffect(() => {
    if (!enabled) {
      // Cleanup all connections if disabled
      for (const callId of Array.from(websocketsRef.current.keys())) {
        cleanupCall(callId, false);
      }
      return;
    }

    // Only monitor "in-progress" calls
    const inProgressCalls = activeCalls.filter(call => call.status === 'in-progress');
    const callIds = inProgressCalls.map(call => call.vapi_call_id);

    // Limit concurrent connections to prevent browser limits
    const MAX_CONCURRENT = 3; // Reduced from 6
    const callsToMonitor = callIds.slice(0, MAX_CONCURRENT);

    // Cleanup calls that are no longer active
    const activeCallIds = new Set(callIds);
    for (const monitoredCallId of Array.from(websocketsRef.current.keys())) {
      if (!activeCallIds.has(monitoredCallId)) {
        cleanupCall(monitoredCallId, false);
        // Also clear from failed tracking
        failedCallsRef.current.delete(monitoredCallId);
      }
    }

    // Filter out calls that are already being monitored or have failed too many times
    const callsToConnect = callsToMonitor.filter(callId => {
      if (isMonitoringRef.current.has(callId)) return false;
      
      const failedInfo = failedCallsRef.current.get(callId);
      if (failedInfo && failedInfo.attempts >= MAX_RETRY_ATTEMPTS) {
        const timeSinceLastAttempt = Date.now() - failedInfo.lastAttempt;
        if (timeSinceLastAttempt < RETRY_COOLDOWN_MS) {
          return false; // Still in cooldown
        }
      }
      
      return true;
    });

    // Fetch listen URLs and connect to new calls
    if (callsToConnect.length > 0) {
      fetchListenUrls(callsToConnect).then(urlMap => {
        if (!isMountedRef.current) return;
        
        for (const callId of callsToConnect) {
          const listenUrl = urlMap.get(callId);
          if (listenUrl) {
            connectToCall(callId, listenUrl);
          }
        }
      });
    }
  }, [activeCalls, fetchListenUrls, connectToCall, cleanupCall, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      for (const callId of Array.from(websocketsRef.current.keys())) {
        cleanupCall(callId, false);
      }
      
      failedCallsRef.current.clear();
    };
  }, [cleanupCall]);

  return voiceActivity;
}
