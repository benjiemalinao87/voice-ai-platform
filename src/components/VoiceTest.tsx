import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import Vapi from '@vapi-ai/web';

interface VoiceTestProps {
  assistantId?: string;
  publicKey: string;
}

export function VoiceTest({ assistantId, publicKey }: VoiceTestProps) {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [volumeLevel, setVolumeLevel] = useState(0);

  useEffect(() => {
    // Initialize Voice AI client
    const vapiInstance = new Vapi(publicKey);
    setVapi(vapiInstance);

    // Set up event listeners
    vapiInstance.on('call-start', () => {
      setIsCallActive(true);
      setCallStatus('connected');
    });

    vapiInstance.on('call-end', () => {
      setIsCallActive(false);
      setCallStatus('ended');
    });

    vapiInstance.on('speech-start', () => {
      setCallStatus('speaking');
    });

    vapiInstance.on('speech-end', () => {
      setCallStatus('listening');
    });

    vapiInstance.on('volume-level', (level: number) => {
      setVolumeLevel(level);
    });

    vapiInstance.on('error', (error: any) => {
      console.error('CHAU Voice AI Error:', error);
      setCallStatus('error');
      setIsCallActive(false);
    });

    return () => {
      // Cleanup
      if (vapiInstance) {
        vapiInstance.stop();
      }
    };
  }, [publicKey]);

  const startCall = async () => {
    if (!vapi) {
      return;
    }

    try {
      setCallStatus('connecting');

      // Start the call with the assistant
      await vapi.start(assistantId || undefined);
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('error');
    }
  };

  const endCall = () => {
    if (vapi) {
      vapi.stop();
      setIsCallActive(false);
      setCallStatus('idle');
    }
  };

  const toggleMute = () => {
    if (vapi) {
      if (isMuted) {
        vapi.setMuted(false);
      } else {
        vapi.setMuted(true);
      }
      setIsMuted(!isMuted);
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'connected':
      case 'listening':
        return 'text-green-600 dark:text-green-400';
      case 'speaking':
        return 'text-blue-600 dark:text-blue-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'AI Speaking...';
      case 'ended':
        return 'Call Ended';
      case 'error':
        return 'Error occurred';
      default:
        return 'Ready to call';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Voice Test</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Test your AI assistant with a web call
          </p>
        </div>
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          <div className={`w-2 h-2 rounded-full ${
            isCallActive ? 'bg-current animate-pulse' : 'bg-current'
          }`} />
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      {/* Volume Level Indicator */}
      {isCallActive && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Voice Level</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-100"
              style={{ width: `${Math.min(volumeLevel * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="flex gap-3">
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={callStatus === 'connecting'}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Phone className="w-5 h-5" />
            {callStatus === 'connecting' ? 'Connecting...' : 'Start Call'}
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isMuted
                  ? 'bg-yellow-600 dark:bg-yellow-500 text-white hover:bg-yellow-700 dark:hover:bg-yellow-600'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={endCall}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors font-medium"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      {!isCallActive && callStatus === 'idle' && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Tip:</strong> Make sure your microphone is enabled and allow browser permissions when prompted.
          </p>
        </div>
      )}
    </div>
  );
}
