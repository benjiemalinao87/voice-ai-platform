import { Mic, Bot } from 'lucide-react';

interface VoiceActivityIndicatorProps {
  isCustomerSpeaking: boolean;
  isAISpeaking: boolean;
  customerLevel?: number;
  aiLevel?: number;
}

export function VoiceActivityIndicator({
  isCustomerSpeaking,
  isAISpeaking,
  customerLevel = 0,
  aiLevel = 0
}: VoiceActivityIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Customer Speaking Indicator */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <Mic 
            className={`w-3.5 h-3.5 ${
              isCustomerSpeaking 
                ? 'text-green-500 dark:text-green-400' 
                : 'text-gray-400 dark:text-gray-500'
            } transition-colors`}
          />
          {isCustomerSpeaking && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-green-500 dark:bg-green-400 rounded-full animate-ping opacity-75"></div>
            </div>
          )}
        </div>
        {isCustomerSpeaking && (
          <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
            Customer
          </span>
        )}
      </div>

      {/* AI Speaking Indicator */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <Bot 
            className={`w-3.5 h-3.5 ${
              isAISpeaking 
                ? 'text-blue-500 dark:text-blue-400' 
                : 'text-gray-400 dark:text-gray-500'
            } transition-colors`}
          />
          {isAISpeaking && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-ping opacity-75"></div>
            </div>
          )}
        </div>
        {isAISpeaking && (
          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
            AI
          </span>
        )}
      </div>
    </div>
  );
}

