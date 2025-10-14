import { useState } from 'react';
import { Play, Pause, Phone, Clock, Calendar, User, MapPin, Download } from 'lucide-react';

interface Recording {
  id: string;
  caller: string;
  phone: string;
  duration: number;
  date: string;
  location: string;
  audioUrl: string;
  transcript?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  wasAnswered: boolean;
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
    transcript: 'Hello, I am interested in your services. Can you tell me more about your pricing plans?',
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
    transcript: 'I have a question about my recent order. When will it be delivered?',
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
    transcript: 'I need help with technical support for your product.',
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
    transcript: 'Thank you for the excellent service. I would like to schedule a follow-up call.',
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
  const [recordings] = useState<Recording[]>(mockRecordings);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    if (playingId === recordingId) {
      setPlayingId(null);
    } else {
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

      <div className="space-y-4">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              {/* Play Button */}
              <button
                onClick={() => recording.wasAnswered && handlePlayPause(recording.id)}
                disabled={!recording.wasAnswered}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  recording.wasAnswered
                    ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {playingId === recording.id ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              {/* Recording Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {recording.caller}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {recording.phone}
                      </span>
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

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentColor(recording.sentiment)}`}>
                      {recording.sentiment}
                    </span>
                    {recording.wasAnswered ? (
                      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatDuration(recording.duration)}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                        Missed
                      </span>
                    )}
                  </div>
                </div>

                {/* Audio Progress Bar */}
                {recording.wasAnswered && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ${
                            playingId === recording.id ? 'animate-pulse' : ''
                          }`}
                          style={{
                            width: playingId === recording.id ? '45%' : '0%'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12">
                        {playingId === recording.id ? '1:50' : '0:00'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transcript */}
                {recording.transcript && (
                  <div>
                    <button
                      onClick={() => setExpandedId(expandedId === recording.id ? null : recording.id)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mb-2"
                    >
                      {expandedId === recording.id ? 'Hide' : 'View'} Transcript
                    </button>
                    {expandedId === recording.id && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-2">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {recording.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {recording.wasAnswered && (
                  <div className="flex items-center gap-2 mt-3">
                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
