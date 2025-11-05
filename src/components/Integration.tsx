import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  ExternalLink,
  Database,
  Users,
  Mail,
  Phone,
  AlertCircle,
  RefreshCw,
  Brain,
  Eye,
  EyeOff,
  Save,
  Send
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { useAuth } from '../contexts/AuthContext';
import { OutboundWebhookIntegration } from './OutboundWebhookIntegration';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  features: string[];
  color: string;
}

const getInitialIntegrations = (): Integration[] => [
  {
    id: 'outbound-webhook',
    name: 'Outbound Webhooks',
    description: 'Subscribe to real-time inbound call events. Receive instant notifications when calls start or end with full details, transcripts, and recordings.',
    icon: <Send className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Real-time Events', 'Call Transcripts', 'Audio Recordings', 'Dynamic Data Schema'],
    color: 'bg-blue-600'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Enable AI-powered intent analysis on call recordings to automatically categorize customer intents, sentiment, and call outcomes.',
    icon: <Brain className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Intent Analysis', 'Sentiment Detection', 'Call Categorization', 'Outcome Prediction'],
    color: 'bg-green-600'
  },
  {
    id: 'twilio',
    name: 'Twilio Lookup',
    description: 'Enrich incoming calls with caller identification, carrier information, and phone number validation using Twilio\'s Lookup API.',
    icon: <Phone className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Caller Name Lookup', 'Carrier Detection', 'Line Type Info', 'Number Validation'],
    color: 'bg-red-600'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Connect your Salesforce CRM to sync contacts, leads, and opportunities with your voice AI system.',
    icon: <Database className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Contact Sync', 'Lead Management', 'Opportunity Tracking', 'Custom Fields'],
    color: 'bg-blue-500'
  },
  {
    id: 'dynamics',
    name: 'Microsoft Dynamics 365',
    description: 'Integrate with Microsoft Dynamics 365 to access customer data and automate workflows.',
    icon: <Users className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Customer Records', 'Sales Pipeline', 'Marketing Automation', 'Service Management'],
    color: 'bg-purple-500'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync with HubSpot CRM for comprehensive customer relationship management and marketing automation.',
    icon: <Mail className="w-6 h-6" />,
    status: 'disconnected',
    features: ['Contact Management', 'Email Marketing', 'Sales Pipeline', 'Analytics'],
    color: 'bg-orange-500'
  }
];

interface IntegrationProps {
  onNavigateToApiConfig?: () => void;
}

export function Integration({ onNavigateToApiConfig }: IntegrationProps = {}) {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>(getInitialIntegrations());
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  
  // OpenAI Modal State
  const [showOpenAIModal, setShowOpenAIModal] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [savingOpenAI, setSavingOpenAI] = useState(false);
  const [openaiError, setOpenaiError] = useState('');
  
  // Twilio Modal State
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [savingTwilio, setSavingTwilio] = useState(false);
  const [twilioError, setTwilioError] = useState('');

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const settings = await d1Client.getUserSettings();

      // Update integration status based on stored credentials
      setIntegrations(prev => prev.map(integration => {
        if (integration.id === 'openai') {
          return {
            ...integration,
            status: settings.openaiApiKey ? 'connected' : 'disconnected',
            lastSync: settings.openaiApiKey ? 'Active' : undefined
          };
        }
        if (integration.id === 'twilio') {
          return {
            ...integration,
            status: settings.twilioAccountSid && settings.twilioAuthToken ? 'connected' : 'disconnected',
            lastSync: settings.twilioAccountSid && settings.twilioAuthToken ? 'Active' : undefined
          };
        }
        return integration;
      }));
    } catch (error) {
      console.error('Error loading integration status:', error);
    }
  };

  const handleConnect = async (integrationId: string) => {
    if (integrationId === 'outbound-webhook') {
      // Navigate to outbound webhook configuration
      setSelectedIntegration('outbound-webhook');
      return;
    }

    if (integrationId === 'openai') {
      // Load existing OpenAI key if available
      try {
        const settings = await d1Client.getUserSettings();
        setOpenaiApiKey(settings.openaiApiKey || '');
        setShowOpenAIModal(true);
        setOpenaiError('');
      } catch (error) {
        console.error('Error loading OpenAI settings:', error);
        setShowOpenAIModal(true);
      }
      return;
    }

    if (integrationId === 'twilio') {
      // Load existing Twilio credentials if available
      try {
        const settings = await d1Client.getUserSettings();
        setTwilioAccountSid(settings.twilioAccountSid || '');
        setTwilioAuthToken(settings.twilioAuthToken || '');
        setShowTwilioModal(true);
        setTwilioError('');
      } catch (error) {
        console.error('Error loading Twilio settings:', error);
        setShowTwilioModal(true);
      }
      return;
    }

    setIsConnecting(integrationId);
    // Simulate connection process for other integrations
    setTimeout(() => {
      setIsConnecting(null);
      // In a real app, this would update the integration status
    }, 2000);
  };

  const handleSaveOpenAI = async () => {
    if (!token) {
      setOpenaiError('You must be logged in');
      return;
    }

    setSavingOpenAI(true);
    setOpenaiError('');

    try {
      const settings = await d1Client.getUserSettings();
      if (!settings.selectedWorkspaceId) {
        setOpenaiError('No workspace selected. Please select a workspace first.');
        setSavingOpenAI(false);
        return;
      }

      await d1Client.updateUserSettings({
        ...settings,
        selectedWorkspaceId: settings.selectedWorkspaceId,
        openaiApiKey: openaiApiKey || null,
      });

      // Reload integration status
      await loadIntegrationStatus();
      setShowOpenAIModal(false);
      setOpenaiError('');
    } catch (error: any) {
      setOpenaiError(error.message || 'Failed to save OpenAI API key');
    } finally {
      setSavingOpenAI(false);
    }
  };

  const handleSaveTwilio = async () => {
    if (!token) {
      setTwilioError('You must be logged in');
      return;
    }

    setSavingTwilio(true);
    setTwilioError('');

    try {
      const settings = await d1Client.getUserSettings();
      if (!settings.selectedWorkspaceId) {
        setTwilioError('No workspace selected. Please select a workspace first.');
        setSavingTwilio(false);
        return;
      }

      await d1Client.updateUserSettings({
        ...settings,
        selectedWorkspaceId: settings.selectedWorkspaceId,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
      });

      // Reload integration status
      await loadIntegrationStatus();
      setShowTwilioModal(false);
      setTwilioError('');
    } catch (error: any) {
      setTwilioError(error.message || 'Failed to save Twilio credentials');
    } finally {
      setSavingTwilio(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Not Connected';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integrations</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Connect your voice AI system with popular CRM and business tools
            </p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Integration Benefits</p>
              <p className="text-blue-700 dark:text-blue-300">
                Connect your CRM systems to automatically sync contact data, track interactions, 
                and enhance your voice AI with customer context and history.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
          >
            {/* Integration Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${integration.color} rounded-lg flex items-center justify-center text-white`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {integration.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(integration.status)}
                    <span className={`text-sm font-medium ${getStatusColor(integration.status)}`}>
                      {getStatusText(integration.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {integration.description}
            </p>

            {/* Features */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Available Features:
              </h4>
              <div className="flex flex-wrap gap-1">
                {integration.features.map((feature, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Last Sync */}
            {integration.lastSync && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last sync: {integration.lastSync}
                </p>
              </div>
            )}

            {/* Documentation Link for Salesforce */}
            {integration.id === 'salesforce' && (
              <div className="mb-4">
                <a
                  href="https://api.voice-config.channelautomation.com/docs/salesforce-integration/html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Integration Guide
                </a>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {integration.status === 'connected' ? (
                <>
                  {integration.id === 'openai' ? (
                    <button
                      onClick={() => handleConnect('openai')}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Manage API Key
                    </button>
                  ) : integration.id === 'twilio' ? (
                    <button
                      onClick={() => handleConnect('twilio')}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Manage Twilio Keys
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedIntegration(integration.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                      <SettingsIcon className="w-4 h-4" />
                      Configure
                    </button>
                  )}
                  {integration.id !== 'openai' && integration.id !== 'twilio' && (
                    <button className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleConnect(integration.id)}
                  disabled={isConnecting === integration.id}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting === integration.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* OpenAI Configuration Modal */}
      {showOpenAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Configure OpenAI
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowOpenAIModal(false);
                  setOpenaiError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">OpenAI Integration</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Used for AI-powered Intent Analysis on call recordings to automatically categorize customer intents, sentiment, and call outcomes.
                    </p>
                  </div>
                </div>
              </div>

              {openaiError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{openaiError}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OpenAI API Key (optional)
                </label>
                <div className="relative">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used for AI-powered Intent Analysis on call recordings
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowOpenAIModal(false);
                    setOpenaiError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOpenAI}
                  disabled={savingOpenAI}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingOpenAI ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Twilio Configuration Modal */}
      {showTwilioModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Configure Twilio Lookup
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowTwilioModal(false);
                  setTwilioError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">Twilio Lookup API</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Enable caller identification and phone number validation for incoming calls. Enriches call data with caller name, carrier, and location info.
                    </p>
                  </div>
                </div>
              </div>

              {twilioError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{twilioError}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account SID
                </label>
                <input
                  type="text"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                  placeholder="AC..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your Twilio Account SID (starts with AC)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auth Token
                </label>
                <div className="relative">
                  <input
                    type={showTwilioToken ? 'text' : 'password'}
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    placeholder="Your Twilio Auth Token"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTwilioToken(!showTwilioToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used to enrich call data with caller name, carrier, and location info
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowTwilioModal(false);
                    setTwilioError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTwilio}
                  disabled={savingTwilio}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingTwilio ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integration Details Modal */}
      {selectedIntegration && (
        selectedIntegration === 'outbound-webhook' ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Outbound Webhooks Configuration
                  </h3>
                  <button
                    onClick={() => setSelectedIntegration(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <OutboundWebhookIntegration />
              </div>
            </div>
          </div>
        ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Configure {integrations.find(i => i.id === selectedIntegration)?.name}
                </h3>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Connection Status */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-900 dark:text-green-100">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Successfully Connected</span>
                  </div>
                  <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                    Your integration is active and syncing data
                  </p>
                </div>

                {/* Configuration Options */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sync Frequency
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <option>Real-time</option>
                      <option>Every 15 minutes</option>
                      <option>Every hour</option>
                      <option>Daily</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data to Sync
                    </label>
                    <div className="space-y-2">
                      {['Contacts', 'Leads', 'Opportunities', 'Custom Fields'].map((item) => (
                        <label key={item} className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Webhook URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value="https://api.voiceai.com/webhook/salesforce"
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm"
                      />
                      <button className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setSelectedIntegration(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )
      )}
    </div>
  );
}
