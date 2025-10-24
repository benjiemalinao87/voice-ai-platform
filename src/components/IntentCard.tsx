import { useState } from 'react';
import {
  Calendar,
  Clock,
  Phone,
  PhoneOff,
  Globe,
  ChevronDown,
  ChevronUp,
  User,
  MessageSquare,
  Brain,
  Heart,
  Sparkles
} from 'lucide-react';
import type { CallIntent } from '../types';
import { CustomerProfile } from './CustomerProfile';

interface IntentCardProps {
  callIntent: CallIntent;
  enhancedData?: any;
}

type TabType = 'intent' | 'mood' | 'enhanced';

export function IntentCard({ callIntent, enhancedData }: IntentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('intent');

  const getIntentColor = (intent: string) => {
    switch (intent.toLowerCase()) {
      case 'scheduling':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'information':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'complaint':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'purchase':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'support':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600';
    }
  };

  const getIntentColorValue = (intent: string) => {
    switch (intent.toLowerCase()) {
      case 'scheduling':
        return '#2563eb';
      case 'information':
        return '#16a34a';
      case 'complaint':
        return '#dc2626';
      case 'purchase':
        return '#9333ea';
      case 'support':
        return '#ea580c';
      default:
        return '#6b7280';
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'positive':
        return <Heart className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <Heart className="w-4 h-4 text-red-500" />;
      default:
        return <Heart className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative"
      style={{
        transform: isExpanded ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isExpanded 
          ? '0 12px 24px -4px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.08)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${getIntentColorValue(callIntent.intent)}08 0%, transparent 50%)`,
        }}
      />

      {/* Top border accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
        style={{
          background: getIntentColorValue(callIntent.intent),
          transform: isExpanded ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
        }}
      />
      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 hover:scale-105 ${getIntentColor(callIntent.intent)}`}>
              <Brain className="w-4 h-4 mr-2" />
              {callIntent.intent}
            </div>
            <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full transition-all duration-300 hover:scale-105 ${getMoodColor(callIntent.mood)} bg-opacity-10`}>
              {getMoodIcon(callIntent.mood)}
              <span className="capitalize">{callIntent.mood}</span>
              <span className="text-xs opacity-75 font-medium">({callIntent.mood_confidence}%)</span>
            </div>

            {/* Tab Navigation in Header */}
            <div className="flex gap-1 ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('intent');
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === 'intent' && isExpanded
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                Intent
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('mood');
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === 'mood' && isExpanded
                    ? 'bg-green-600 dark:bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                Mood
              </button>
              {enhancedData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('enhanced');
                    if (!isExpanded) setIsExpanded(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${
                    activeTab === 'enhanced' && isExpanded
                      ? 'bg-purple-600 dark:bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Enhanced
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">{formatDate(callIntent.call_date)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{formatDuration(callIntent.duration_seconds)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Globe className="w-4 h-4" />
              <span className="font-medium">{callIntent.language.toUpperCase()}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-300 hover:scale-105 ${
              callIntent.was_answered 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
            }`}>
              {callIntent.was_answered ? (
                <Phone className="w-4 h-4" />
              ) : (
                <PhoneOff className="w-4 h-4" />
              )}
              <span className="font-medium">{callIntent.was_answered ? 'Answered' : 'Missed'}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:scale-110 group"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          )}
        </button>
      </div>

      {/* Customer Info */}
      {callIntent.customer_name && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/30">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{callIntent.customer_name}</span>
            {callIntent.phone_number && (
              <span className="text-gray-500 dark:text-gray-400 ml-2 font-medium">• {callIntent.phone_number}</span>
            )}
          </div>
        </div>
      )}

      {/* Transcript Excerpt */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5 mb-4 border border-gray-200 dark:border-gray-600 transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full bg-gray-200 dark:bg-gray-600">
            <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversation Excerpt</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed pl-2 border-l-2 border-gray-300 dark:border-gray-500">
          "{callIntent.transcript_excerpt}"
        </p>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'intent' && (
              <div className="group animate-in fade-in duration-300">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Analyzed from call summary and transcript</p>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 transition-all duration-300">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {callIntent.intent_reasoning}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'mood' && (
              <div className="group animate-in fade-in duration-300">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Determined from call analysis</p>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/30 transition-all duration-300">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {callIntent.mood_reasoning}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'enhanced' && enhancedData && (
              <div className="animate-in fade-in duration-300">
                <CustomerProfile enhancedData={enhancedData} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
