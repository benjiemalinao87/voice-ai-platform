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
  Heart
} from 'lucide-react';
import type { CallIntent } from '../types';

interface IntentCardProps {
  callIntent: CallIntent;
}

export function IntentCard({ callIntent }: IntentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getIntentColor(callIntent.intent)}`}>
              <Brain className="w-4 h-4 mr-1" />
              {callIntent.intent}
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${getMoodColor(callIntent.mood)}`}>
              {getMoodIcon(callIntent.mood)}
              <span className="capitalize">{callIntent.mood}</span>
              <span className="text-xs opacity-75">({callIntent.mood_confidence}%)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(callIntent.call_date)}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDuration(callIntent.duration_seconds)}
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              {callIntent.language.toUpperCase()}
            </div>
            <div className="flex items-center gap-1">
              {callIntent.was_answered ? (
                <Phone className="w-4 h-4 text-green-500" />
              ) : (
                <PhoneOff className="w-4 h-4 text-gray-400" />
              )}
              {callIntent.was_answered ? 'Answered' : 'Missed'}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Customer Info */}
      {callIntent.customer_name && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 dark:text-gray-100 font-medium">{callIntent.customer_name}</span>
          {callIntent.phone_number && (
            <span className="text-gray-500 dark:text-gray-400">• {callIntent.phone_number}</span>
          )}
        </div>
      )}

      {/* Transcript Excerpt */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conversation Excerpt</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          "{callIntent.transcript_excerpt}"
        </p>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Intent Analysis */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Intent Analysis
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              {callIntent.intent_reasoning}
            </p>
          </div>

          {/* Mood Analysis */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Mood Analysis
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              {callIntent.mood_reasoning}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
