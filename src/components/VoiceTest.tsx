import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
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
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  useEffect(() => {
    // Initialize VAPI
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
      setShowNamePrompt(false);
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
      console.error('VAPI Error:', error);
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
    if (!vapi || !userName.trim()) {
      setShowNamePrompt(true);
      return;
    }

    try {
      setCallStatus('connecting');

      // Start the call with the assistant
      await vapi.start(assistantId || undefined, {
        // Pass user name as metadata
        metadata: {
          userName: userName.trim()
        }
      });
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

  const handleStartWithName = () => {
    if (userName.trim()) {
      setShowNamePrompt(false);
      startCall();
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

      {/* Name Input Prompt */}
      {showNamePrompt && !isCallActive && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                What's your name?
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                The AI will use your name during the conversation
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleStartWithName()}
                  placeholder="Enter your name..."
                  className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  autoFocus
                />
                <button
                  onClick={handleStartWithName}
                  disabled={!userName.trim()}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Start Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Name Display */}
      {userName && !showNamePrompt && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <User className="w-4 h-4" />
          <span>Testing as: <span className="font-medium text-gray-900 dark:text-gray-100">{userName}</span></span>
          {!isCallActive && (
            <button
              onClick={() => setShowNamePrompt(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-xs ml-2"
            >
              Change
            </button>
          )}
        </div>
      )}

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
            onClick={() => userName.trim() ? startCall() : setShowNamePrompt(true)}
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
