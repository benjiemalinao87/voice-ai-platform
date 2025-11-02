import { useState, useEffect } from 'react';
import { X, Sparkles, Phone, Zap, Bot, Target } from 'lucide-react';

export function WhatsNew() {
  const [isVisible, setIsVisible] = useState(false);
  const ANNOUNCEMENT_VERSION = '2025-01-03'; // Change this when you want to show again

  useEffect(() => {
    const dismissed = localStorage.getItem('whats-new-dismissed');
    if (dismissed !== ANNOUNCEMENT_VERSION) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('whats-new-dismissed', ANNOUNCEMENT_VERSION);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">What's New</h2>
                <p className="text-blue-100 text-sm">Latest updates to your Voice AI Dashboard</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Feature 1 */}
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Create Voice AI Agents
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Build and configure voice AI agents directly from the dashboard. Set up prompts, voice settings,
                and behavior - no API console needed. Just click "Create Agent" in the Voice Agents tab.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Phone Number Management
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Complete phone number control:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Create FREE US phone numbers by area code (up to 10 per account)</li>
                <li>Import existing Twilio numbers with one click</li>
                <li>Assign voice agents to specific phone numbers</li>
                <li>See real-time status of all your numbers</li>
              </ul>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Smart Agent Assignment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Link phone numbers to specific voice agents. Incoming calls automatically route to the right
                agent - perfect for creating dedicated support lines, sales numbers, or department-specific agents.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Voice Engine Caching
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Dashboard now loads 3-5x faster with intelligent caching of agent configs and frequently
                accessed data. Reduces API calls, lowers costs, and real-time updates still work perfectly.
              </p>
            </div>
          </div>

          {/* Bonus Features */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">
              🎁 Bonus Updates
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>🔔 Live call alerts with sound notifications</li>
              <li>📞 End or transfer calls directly from the UI</li>
              <li>📊 Concurrent calls tracking and analytics</li>
              <li>🔍 Keyword extraction from call transcripts</li>
              <li>💬 Intent analysis showing what customers ask about</li>
              <li>📱 Twilio caller ID integration</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Questions? Check out the updated documentation or reach out to the team.
            </p>
            <button
              onClick={handleDismiss}
              className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
