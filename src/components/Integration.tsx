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

  // Salesforce State
  const [salesforceConnected, setSalesforceConnected] = useState(false);
  const [salesforceInstanceUrl, setSalesforceInstanceUrl] = useState<string | null>(null);
  const [salesforceNotification, setSalesforceNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // HubSpot State
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [hubspotNotification, setHubspotNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showHubSpotLogsModal, setShowHubSpotLogsModal] = useState(false);
  const [hubspotSyncLogs, setHubspotSyncLogs] = useState<any[]>([]);
  const [loadingHubSpotLogs, setLoadingHubSpotLogs] = useState(false);

  // Dynamics 365 State
  const [dynamicsConnected, setDynamicsConnected] = useState(false);
  const [dynamicsInstanceUrl, setDynamicsInstanceUrl] = useState<string | null>(null);
  const [dynamicsNotification, setDynamicsNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showDynamicsLogsModal, setShowDynamicsLogsModal] = useState(false);
  const [dynamicsSyncLogs, setDynamicsSyncLogs] = useState<any[]>([]);
  const [loadingDynamicsLogs, setLoadingDynamicsLogs] = useState(false);
  const [showDynamicsInstanceModal, setShowDynamicsInstanceModal] = useState(false);
  const [dynamicsInstanceUrlInput, setDynamicsInstanceUrlInput] = useState('');

  useEffect(() => {
    loadIntegrationStatus();
    checkSalesforceCallback();
    checkHubSpotCallback();
    checkDynamicsCallback();
  }, []);

  const checkSalesforceCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const salesforceStatus = urlParams.get('salesforce');

    if (salesforceStatus === 'connected') {
      setSalesforceNotification({
        type: 'success',
        message: 'Salesforce connected successfully!'
      });
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setSalesforceNotification(null), 5000);
    } else if (salesforceStatus === 'error') {
      const errorMessage = urlParams.get('message') || 'Failed to connect to Salesforce';
      setSalesforceNotification({
        type: 'error',
        message: errorMessage
      });
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-dismiss after 8 seconds
      setTimeout(() => setSalesforceNotification(null), 8000);
    }
  };

  const checkHubSpotCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const hubspotStatus = urlParams.get('hubspot');

    if (hubspotStatus === 'connected') {
      setHubspotNotification({
        type: 'success',
        message: 'HubSpot connected successfully!'
      });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setHubspotNotification(null), 5000);
      // Reload integration status to update the UI
      await loadIntegrationStatus();
    } else if (hubspotStatus === 'error') {
      const errorMessage = urlParams.get('message') || 'Failed to connect to HubSpot';
      setHubspotNotification({
        type: 'error',
        message: errorMessage
      });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setHubspotNotification(null), 8000);
    }
  };

  const checkDynamicsCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dynamicsStatus = urlParams.get('dynamics');

    if (dynamicsStatus === 'connected') {
      setDynamicsNotification({
        type: 'success',
        message: 'Dynamics 365 connected successfully!'
      });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setDynamicsNotification(null), 5000);
      // Reload integration status to update the UI
      await loadIntegrationStatus();
    } else if (dynamicsStatus === 'error') {
      const errorMessage = urlParams.get('message') || 'Failed to connect to Dynamics 365';
      setDynamicsNotification({
        type: 'error',
        message: errorMessage
      });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setDynamicsNotification(null), 8000);
    }
  };

  const loadIntegrationStatus = async () => {
    try {
      // Fetch all integration statuses in PARALLEL for better performance
      const [settings, sfStatus, hsStatus, dynamicsStatus] = await Promise.all([
        d1Client.getUserSettings(),
        d1Client.getSalesforceStatus().catch((error) => {
          console.error('Error loading Salesforce status:', error);
          return { connected: false, instanceUrl: null };
        }),
        d1Client.getHubSpotStatus().catch((error) => {
          console.error('Error loading HubSpot status:', error);
          return { connected: false };
        }),
        d1Client.getDynamicsStatus().catch((error) => {
          console.error('Error loading Dynamics 365 status:', error);
          return { connected: false, instanceUrl: null };
        })
      ]);

      // Update local state for connected services
      const sfConnected = sfStatus.connected;
      setSalesforceConnected(sfConnected);
      setSalesforceInstanceUrl(sfStatus.instanceUrl);

      const hsConnected = hsStatus.connected;
      setHubspotConnected(hsConnected);

      const dynConnected = dynamicsStatus.connected;
      setDynamicsConnected(dynConnected);
      setDynamicsInstanceUrl(dynamicsStatus.instanceUrl);

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
        if (integration.id === 'salesforce') {
          return {
            ...integration,
            status: sfConnected ? 'connected' : 'disconnected',
            lastSync: sfConnected ? 'Active' : undefined
          };
        }
        if (integration.id === 'hubspot') {
          return {
            ...integration,
            status: hsConnected ? 'connected' : 'disconnected',
            lastSync: hsConnected ? 'Active' : undefined
          };
        }
        if (integration.id === 'dynamics') {
          return {
            ...integration,
            status: dynConnected ? 'connected' : 'disconnected',
            lastSync: dynConnected ? 'Active' : undefined
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

    if (integrationId === 'salesforce') {
      // Start Salesforce OAuth flow
      try {
        setIsConnecting(integrationId);
        const { authUrl } = await d1Client.initiateSalesforceOAuth();

        // Open OAuth in popup window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          'Salesforce OAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for popup closure
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            setIsConnecting(null);
            // Reload integration status after OAuth
            loadIntegrationStatus();
          }
        }, 500);
      } catch (error: any) {
        console.error('Error initiating Salesforce OAuth:', error);
        setSalesforceNotification({
          type: 'error',
          message: error.message || 'Failed to initiate Salesforce connection'
        });
        setIsConnecting(null);
        setTimeout(() => setSalesforceNotification(null), 8000);
      }
      return;
    }

    if (integrationId === 'hubspot') {
      // Start HubSpot OAuth flow
      try {
        setIsConnecting(integrationId);
        const { authUrl } = await d1Client.initiateHubSpotOAuth();

        // Open OAuth in popup window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          'HubSpot OAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for popup closure
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            setIsConnecting(null);
            // Reload integration status after OAuth
            loadIntegrationStatus();
          }
        }, 500);
      } catch (error: any) {
        console.error('Error initiating HubSpot OAuth:', error);
        setHubspotNotification({
          type: 'error',
          message: error.message || 'Failed to initiate HubSpot connection'
        });
        setIsConnecting(null);
        setTimeout(() => setHubspotNotification(null), 8000);
      }
      return;
    }

    if (integrationId === 'dynamics') {
      // Show instance URL input modal first
      setShowDynamicsInstanceModal(true);
      return;
    }

    setIsConnecting(integrationId);
    // Simulate connection process for other integrations
    setTimeout(() => {
      setIsConnecting(null);
      // In a real app, this would update the integration status
    }, 2000);
  };

  const handleDynamicsConnect = async () => {
    if (!dynamicsInstanceUrlInput) {
      setDynamicsNotification({
        type: 'error',
        message: 'Please enter your Dynamics 365 instance URL'
      });
      setTimeout(() => setDynamicsNotification(null), 5000);
      return;
    }

    try {
      setIsConnecting('dynamics');
      const { authUrl } = await d1Client.initiateDynamicsOAuth(dynamicsInstanceUrlInput);

      // Close the modal
      setShowDynamicsInstanceModal(false);

      // Open OAuth in popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'Dynamics 365 OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setIsConnecting(null);
          // Reload integration status after OAuth
          loadIntegrationStatus();
        }
      }, 500);
    } catch (error: any) {
      console.error('Error initiating Dynamics 365 OAuth:', error);
      setDynamicsNotification({
        type: 'error',
        message: error.message || 'Failed to initiate Dynamics 365 connection'
      });
      setIsConnecting(null);
      setShowDynamicsInstanceModal(false);
      setTimeout(() => setDynamicsNotification(null), 8000);
    }
  };

  const handleDisconnectSalesforce = async () => {
    try {
      await d1Client.disconnectSalesforce();
      setSalesforceConnected(false);
      setSalesforceInstanceUrl(null);
      setSalesforceNotification({
        type: 'success',
        message: 'Salesforce disconnected successfully'
      });
      await loadIntegrationStatus();
      setTimeout(() => setSalesforceNotification(null), 5000);
    } catch (error: any) {
      console.error('Error disconnecting Salesforce:', error);
      setSalesforceNotification({
        type: 'error',
        message: error.message || 'Failed to disconnect Salesforce'
      });
      setTimeout(() => setSalesforceNotification(null), 8000);
    }
  };

  const handleDisconnectHubSpot = async () => {
    try {
      await d1Client.disconnectHubSpot();
      setHubspotConnected(false);
      setHubspotNotification({
        type: 'success',
        message: 'HubSpot disconnected successfully'
      });
      await loadIntegrationStatus();
      setTimeout(() => setHubspotNotification(null), 5000);
    } catch (error: any) {
      console.error('Error disconnecting HubSpot:', error);
      setHubspotNotification({
        type: 'error',
        message: error.message || 'Failed to disconnect HubSpot'
      });
      setTimeout(() => setHubspotNotification(null), 8000);
    }
  };

  const loadHubSpotSyncLogs = async () => {
    setLoadingHubSpotLogs(true);
    try {
      const logs = await d1Client.getHubSpotSyncLogs();
      setHubspotSyncLogs(logs.logs || []);
    } catch (error) {
      console.error('Error loading HubSpot sync logs:', error);
    } finally {
      setLoadingHubSpotLogs(false);
    }
  };

  const handleOpenHubSpotLogs = async () => {
    setShowHubSpotLogsModal(true);
    await loadHubSpotSyncLogs();
  };

  const handleDisconnectDynamics = async () => {
    try {
      await d1Client.disconnectDynamics();
      setDynamicsConnected(false);
      setDynamicsInstanceUrl(null);
      setDynamicsNotification({
        type: 'success',
        message: 'Dynamics 365 disconnected successfully'
      });
      await loadIntegrationStatus();
      setTimeout(() => setDynamicsNotification(null), 5000);
    } catch (error: any) {
      console.error('Error disconnecting Dynamics 365:', error);
      setDynamicsNotification({
        type: 'error',
        message: error.message || 'Failed to disconnect Dynamics 365'
      });
      setTimeout(() => setDynamicsNotification(null), 8000);
    }
  };

  const loadDynamicsSyncLogs = async () => {
    setLoadingDynamicsLogs(true);
    try {
      const logs = await d1Client.getDynamicsSyncLogs();
      setDynamicsSyncLogs(logs.logs || []);
    } catch (error) {
      console.error('Error loading Dynamics 365 sync logs:', error);
    } finally {
      setLoadingDynamicsLogs(false);
    }
  };

  const handleOpenDynamicsLogs = async () => {
    setShowDynamicsLogsModal(true);
    await loadDynamicsSyncLogs();
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Salesforce Notification Banner */}
      {salesforceNotification && (
        <div
          className={`rounded-xl border p-4 ${salesforceNotification.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {salesforceNotification.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${salesforceNotification.type === 'success'
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
                  }`}
              >
                {salesforceNotification.message}
              </span>
            </div>
            <button
              onClick={() => setSalesforceNotification(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* HubSpot Notification Banner */}
      {hubspotNotification && (
        <div
          className={`rounded-xl border p-4 ${hubspotNotification.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hubspotNotification.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${hubspotNotification.type === 'success'
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
                  }`}
              >
                {hubspotNotification.message}
              </span>
            </div>
            <button
              onClick={() => setHubspotNotification(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamics 365 Notification Banner */}
      {dynamicsNotification && (
        <div
          className={`rounded-xl border p-4 ${dynamicsNotification.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dynamicsNotification.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${dynamicsNotification.type === 'success'
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
                  }`}
              >
                {dynamicsNotification.message}
              </span>
            </div>
            <button
              onClick={() => setDynamicsNotification(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integrations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Connect your voice AI system with popular CRM and business tools</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 p-4">
        <div className="flex gap-3">
          <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded-full h-fit">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Integration Benefits</p>
            <p className="text-blue-700 dark:text-blue-300">
              Connect your CRM systems to automatically sync contact data, track interactions,
              and enhance your voice AI with customer context and history.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200"
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

            {/* Salesforce-specific info */}
            {integration.id === 'salesforce' && (
              <div className="mb-4 space-y-3">
                {/* Documentation Link */}
                <a
                  href="https://api.voice-config.channelautomation.com/docs/salesforce-integration/html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Integration Guide
                </a>

                {/* Instance URL when connected */}
                {salesforceConnected && salesforceInstanceUrl && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Instance URL:</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                      {salesforceInstanceUrl}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Dynamics-specific info */}
            {integration.id === 'dynamics' && (
              <div className="mb-4 space-y-3">
                {/* Instance URL when connected */}
                {dynamicsConnected && dynamicsInstanceUrl && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Instance URL:</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                      {dynamicsInstanceUrl}
                    </p>
                  </div>
                )}
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
                  ) : integration.id === 'salesforce' ? (
                    <button
                      onClick={handleDisconnectSalesforce}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Disconnect
                    </button>
                  ) : integration.id === 'hubspot' ? (
                    <>
                      <button
                        onClick={handleOpenHubSpotLogs}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View History
                      </button>
                      <button
                        onClick={handleDisconnectHubSpot}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Disconnect
                      </button>
                    </>
                  ) : integration.id === 'dynamics' ? (
                    <>
                      <button
                        onClick={handleOpenDynamicsLogs}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View History
                      </button>
                      <button
                        onClick={handleDisconnectDynamics}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedIntegration(integration.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Configure
                    </button>
                  )}
                  {integration.id !== 'openai' && integration.id !== 'twilio' && integration.id !== 'salesforce' && integration.id !== 'hubspot' && integration.id !== 'dynamics' && (
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

      {/* HubSpot Sync Logs Modal */}
      {showHubSpotLogsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    HubSpot Sync History
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    View all call sync attempts to HubSpot
                  </p>
                </div>
                <button
                  onClick={() => setShowHubSpotLogsModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHubSpotLogs ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              ) : hubspotSyncLogs.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No sync logs found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Sync logs will appear here after calls are synced to HubSpot
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hubspotSyncLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : log.status === 'skipped' ? (
                              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                            <span className={`text-sm font-medium ${log.status === 'success'
                              ? 'text-green-700 dark:text-green-400'
                              : log.status === 'skipped'
                                ? 'text-yellow-700 dark:text-yellow-400'
                                : 'text-red-700 dark:text-red-400'
                              }`}>
                              {log.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                              <span className="text-gray-900 dark:text-gray-100 font-mono">
                                {log.phone_number || 'N/A'}
                              </span>
                            </div>

                            {log.contact_id && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">Contact ID:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-mono">
                                  {log.contact_id}
                                </span>
                              </div>
                            )}

                            {log.engagement_id && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">Engagement ID:</span>
                                <span className="text-gray-900 dark:text-gray-100 font-mono">
                                  {log.engagement_id}
                                </span>
                              </div>
                            )}

                            {log.error_message && (
                              <div className="flex items-start gap-2 mt-2">
                                <span className="text-gray-600 dark:text-gray-400">Error:</span>
                                <span className="text-red-700 dark:text-red-400 flex-1">
                                  {log.error_message}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowHubSpotLogsModal(false)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamics 365 Instance URL Modal */}
      {showDynamicsInstanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Connect to Dynamics 365
                </h2>
                <button
                  onClick={() => {
                    setShowDynamicsInstanceModal(false);
                    setDynamicsInstanceUrlInput('');
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dynamics 365 Instance URL
                  </label>
                  <input
                    type="text"
                    value={dynamicsInstanceUrlInput}
                    onChange={(e) => setDynamicsInstanceUrlInput(e.target.value)}
                    placeholder="https://yourorg.crm.dynamics.com"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter your organization's Dynamics 365 URL (e.g., https://orgname.crm.dynamics.com)
                  </p>
                </div>

                {dynamicsNotification && (
                  <div
                    className={`rounded-lg border p-3 ${dynamicsNotification.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                  >
                    <p className={`text-sm ${dynamicsNotification.type === 'success'
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-red-900 dark:text-red-100'
                      }`}>
                      {dynamicsNotification.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowDynamicsInstanceModal(false);
                      setDynamicsInstanceUrlInput('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDynamicsConnect}
                    disabled={!dynamicsInstanceUrlInput || isConnecting === 'dynamics'}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConnecting === 'dynamics' ? (
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamics 365 Sync Logs Modal */}
      {showDynamicsLogsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Dynamics 365 Sync History
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    View all call sync attempts to Dynamics 365
                  </p>
                </div>
                <button
                  onClick={() => setShowDynamicsLogsModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingDynamicsLogs ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              ) : dynamicsSyncLogs.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No sync logs found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Sync logs will appear here once calls are synced to Dynamics 365
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dynamicsSyncLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-4 ${log.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : log.status === 'error'
                          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : log.status === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          )}
                          <span className={`font-medium ${log.status === 'success'
                            ? 'text-green-900 dark:text-green-100'
                            : log.status === 'error'
                              ? 'text-red-900 dark:text-red-100'
                              : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.created_at * 1000).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Call ID:</span> {log.call_id}
                        </p>
                        {log.phone_number && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Phone:</span> {log.phone_number}
                          </p>
                        )}
                        {log.dynamics_record_id && (
                          <div className="flex items-center gap-2">
                            <p className="text-gray-700 dark:text-gray-300">
                              <span className="font-medium">Record ID:</span> {log.dynamics_record_id}
                            </p>
                            {log.lead_created && (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-md">
                                New Lead
                              </span>
                            )}
                          </div>
                        )}
                        {log.dynamics_activity_id && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Activity ID:</span> {log.dynamics_activity_id}
                          </p>
                        )}
                        {log.appointment_created && log.dynamics_appointment_id && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Appointment ID:</span> {log.dynamics_appointment_id}
                          </p>
                        )}
                        {log.error_message && (
                          <p className="text-red-700 dark:text-red-300 mt-2">
                            <span className="font-medium">Error:</span> {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowDynamicsLogsModal(false)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
