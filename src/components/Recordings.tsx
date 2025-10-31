import { useState, useEffect } from 'react';
import { Play, Pause, Phone, Clock, Calendar, User, MapPin, Download, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { d1Client } from '../lib/d1';
import type { WebhookCall } from '../types';
import { CustomerProfile } from './CustomerProfile';

interface TranscriptMessage {
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
}

interface Recording {
  id: string;
  caller: string;
  phone: string;
  customerPhone?: string;
  duration: number;
  date: string;
  location: string;
  audioUrl: string;
  transcript?: TranscriptMessage[];
  sentiment: 'positive' | 'neutral' | 'negative';
  wasAnswered: boolean;
  summary?: string;
  endedReason?: string;
  enhancedData?: any;
  callerType?: string;
  carrierName?: string;
  lineType?: string;
}

// Mock recordings data
const mockRecordings: Recording[] = [
  {
    id: '1',
    caller: 'John Smith',
    phone: '+1 (555) 123-4567',
    duration: 245,
    date: '2025-01-14T10:30:00',
    location: 'New York, NY',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    transcript: [
      {
        role: 'assistant',
        text: 'Thank you for calling North Star Memorial Group. Where service is our promise and compassion is our creed. How may I help you today?',
        timestamp: '8:18:50 AM (+00:00:00)'
      },
      {
        role: 'user',
        text: 'Hi, I\'m interested in pre-planning funeral services for my family. Can you tell me more about your pricing plans?',
        timestamp: '8:18:58 AM (+00:08:08)'
      },
      {
        role: 'assistant',
        text: 'Of course, I\'d be happy to help you with that. We offer several pre-planning options to fit different needs and budgets. May I ask if you\'re looking for services for yourself or a loved one?',
        timestamp: '8:19:10 AM (+00:20:20)'
      },
      {
        role: 'user',
        text: 'For my parents actually. They\'re getting older and want to make sure everything is arranged.',
        timestamp: '8:19:25 AM (+00:35:25)'
      }
    ],
    sentiment: 'positive',
    wasAnswered: true
  },
  {
    id: '2',
    caller: 'Sarah Johnson',
    phone: '+1 (555) 234-5678',
    duration: 180,
    date: '2025-01-14T09:15:00',
    location: 'Los Angeles, CA',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    transcript: [
      {
        role: 'assistant',
        text: 'Thank you for calling North Star Memorial Group. How may I assist you today?',
        timestamp: '9:15:00 AM (+00:00:00)'
      },
      {
        role: 'user',
        text: 'Yes, I need to schedule a consultation. Do you have any availability this week?',
        timestamp: '9:15:12 AM (+00:00:12)'
      },
      {
        role: 'assistant',
        text: 'Let me check our calendar for you. We have openings on Wednesday at 2 PM and Thursday at 10 AM. Which would work better for you?',
        timestamp: '9:15:28 AM (+00:00:28)'
      }
    ],
    sentiment: 'neutral',
    wasAnswered: true
  },
  {
    id: '3',
    caller: 'Mike Williams',
    phone: '+1 (555) 345-6789',
    duration: 120,
    date: '2025-01-14T08:45:00',
    location: 'Chicago, IL',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    transcript: [
      {
        role: 'assistant',
        text: 'Good morning, thank you for calling North Star Memorial. How can I help you?',
        timestamp: '8:45:00 AM (+00:00:00)'
      },
      {
        role: 'user',
        text: 'I\'m having trouble accessing the online portal for my account. I need to review my pre-arrangement details.',
        timestamp: '8:45:08 AM (+00:00:08)'
      },
      {
        role: 'assistant',
        text: 'I apologize for the inconvenience. I can help you with that. May I have your account number or the name on the account?',
        timestamp: '8:45:20 AM (+00:00:20)'
      }
    ],
    sentiment: 'negative',
    wasAnswered: true
  },
  {
    id: '4',
    caller: 'Emily Davis',
    phone: '+1 (555) 456-7890',
    duration: 310,
    date: '2025-01-13T16:20:00',
    location: 'Houston, TX',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    transcript: [
      {
        role: 'assistant',
        text: 'Thank you for calling North Star Memorial Group. Where service is our promise and compassion is our creed. How may I help you today?',
        timestamp: '4:20:00 PM (+00:00:00)'
      },
      {
        role: 'user',
        text: 'Hello, I wanted to thank you for the wonderful service last week. Everything was handled so professionally and with such care. I\'d like to schedule a follow-up to discuss memorial options.',
        timestamp: '4:20:15 PM (+00:00:15)'
      },
      {
        role: 'assistant',
        text: 'Thank you so much for your kind words. We\'re glad we could be there for you during this difficult time. I\'d be happy to schedule a follow-up consultation. When would be convenient for you?',
        timestamp: '4:20:35 PM (+00:00:35)'
      }
    ],
    sentiment: 'positive',
    wasAnswered: true
  },
  {
    id: '5',
    caller: 'Unknown Caller',
    phone: '+1 (555) 567-8901',
    duration: 0,
    date: '2025-01-13T15:10:00',
    location: 'Miami, FL',
    audioUrl: '',
    sentiment: 'neutral',
    wasAnswered: false
  }
];

export function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<{ [key: string]: boolean }>({});
  const [hasMore, setHasMore] = useState(true);
  const [limit] = useState(10); // Show 10 at a time
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadRecordings(true);
  }, []);

  const loadRecordings = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const webhookCalls = await d1Client.getWebhookCalls({
        limit,
        offset: currentOffset
      });

      // Convert webhook calls to Recording format (enhanced data is already included!)
      const convertedRecordings: Recording[] = webhookCalls.map((call) => {
        // Parse raw_payload to extract transcript
        let transcript: TranscriptMessage[] = [];
        let location = 'Unknown';
        let callerName = 'Unknown Caller';

        // Use Twilio enriched data first (if available)
        if (call.caller_name) {
          callerName = call.caller_name;
        }

        try {
          if (call.raw_payload) {
            const payload = typeof call.raw_payload === 'string'
              ? JSON.parse(call.raw_payload)
              : call.raw_payload;

            // Extract transcript from artifact
            if (payload.message?.artifact?.transcript) {
              const transcriptText = payload.message.artifact.transcript;
              // Simple parsing - you can enhance this to split by speaker
              transcript = [{
                role: 'assistant',
                text: transcriptText,
                timestamp: new Date(call.created_at * 1000).toLocaleTimeString() // Convert Unix timestamp to milliseconds
              }];
            }

            // Try to extract location from customer data if available
            if (payload.message?.customer?.location) {
              location = payload.message.customer.location;
            }
          }

          // Fallback to structured_data name if Twilio didn't provide it
          if (!call.caller_name && call.structured_data?.name) {
            callerName = call.structured_data.name;
          }
        } catch (error) {
          console.error('Error parsing webhook payload:', error);
        }

        // Enhanced data is now included in the API response - no need for separate fetch!
        const enhancedData = call.enhanced_data || null;

        // Calculate duration from recording if available
        const duration = 180; // Default, we don't have duration in webhook data yet

        return {
          id: call.id,
          caller: callerName,
          phone: call.phone_number || 'N/A',  // Business/AI agent phone
          customerPhone: call.customer_number || undefined,  // Customer's phone
          duration: duration,
          date: new Date(call.created_at * 1000).toISOString(), // Convert Unix timestamp (seconds) to milliseconds
          location: location,
          audioUrl: call.recording_url || '',
          transcript: transcript.length > 0 ? transcript : undefined,
          sentiment: 'neutral' as const, // We can add sentiment analysis later
          wasAnswered: !!call.recording_url, // If there's a recording, it was answered
          summary: call.summary || undefined,
          endedReason: call.ended_reason,
          enhancedData: enhancedData,
          callerType: call.caller_type || undefined,
          carrierName: call.carrier_name || undefined,
          lineType: call.line_type || undefined
        };
      });

      // Check if we have more data
      setHasMore(convertedRecordings.length === limit);

      // Append or replace recordings based on reset flag
      if (reset) {
        setRecordings(convertedRecordings);
        setOffset(limit); // Set offset to limit for next load
      } else {
        setRecordings(prev => [...prev, ...convertedRecordings]);
        setOffset(prev => prev + limit); // Increment offset for next load
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
      // Fallback to mock data on error (only on initial load)
      if (reset) {
        setRecordings(mockRecordings);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadRecordings(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePlayPause = (recordingId: string) => {
    const audio = document.getElementById(`audio-${recordingId}`) as HTMLAudioElement;

    if (!audio) return;

    if (playingId === recordingId) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing audio
      if (playingId) {
        const currentAudio = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
        if (currentAudio) currentAudio.pause();
      }

      audio.play();
      setPlayingId(recordingId);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'negative':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Call Recordings</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Listen to recorded calls and view transcripts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {recordings.length} recordings
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              {/* Play Button */}
              <button
                onClick={() => recording.wasAnswered && handlePlayPause(recording.id)}
                disabled={!recording.wasAnswered}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  recording.wasAnswered
                    ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {playingId === recording.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Recording Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {recording.caller}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {recording.customerPhone || recording.phone}
                      </span>
                      {recording.carrierName && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                          {recording.carrierName}
                          {recording.lineType && ` • ${recording.lineType}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(recording.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {recording.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(recording.sentiment)}`}>
                      {recording.sentiment}
                    </span>
                    {recording.wasAnswered ? (
                      <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(recording.duration)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                        Missed
                      </span>
                    )}
                  </div>
                </div>

                {/* Audio Progress Bar */}
                {recording.wasAnswered && recording.audioUrl && (
                  <div className="mb-2">
                    <audio
                      id={`audio-${recording.id}`}
                      src={recording.audioUrl}
                      onTimeUpdate={(e) => {
                        const audio = e.currentTarget;
                        setCurrentTime({
                          ...currentTime,
                          [recording.id]: audio.currentTime
                        });
                      }}
                      onEnded={() => setPlayingId(null)}
                      onPlay={() => setPlayingId(recording.id)}
                      onPause={() => setPlayingId(null)}
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ${
                            playingId === recording.id ? 'animate-pulse' : ''
                          }`}
                          style={{
                            width: playingId === recording.id
                              ? `${((currentTime[recording.id] || 0) / recording.duration) * 100}%`
                              : '0%'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12">
                        {formatDuration(Math.floor(currentTime[recording.id] || 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Call Summary */}
                {recording.summary && (
                  <div className="mb-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 border border-blue-100 dark:border-blue-800">
                    <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Call Summary
                    </h4>
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      {recording.summary}
                    </p>
                    {recording.endedReason && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                        Ended: {recording.endedReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Transcript Hover */}
                {recording.transcript && recording.transcript.length > 0 && (
                  <div 
                    className="relative inline-block"
                    onMouseEnter={() => setHoveredId(recording.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <button
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      View Transcript
                    </button>
                    
                    {/* Transcript Tooltip */}
                    {hoveredId === recording.id && (
                      <div className="absolute left-0 top-full mt-2 w-[600px] max-w-[90vw] bg-gray-900 dark:bg-gray-950 rounded-lg shadow-2xl border border-gray-700 dark:border-gray-600 z-50 p-4 max-h-[400px] overflow-y-auto">
                        <div className="space-y-3">
                          {recording.transcript.map((message, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${
                                  message.role === 'assistant' 
                                    ? 'text-green-400' 
                                    : 'text-blue-400'
                                }`}>
                                  {message.role === 'assistant' ? 'Assistant' : 'User'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {message.timestamp}
                                </span>
                              </div>
                              <p className="text-sm text-gray-200 leading-relaxed pl-2 border-l-2 border-gray-700">
                                {message.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Insights (if enhanced data available) */}
                {recording.enhancedData && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedProfiles({
                        ...expandedProfiles,
                        [recording.id]: !expandedProfiles[recording.id]
                      })}
                      className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                    >
                      {expandedProfiles[recording.id] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      Customer Insights
                    </button>

                    {expandedProfiles[recording.id] && (
                      <div className="mt-2">
                        <CustomerProfile enhancedData={recording.enhancedData} compact={true} />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {recording.wasAnswered && (
                  <div className="flex items-center gap-2 mt-2">
                    <button className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  Load More Recordings
                </>
              )}
            </button>
          </div>
        )}

        {/* No More Recordings Message */}
        {!hasMore && recordings.length > 0 && (
          <div className="flex justify-center mt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No more recordings to load
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
