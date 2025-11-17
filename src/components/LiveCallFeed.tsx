import { useState, useEffect, useRef } from 'react';
import { Phone, Clock, PhoneIncoming, PhoneOff, PhoneForwarded, Volume2, Trash2, Headphones, MessageSquare, Mic, MicOff } from 'lucide-react';

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

// Mulaw decoder for phone audio (G.711 μ-law)
function decodeMulaw(mulawData: Uint8Array): Float32Array {
  const pcmData = new Float32Array(mulawData.length);
  const MULAW_BIAS = 0x84;
  const MULAW_MAX = 0x1FFF;

  for (let i = 0; i < mulawData.length; i++) {
    let mulawByte = ~mulawData[i];
    const sign = (mulawByte & 0x80);
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0F;
    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS << exponent;
    if (exponent === 0) sample += MULAW_BIAS >> 1;
    if (sign !== 0) sample = -sample;
    pcmData[i] = sample / MULAW_MAX;
  }

  return pcmData;
}

export function LiveCallFeed() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferNumber, setTransferNumber] = useState<string>('');
  const [showTransferInput, setShowTransferInput] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previousCallIds, setPreviousCallIds] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [listeningCallId, setListeningCallId] = useState<string | null>(null);
  const [listenLoading, setListenLoading] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<{ ai: number; customer: number }>({ ai: 0, customer: 0 });
  const [controlMode, setControlMode] = useState<'listen' | 'say' | 'context'>('listen');
  const [controlUrl, setControlUrl] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';

        // If call is not active (already ended), just refresh the list silently
        if (errorDetails.includes('Not Active')) {
          console.log('Call already ended, refreshing active calls list...');
          await fetchActiveCalls();
          return;
        }

        // Provide more helpful error messages
        if (response.status === 404) {
          throw new Error('Call not found. It may have already ended.');
        } else if (response.status === 400) {
          throw new Error(errorMessage + errorDetails);
        } else {
          throw new Error(`Failed to end call: ${errorMessage}${errorDetails}`);
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

  const handleListenToCall = async (callId: string) => {
    setListenLoading(callId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${callId}/listen`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get listen URL');
      }

      const data = await response.json();

      if (!data.listenUrl) {
        throw new Error('Listen URL not available for this call');
      }

      console.log('🎧 Now listening to call:', callId);
      console.log('🎛️ Control URL:', data.controlUrl);

      // Stop any currently playing audio FIRST (before setting new state)
      if (listeningCallId) {
        handleStopListening();
      }

      // Store control URL for interventions
      setControlUrl(data.controlUrl || null);

      // Create AudioContext for Web Audio API
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume AudioContext if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Connect to WebSocket for audio streaming
      const ws = new WebSocket(data.listenUrl);
      websocketRef.current = ws;

      ws.binaryType = 'arraybuffer';

      // Buffer to collect audio chunks for smoother playback
      let nextStartTime = audioContextRef.current.currentTime;
      let vapiConfig: any = null; // Store audio service config

      ws.onopen = () => {
        console.log('✅ WebSocket connected - audio stream started');
        setListeningCallId(callId);
      };

      ws.onmessage = async (event) => {
        try {
          if (!audioContextRef.current) return;

          // Handle different data formats
          let audioData: ArrayBuffer;

          if (event.data instanceof ArrayBuffer) {
            audioData = event.data;
          } else if (event.data instanceof Blob) {
            audioData = await event.data.arrayBuffer();
          } else if (typeof event.data === 'string') {
            // Audio service sends JSON protocol messages - store config
            try {
              const message = JSON.parse(event.data);
              console.debug('📨 Audio protocol message:', message);
              if (message.type === 'start') {
                vapiConfig = message; // Store audio config
                console.log('🎵 Audio config:', {
                  encoding: message.encoding,
                  sampleRate: message.sampleRate,
                  channels: message.channels,
                  container: message.container
                });
              }
              return; // Skip non-audio messages
            } catch {
              console.debug('Skipping non-JSON string message');
              return;
            }
          } else {
            console.warn('Unknown audio data format:', typeof event.data);
            return;
          }

          // Skip empty packets
          if (audioData.byteLength === 0) return;

          // Use audio config if available, otherwise use defaults
          const sampleRate = vapiConfig?.sampleRate || 16000;
          const channels = vapiConfig?.channels || 2;
          const encoding = vapiConfig?.encoding || 'linear16';

          // Audio service sends linear16 (16-bit PCM) stereo at 16kHz
          try {
            const int16Array = new Int16Array(audioData);
            const samplesPerChannel = int16Array.length / channels;

            // Create MONO audio buffer (mix both channels so we hear both AI and customer)
            const audioBuffer = audioContextRef.current.createBuffer(
              1, // MONO - mix both channels
              samplesPerChannel,
              sampleRate
            );

            // Mix stereo channels into mono (so we hear both AI and customer)
            const monoData = audioBuffer.getChannelData(0);
            let aiSum = 0;
            let customerSum = 0;

            for (let i = 0; i < samplesPerChannel; i++) {
              const leftSample = int16Array[i * channels] / 32768.0;      // Customer (Channel 0)
              const rightSample = int16Array[i * channels + 1] / 32768.0; // AI Assistant (Channel 1)
              monoData[i] = (leftSample + rightSample) / 2; // Mix both channels

              // Calculate RMS levels for visualization (SWAPPED: left=customer, right=AI)
              customerSum += leftSample * leftSample;
              aiSum += rightSample * rightSample;
            }

            // Update audio levels (RMS - Root Mean Square for accurate volume)
            const aiLevel = Math.sqrt(aiSum / samplesPerChannel);
            const customerLevel = Math.sqrt(customerSum / samplesPerChannel);
            setAudioLevels({ ai: aiLevel, customer: customerLevel });

            // Schedule audio playback
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            const now = audioContextRef.current.currentTime;
            const startTime = Math.max(now, nextStartTime);
            source.start(startTime);
            nextStartTime = startTime + audioBuffer.duration;

            audioQueueRef.current.push(source);

            // Clean up old sources
            source.onended = () => {
              const index = audioQueueRef.current.indexOf(source);
              if (index > -1) {
                audioQueueRef.current.splice(index, 1);
              }
            };
          } catch (pcmError) {
            console.error('Error decoding PCM audio:', pcmError);
          }
        } catch (err) {
          console.error('Error processing audio:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        alert('Failed to connect to audio stream. Please check your connection and try again.');
        handleStopListening();
      };

      ws.onclose = (event) => {
        console.log('🔇 WebSocket closed - audio stream ended', event.code, event.reason);
        if (listeningCallId === callId) {
          handleStopListening();
        }
      };

    } catch (error) {
      console.error('Error listening to call:', error);
      alert(`Failed to listen to call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      handleStopListening();
    } finally {
      setListenLoading(null);
    }
  };

  // Send message via backend proxy (Say mode - AI speaks it)
  const handleSendMessage = async (textOverride?: string) => {
    // Ensure textOverride is a string (prevent event objects from being passed)
    const textToSend = (typeof textOverride === 'string' ? textOverride : messageInput.trim());
    if (!textToSend || !controlUrl || !listeningCallId) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${listeningCallId}/control/say`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      console.log('📤 Message sent to AI:', textToSend);
      setMessageInput(''); // Clear input after successful send
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Add context message via backend proxy (Context mode - adds to conversation history)
  const handleAddContext = async (textOverride?: string) => {
    // Ensure textOverride is a string (prevent event objects from being passed)
    const textToSend = (typeof textOverride === 'string' ? textOverride : messageInput.trim());
    if (!textToSend || !controlUrl || !listeningCallId) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${listeningCallId}/control/add-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            role: 'system',
            content: textToSend
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add context');
      }

      console.log('📝 Context added to conversation:', textToSend);
      setMessageInput(''); // Clear input after successful send
    } catch (error) {
      console.error('Error adding context:', error);
      alert('Failed to add context. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Start recording microphone
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Transcribe the audio
        await handleTranscribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('🎤 Started recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  // Stop recording microphone
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('🛑 Stopped recording');
    }
  };

  // Transcribe audio using Deepgram
  const handleTranscribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${API_URL}/api/speech-to-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const result = await response.json();
      const transcribedText = result.text;

      console.log('📝 Transcribed text:', transcribedText);

      // Automatically send based on current mode (pass text directly)
      if (controlMode === 'say') {
        await handleSendMessage(transcribedText);
      } else if (controlMode === 'context') {
        await handleAddContext(transcribedText);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleStopListening = () => {
    // Stop all playing audio sources immediately
    audioQueueRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    audioQueueRef.current = [];

    // Close WebSocket connection
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    // Don't close AudioContext, just suspend it for reuse
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.suspend();
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Reset state
    setAudioLevels({ ai: 0, customer: 0 });
    setControlMode('listen');
    setControlUrl(null);
    setMessageInput('');
    setIsRecording(false);
    setIsTranscribing(false);
    setListeningCallId(null);
    console.log('🔇 Stopped listening');
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      handleStopListening();
    };
  }, []);

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
                        {/* Listen Button */}
                        {listeningCallId === call.vapi_call_id ? (
                          <button
                            onClick={handleStopListening}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm animate-pulse"
                          >
                            <Headphones className="w-4 h-4" />
                            Listening...
                          </button>
                        ) : (
                          <button
                            onClick={() => handleListenToCall(call.vapi_call_id)}
                            disabled={actionLoading === call.vapi_call_id || listenLoading === call.vapi_call_id || !!listeningCallId}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Listen to live call"
                          >
                            <Headphones className="w-4 h-4" />
                            {listenLoading === call.vapi_call_id ? 'Loading...' : 'Listen'}
                          </button>
                        )}

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

                {/* Waveform Visualization & Controls - Show when listening */}
                {listeningCallId === call.vapi_call_id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
                    {/* Control Mode Selection */}
                    <div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Control Mode {!controlUrl && <span className="text-red-500">(Not Available)</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setControlMode('listen')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            controlMode === 'listen'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <Headphones className="w-3.5 h-3.5 mx-auto mb-1" />
                          Listen Only
                        </button>
                        <button
                          onClick={() => setControlMode('say')}
                          disabled={!controlUrl}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            controlMode === 'say'
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5 mx-auto mb-1" />
                          Say Message
                        </button>
                        <button
                          onClick={() => setControlMode('context')}
                          disabled={!controlUrl}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            controlMode === 'context'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 mx-auto mb-1" />
                          Add Context
                        </button>
                      </div>
                      <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {controlMode === 'listen' && '👂 Listen to the call without intervening'}
                        {controlMode === 'say' && '📢 Make the AI speak your message'}
                        {controlMode === 'context' && '📝 Add context to conversation history'}
                      </div>
                    </div>

                    {/* Text Input Control */}
                    {controlMode !== 'listen' && controlUrl && (
                      <div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (controlMode === 'say') {
                                  handleSendMessage();
                                } else {
                                  handleAddContext();
                                }
                              }
                            }}
                            placeholder={
                              isTranscribing
                                ? 'Transcribing...'
                                : controlMode === 'say'
                                ? 'Type or speak message for AI...'
                                : 'Type or speak context to add...'
                            }
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            disabled={sendingMessage || isRecording || isTranscribing}
                          />
                          <button
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            disabled={sendingMessage || isTranscribing}
                            className={`px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                              isRecording
                                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                            title={isRecording ? 'Stop recording' : 'Start voice recording'}
                          >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              if (controlMode === 'say') {
                                handleSendMessage();
                              } else {
                                handleAddContext();
                              }
                            }}
                            disabled={!messageInput.trim() || sendingMessage || isRecording || isTranscribing}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            {sendingMessage ? 'Sending...' : isTranscribing ? 'Transcribing...' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Audio Levels */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Audio Levels
                      </div>

                      {/* AI Assistant Level */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-16">AI</span>
                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-100 ease-out flex items-center justify-end pr-2"
                            style={{ width: `${Math.min(audioLevels.ai * 200, 100)}%` }}
                          >
                            {audioLevels.ai > 0.05 && (
                              <span className="text-[10px] font-bold text-white drop-shadow">
                                {Math.round(audioLevels.ai * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Customer Level */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-16">Customer</span>
                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-100 ease-out flex items-center justify-end pr-2"
                            style={{ width: `${Math.min(audioLevels.customer * 200, 100)}%` }}
                          >
                            {audioLevels.customer > 0.05 && (
                              <span className="text-[10px] font-bold text-white drop-shadow">
                                {Math.round(audioLevels.customer * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
