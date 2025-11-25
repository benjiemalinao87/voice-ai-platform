import { useState, useEffect } from 'react';
import { Play, Pause, Phone, PhoneIncoming, Clock, Calendar, User, MapPin, Download, MessageSquare, ChevronDown, ChevronUp, Languages, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  createdAt?: number; // Original Unix timestamp for reliable sorting
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
  callType?: 'inboundPhoneCall' | 'outboundPhoneCall' | null;
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
  const [allRecordings, setAllRecordings] = useState<Recording[]>([]); // All loaded recordings
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [callTypeFilter, setCallTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<{ [key: string]: boolean }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 per page
  const [translations, setTranslations] = useState<{ [key: string]: string }>({});
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({});
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  const [actualCounts, setActualCounts] = useState<Record<string, number>>({});
  const [phoneCallCounts, setPhoneCallCounts] = useState<{ [phoneNumber: string]: number }>({});

  // Load end reason counts from API
  const loadEndReasonCounts = async () => {
    try {
      const counts = await d1Client.getCallEndedReasonCounts();
      setActualCounts(counts);
    } catch (error) {
      console.error('Error loading end reason counts:', error);
    }
  };

  // Load initial recordings and counts
  useEffect(() => {
    setAllRecordings([]);
    setHasLoadedAll(false);
    loadRecordings(0, 50);
    loadEndReasonCounts();
  }, []);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Load more recordings if needed when page changes
  useEffect(() => {
    const filtered = activeTab === 'all'
      ? allRecordings
      : allRecordings.filter(recording => recording.endedReason === activeTab);
    const neededCount = currentPage * itemsPerPage;

    if (filtered.length < neededCount && !hasLoadedAll && !loading) {
      loadMoreRecordings();
    }
  }, [currentPage, activeTab, allRecordings.length]);

  // Removed auto-refresh to improve UX - user can manually refresh if needed
  // Auto-refresh was causing the page to keep refreshing every 30 seconds

  // Get unique end reasons from all loaded recordings
  const getUniqueEndReasons = (): string[] => {
    const reasons = new Set<string>();
    allRecordings.forEach(recording => {
      if (recording.endedReason) {
        reasons.add(recording.endedReason);
      }
    });
    return Array.from(reasons).sort();
  };

  // Get filtered recordings by active tab and call type
  const getFilteredRecordings = (): Recording[] => {
    let filtered = allRecordings;

    // Filter by ended reason
    if (activeTab !== 'all') {
      filtered = filtered.filter(recording => recording.endedReason === activeTab);
    }

    // Filter by call type
    if (callTypeFilter === 'inbound') {
      filtered = filtered.filter(recording => recording.callType === 'inboundPhoneCall');
    } else if (callTypeFilter === 'outbound') {
      filtered = filtered.filter(recording => recording.callType === 'outboundPhoneCall');
    }

    return filtered;
  };

  // Get paginated recordings for current page
  const filteredRecordings = (() => {
    const filtered = getFilteredRecordings();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  })();

  const loadRecordings = async (offset: number = 0, limit: number = 50) => {
    try {
      if (offset === 0) {
        setLoading(true);
      }

      // Add cache-busting parameter to ensure fresh data (always bypass cache for recordings)
      const params: any = {
        limit: limit,
        offset: offset,
        _t: Date.now() // Always bypass cache to ensure we get latest data
      };
      const response = await d1Client.getWebhookCalls(params);
      
      // Handle both old format (array) and new format (object with results and total)
      let webhookCalls: any[];
      let total: number;
      
      if (Array.isArray(response)) {
        // Old format from cache - just an array
        console.warn('Received old response format (array). Consider clearing cache.');
        webhookCalls = response;
        total = response.length; // Fallback: use loaded count
      } else {
        // New format - object with results and total
        webhookCalls = response.results || [];
        total = response.total || 0;
      }
      
      // Update total count (only on first load)
      if (offset === 0) {
        setTotalCount(total);
      }
      
      console.log(`Loaded ${webhookCalls.length} recordings (offset: ${offset}). Total: ${total}`);

      // Convert webhook calls to Recording format (enhanced data is already included!)
      const convertedRecordings: Recording[] = webhookCalls.map((call) => {
        // Parse raw_payload to extract transcript
        let transcript: TranscriptMessage[] = [];
        let location = 'Unknown';
        let callerName = 'Unknown Caller';

        // Use customer_name first (from analysis), then Twilio enriched data, then structured data
        if (call.customer_name) {
          callerName = call.customer_name;
        } else if (call.caller_name) {
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

          // Fallback to structured_data name if neither customer_name nor caller_name provided
          if (callerName === 'Unknown Caller' && call.structured_data?.name) {
            callerName = call.structured_data.name;
          }
        } catch (error) {
          console.error('Error parsing webhook payload:', error);
        }

        // Enhanced data is now included in the API response - no need for separate fetch!
        const enhancedData = call.enhanced_data || null;

        // Extract call type (inbound vs outbound)
        let callType: 'inboundPhoneCall' | 'outboundPhoneCall' | null = null;
        try {
          if (call.raw_payload) {
            const payload = typeof call.raw_payload === 'string'
              ? JSON.parse(call.raw_payload)
              : call.raw_payload;
            callType = payload.message?.call?.type || null;
          }
        } catch (error) {
          console.error('Error extracting call type:', error);
        }

        // Get duration from database, or calculate from raw_payload if not available
        let duration = call.duration_seconds || null;
        
        // If duration not in database, try to extract from raw_payload
        if (!duration && call.raw_payload) {
          try {
            const payload = typeof call.raw_payload === 'string'
              ? JSON.parse(call.raw_payload)
              : call.raw_payload;
            
            // First try: use durationSeconds directly from message (most reliable)
            if (payload.message?.durationSeconds) {
              duration = Math.floor(payload.message.durationSeconds);
            }
            // Second try: calculate from message.startedAt and message.endedAt (actual structure)
            else if (payload.message?.startedAt && payload.message?.endedAt) {
              const startTime = new Date(payload.message.startedAt).getTime();
              const endTime = new Date(payload.message.endedAt).getTime();
              duration = Math.floor((endTime - startTime) / 1000);
            }
            // Third try: calculate from message.call.startedAt and message.call.endedAt (older structure)
            else if (payload.message?.call?.startedAt && payload.message?.call?.endedAt) {
              const startTime = new Date(payload.message.call.startedAt).getTime();
              const endTime = new Date(payload.message.call.endedAt).getTime();
              duration = Math.floor((endTime - startTime) / 1000);
            }
          } catch (error) {
            console.error('Error calculating duration from payload:', error);
          }
        }
        
        // Default to 0 if still no duration found (instead of 180)
        duration = duration || 0;

        // Normalize timestamp: check if it's in milliseconds (> 1e12) or seconds (< 1e12)
        // Demo data has milliseconds, real data has seconds
        const normalizedTimestamp = call.created_at > 1000000000000 
          ? Math.floor(call.created_at / 1000)  // Already in milliseconds, convert to seconds
          : call.created_at;  // Already in seconds

        return {
          id: call.id,
          caller: callerName,
          phone: call.phone_number || 'N/A',  // Business/AI agent phone
          customerPhone: call.customer_number || undefined,  // Customer's phone
          duration: duration,
          date: new Date(normalizedTimestamp * 1000).toISOString(), // Convert to milliseconds for display
          createdAt: normalizedTimestamp, // Normalized timestamp in seconds for reliable sorting
          location: location,
          audioUrl: (() => {
            // Filter out VAPI demo URLs and invalid URLs to prevent errors
            const url = call.recording_url || '';
            if (!url) return '';
            // Block VAPI demo/branded URLs
            if (url.includes('recordings.vapi.ai') || url.includes('demo.mp3') || url.includes('vapi.ai/demo')) {
              return '';
            }
            return url;
          })(),
          transcript: transcript.length > 0 ? transcript : undefined,
          sentiment: 'neutral' as const, // We can add sentiment analysis later
          wasAnswered: !!call.recording_url, // If there's a recording, it was answered
          summary: call.summary || undefined,
          endedReason: call.ended_reason || undefined,
          enhancedData: enhancedData,
          callerType: call.caller_type || undefined,
          carrierName: call.carrier_name || undefined,
          lineType: call.line_type || undefined,
          callType: callType
        };
      });

      // Sort by created_at timestamp descending (newest first) - use original timestamp for reliability
      // IMPORTANT: Always sort, even if API claims to be sorted, to ensure consistency
      const sortedRecordings = convertedRecordings.sort((a, b) => {
        const aTime = a.createdAt || 0;
        const bTime = b.createdAt || 0;
        // If timestamps are equal, maintain original order
        if (aTime === bTime) return 0;
        // Sort descending: newest (larger timestamp) first
        return bTime - aTime;
      });
      
      // Append to allRecordings and remove duplicates
      let updatedRecordings;
      if (offset === 0) {
        setAllRecordings(sortedRecordings);
        updatedRecordings = sortedRecordings;
      } else {
        setAllRecordings(prev => {
          const merged = [...prev, ...sortedRecordings];
          // Remove duplicates based on id
          const unique = Array.from(
            new Map(merged.map(r => [r.id, r])).values()
          );
          // Re-sort after merge
          const sorted = unique.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          updatedRecordings = sorted;
          return sorted;
        });
      }

      // Calculate call counts per phone number for outbound calls
      const callCounts: { [phoneNumber: string]: number } = {};
      const recordingsToCount = updatedRecordings || sortedRecordings;
      recordingsToCount.forEach((recording) => {
        if (recording.callType === 'outboundPhoneCall' && recording.customerPhone) {
          const phone = recording.customerPhone;
          callCounts[phone] = (callCounts[phone] || 0) + 1;
        }
      });
      setPhoneCallCounts(callCounts);

      // Check if we've loaded all recordings
      if (webhookCalls.length < limit || (offset + webhookCalls.length) >= total) {
        setHasLoadedAll(true);
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
      // Show error details
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      // Fallback to mock data on error (only on initial load)
      if (offset === 0) {
        setAllRecordings(mockRecordings);
        setTotalCount(mockRecordings.length);
      }
    } finally {
      if (offset === 0) {
        setLoading(false);
      }
    }
  };

  const loadMoreRecordings = async () => {
    const currentOffset = allRecordings.length;
    await loadRecordings(currentOffset, 50); // Load 50 more at a time
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

  const translateToSpanish = async (recordingId: string, text: string) => {
    try {
      setTranslating(prev => ({ ...prev, [recordingId]: true }));

      // Call our backend API to translate (backend will fetch OpenAI key from D1)
      const response = await d1Client.translateText(text, 'spanish');

      if (!response.success) {
        throw new Error(response.error || 'Translation failed');
      }

      setTranslations(prev => ({ ...prev, [recordingId]: response.translatedText }));
    } catch (error) {
      console.error('Error translating text:', error);
      alert('Failed to translate. Please try again.');
    } finally {
      setTranslating(prev => ({ ...prev, [recordingId]: false }));
    }
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
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
          </div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-2">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
        </div>

        {/* Recordings List Skeleton */}
        <div className="space-y-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start gap-4">
                {/* Play Button Skeleton */}
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>

                {/* Content Skeleton */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Use actual counts from API (not just loaded recordings)
  const counts = actualCounts;
  const uniqueEndReasons = Object.keys(actualCounts).filter(key => key !== 'all').sort();

  // Calculate inbound/outbound counts from ALL recordings (not just loaded)
  // We need to use the total count from the database, not just loaded recordings
  const inboundCount = allRecordings.filter(r => r.callType === 'inboundPhoneCall').length;
  const outboundCount = allRecordings.filter(r => r.callType === 'outboundPhoneCall').length;
  const totalCallsCount = counts.all || totalCount;

  // Get total filtered count for current tab
  const filteredTotal = getFilteredRecordings().length;

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
            {filteredRecordings.length} of {filteredTotal} {activeTab} recordings
            {hasLoadedAll ? '' : ' (loading more...)'}
          </span>
        </div>
      </div>

      {/* Call Type Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setCallTypeFilter('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              callTypeFilter === 'all'
                ? 'bg-gray-600 dark:bg-gray-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Phone className="w-4 h-4" />
            All
          </button>

          <button
            onClick={() => setCallTypeFilter('inbound')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              callTypeFilter === 'inbound'
                ? 'bg-blue-600 dark:bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <PhoneIncoming className="w-4 h-4" />
            Inbound
          </button>

          <button
            onClick={() => setCallTypeFilter('outbound')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              callTypeFilter === 'outbound'
                ? 'bg-green-600 dark:bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Phone className="w-4 h-4" />
            Outbound
          </button>
        </div>
      </div>

      {/* Tab Navigation - Dynamic based on endedReason */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {/* All Tab */}
          <button
            onClick={() => setActiveTab('all')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
              ${activeTab === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            All
            <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
              activeTab === 'all'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {counts.all || 0}
            </span>
          </button>

          {/* Dynamic tabs based on unique endedReason values */}
          {uniqueEndReasons.map(reason => (
            <button
              key={reason}
              onClick={() => setActiveTab(reason)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === reason
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {reason.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                activeTab === reason
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {counts[reason] || 0}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Recordings List */}
      {filteredRecordings.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            No {activeTab} calls found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecordings.map((recording) => (
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {recording.caller}
                      </h3>
                      {recording.callType === 'inboundPhoneCall' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          <PhoneIncoming className="w-3 h-3" />
                          Inbound
                        </span>
                      )}
                      {recording.callType === 'outboundPhoneCall' && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                            <Phone className="w-3 h-3" />
                            Outbound
                          </span>
                          {recording.customerPhone && phoneCallCounts[recording.customerPhone] && phoneCallCounts[recording.customerPhone] > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                              Called {phoneCallCounts[recording.customerPhone]}x
                            </span>
                          )}
                        </>
                      )}
                    </div>
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
                {recording.wasAnswered && recording.audioUrl && recording.audioUrl.trim() !== '' && (
                  <div className="mb-2">
                    <audio
                      id={`audio-${recording.id}`}
                      src={recording.audioUrl}
                      onError={(e) => {
                        // Silently handle audio loading errors to prevent console spam
                        console.debug('Audio failed to load:', recording.audioUrl);
                        e.currentTarget.style.display = 'none';
                      }}
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
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Call Summary
                        {translations[recording.id] && (
                          <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">(Spanish)</span>
                        )}
                      </h4>
                      <button
                        onClick={() => {
                          if (translations[recording.id]) {
                            // Clear translation to show original
                            setTranslations(prev => {
                              const updated = { ...prev };
                              delete updated[recording.id];
                              return updated;
                            });
                          } else {
                            // Translate to Spanish
                            translateToSpanish(recording.id, recording.summary);
                          }
                        }}
                        disabled={translating[recording.id]}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {translating[recording.id] ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Translating...
                          </>
                        ) : translations[recording.id] ? (
                          <>
                            <Languages className="w-3 h-3" />
                            Show Original
                          </>
                        ) : (
                          <>
                            <Languages className="w-3 h-3" />
                            Translate to Spanish
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      {translations[recording.id] || recording.summary}
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
                {recording.wasAnswered && recording.audioUrl && (
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={recording.audioUrl}
                      download={`recording-${recording.caller.replace(/\s+/g, '-')}-${new Date(recording.date).toISOString().split('T')[0]}.wav`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        </div>
      )}

      {/* Pagination */}
      {!loading && filteredTotal > 0 && (
        <div className="flex items-center justify-between mt-6 px-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTotal)} of {filteredTotal} {activeTab} recordings
          </div>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {(() => {
                const totalPages = Math.ceil(filteredTotal / itemsPerPage);
                const pages = [];
                const maxVisiblePages = 5;
                
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                // Adjust start if we're near the end
                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                // First page
                if (startPage > 1) {
                  pages.push(
                    <button
                      key={1}
                      onClick={() => setCurrentPage(1)}
                      className="w-10 h-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pages.push(
                      <span key="ellipsis1" className="px-2 text-gray-500">...</span>
                    );
                  }
                }
                
                // Visible pages
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === i
                          ? 'bg-blue-600 dark:bg-blue-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                
                // Last page
                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(
                      <span key="ellipsis2" className="px-2 text-gray-500">...</span>
                    );
                  }
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-10 h-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {totalPages}
                    </button>
                  );
                }
                
                return pages;
              })()}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTotal / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(filteredTotal / itemsPerPage)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
