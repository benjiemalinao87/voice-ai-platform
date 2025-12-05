import { useState, useEffect, Suspense, lazy } from 'react';
import { Key, Save, Eye, EyeOff, AlertCircle, CheckCircle, Trash2, RefreshCw, LogOut, User, Settings as SettingsIcon, Plug, Webhook, Maximize2, Zap, Calendar, PhoneForwarded, Phone, Users, UserSearch, Activity } from 'lucide-react';
import { VapiClient } from '../lib/vapi';
import { useAuth } from '../contexts/AuthContext';
import { d1Client } from '../lib/d1';
import { 
  SettingsSkeleton, 
  UserProfileSkeleton, 
  ResourcesLoadingSkeleton,
  TabContentSkeleton 
} from './SettingsSkeleton';

// Lazy load heavy tab components for better initial load
const Integration = lazy(() => import('./Integration').then(m => ({ default: m.Integration })));
const WebhookConfig = lazy(() => import('./WebhookConfig').then(m => ({ default: m.WebhookConfig })));
const Addons = lazy(() => import('./Addons').then(m => ({ default: m.Addons })));
const SchedulingTriggers = lazy(() => import('./SchedulingTriggers').then(m => ({ default: m.SchedulingTriggers })));
const PhoneNumbers = lazy(() => import('./PhoneNumbers').then(m => ({ default: m.PhoneNumbers })));
const TeamMembers = lazy(() => import('./TeamMembers').then(m => ({ default: m.TeamMembers })));
const ToolCallLogs = lazy(() => import('./ToolCallLogs').then(m => ({ default: m.ToolCallLogs })));
const ApiKeys = lazy(() => import('./ApiKeys').then(m => ({ default: m.ApiKeys })));

interface VapiCredentials {
  privateKey: string;
  publicKey: string;
}

interface Assistant {
  id: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  name?: string;
}

interface UserSettings {
  privateKey?: string;
  publicKey?: string;
  selectedAssistantId?: string;
  selectedPhoneId?: string;
  openaiApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  transferPhoneNumber?: string;
  customerconnectWorkspaceId?: string;
  customerconnectApiKey?: string;
  selectedWorkspaceId?: string;
}

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface SettingsProps {
  wideView?: boolean;
  onWideViewChange?: (value: boolean) => void;
}

export function Settings({ wideView = false, onWideViewChange }: SettingsProps = {}) {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'api' | 'apiKeys' | 'integrations' | 'webhooks' | 'addons' | 'scheduling' | 'phoneNumbers' | 'logs' | 'team' | 'preferences'>('api');
  const [credentials, setCredentials] = useState<VapiCredentials>({
    privateKey: '',
    publicKey: ''
  });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [transferPhoneNumber, setTransferPhoneNumber] = useState('');
  const [customerconnectWorkspaceId, setCustomerconnectWorkspaceId] = useState('');
  const [customerconnectApiKey, setCustomerconnectApiKey] = useState('');
  const [showCustomerconnectApiKey, setShowCustomerconnectApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [loadingResources, setLoadingResources] = useState(false);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);

  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  // Automatically redirect non-owners to 'team' tab if they land on 'api'
  useEffect(() => {
    if (!loading && !isWorkspaceOwner && activeTab === 'api') {
      setActiveTab('team');
    }
  }, [isWorkspaceOwner, loading, activeTab]);

  const loadSettings = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const settings: UserSettings & { isWorkspaceOwner?: boolean } = await response.json();
      setUserSettings(settings);
      setSelectedAssistantId(settings.selectedAssistantId || '');
      setSelectedPhoneId(settings.selectedPhoneId || '');
      setTransferPhoneNumber(settings.transferPhoneNumber || '');
      setCustomerconnectWorkspaceId(settings.customerconnectWorkspaceId || '');
      setCustomerconnectApiKey(settings.customerconnectApiKey || '');

      // Store workspace owner status
      setIsWorkspaceOwner(settings.isWorkspaceOwner ?? false);

      // Load plain keys directly
      if (settings.privateKey) {
        setCredentials({
          privateKey: settings.privateKey,
          publicKey: settings.publicKey || ''
        });
        // Load resources in background - don't block main UI
        // This allows the Settings page to render immediately while resources load
        loadVapiResources(settings.privateKey);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setErrorMessage('Failed to load settings');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const loadVapiResources = async (privateKey: string) => {
    if (!privateKey) return;

    setLoadingResources(true);
    setErrorMessage('');

    try {
      const tempClient = new VapiClient(privateKey);

      // Fetch assistants and phone numbers in PARALLEL for better performance
      const [assistantsResult, phonesResult] = await Promise.all([
        // Fetch assistants (use cached endpoint if available, otherwise direct)
        d1Client.getAssistants()
          .then(({ assistants }) => assistants.map((a: any) => ({
            id: a.id,
            name: a.name || 'Unnamed Assistant'
          })))
          .catch(async () => {
            // Fallback to direct Vapi call if cached endpoint fails
            const assistantsData = await tempClient.listAssistants();
            return assistantsData.map((a: any) => ({
              id: a.id,
              name: a.name || 'Unnamed Assistant'
            }));
          }),
        // Fetch phone numbers
        tempClient.listPhoneNumbers()
          .then((phonesData) => phonesData.map((p: any) => ({
            id: p.id,
            number: p.number || p.phoneNumber || 'Unknown',
            name: p.name
          })))
          .catch(() => [])
      ]);

      setAssistants(assistantsResult);
      setPhoneNumbers(phonesResult);
      setStatus('success');
    } catch (error: any) {
      console.error('Error loading resources:', error);
      setErrorMessage(error.message || 'Failed to load assistants and phone numbers');
      setStatus('error');
    } finally {
      setLoadingResources(false);
    }
  };

  const testConnection = async () => {
    if (!credentials.privateKey) {
      setErrorMessage('Please enter a Private API Key');
      setStatus('error');
      return;
    }

    setTesting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      await loadVapiResources(credentials.privateKey);
      setStatus('success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to connect');
      setStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!isWorkspaceOwner) {
      setErrorMessage('Only workspace owners can update API credentials');
      setStatus('error');
      return;
    }

    if (!credentials.privateKey) {
      setErrorMessage('Private API Key is required');
      setStatus('error');
      return;
    }

    if (!token) {
      setErrorMessage('You must be logged in');
      setStatus('error');
      return;
    }

    if (!userSettings?.selectedWorkspaceId) {
      setErrorMessage('No workspace selected. Please select a workspace first.');
      setStatus('error');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      // Save to workspace settings using d1Client
      // Note: OpenAI and Twilio credentials are now managed in the Integration tab
      await d1Client.updateUserSettings({
        privateKey: credentials.privateKey,
        publicKey: credentials.publicKey || undefined,
        selectedAssistantId: selectedAssistantId || undefined,
        selectedPhoneId: selectedPhoneId || undefined,
        selectedWorkspaceId: userSettings.selectedWorkspaceId,
        transferPhoneNumber: transferPhoneNumber || undefined,
        customerconnectWorkspaceId: customerconnectWorkspaceId || undefined,
        customerconnectApiKey: customerconnectApiKey || undefined,
      });

      setStatus('success');
      setErrorMessage('Settings saved successfully! Reloading...');

      // Reload after save
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save credentials');
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all settings? You will need to re-enter your API keys.')) {
      setCredentials({ privateKey: '', publicKey: '' });
      setTransferPhoneNumber('');
      setSelectedAssistantId('');
      setSelectedPhoneId('');
      setAssistants([]);
      setPhoneNumbers([]);
      setStatus('idle');
      setErrorMessage('');
    }
  };

  // Show skeleton loading instead of blocking spinner for better UX
  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {user?.name || 'User'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-hidden">
          <nav className="flex space-x-6 px-6 overflow-x-auto scrollbar-hide">
            {/* Owner-only tabs */}
            {isWorkspaceOwner && (
              <button
                onClick={() => setActiveTab('api')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'api'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Configuration
                </div>
              </button>
            )}
            {isWorkspaceOwner && (
              <>
                <button
                  onClick={() => setActiveTab('apiKeys')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'apiKeys'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    API Keys
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('integrations')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'integrations'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4" />
                    Integrations
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('webhooks')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'webhooks'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4" />
                    Webhooks
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('addons')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'addons'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Addons
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('scheduling')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'scheduling'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Scheduling
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('phoneNumbers')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'phoneNumbers'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Numbers
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Tool Logs
                  </div>
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('team')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'team'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team
              </div>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                Preferences
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'api' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Configuration</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage your API keys and integration settings</p>
                </div>
              </div>

              {/* Status Messages */}
              {status === 'success' && !errorMessage.includes('password') && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="p-1 bg-green-100 dark:bg-green-900/40 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-green-900 dark:text-green-100">
                    {errorMessage || `Connection successful! Found ${assistants.length} assistant(s) and ${phoneNumbers.length} phone number(s).`}
                  </span>
                </div>
              )}

              {status === 'error' && errorMessage && !errorMessage.includes('password') && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="p-1 bg-red-100 dark:bg-red-900/40 rounded-full">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="font-medium text-red-900 dark:text-red-100">{errorMessage}</span>
                </div>
              )}

              {!isWorkspaceOwner && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    You are viewing workspace credentials as a member. Only workspace owners can edit API keys.
                  </span>
                </div>
              )}

              {/* VAPI Credentials Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CHAU Voice Engine Credentials</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configure your Voice Engine keys to enable voice capabilities.
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Private API Key <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <input
                        type={showPrivateKey ? 'text' : 'password'}
                        value={credentials.privateKey}
                        onChange={(e) => setCredentials({ ...credentials, privateKey: e.target.value })}
                        placeholder="94d99bcc-17cb-4d09-9810-437447ec8072"
                        disabled={!isWorkspaceOwner}
                        readOnly={!isWorkspaceOwner}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Public API Key <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative group">
                      <input
                        type={showPublicKey ? 'text' : 'password'}
                        value={credentials.publicKey}
                        onChange={(e) => setCredentials({ ...credentials, publicKey: e.target.value })}
                        placeholder="9b13c215-aabf-4f80-abc3-75f2ccd29962"
                        disabled={!isWorkspaceOwner}
                        readOnly={!isWorkspaceOwner}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPublicKey(!showPublicKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {showPublicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Used for Voice Test feature in the Configuration tab
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={testConnection}
                      disabled={testing || !credentials.privateKey || !isWorkspaceOwner}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                      {testing ? 'Verifying Connection...' : 'Test Connection'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Call Control Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
                    <PhoneForwarded className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Call Control</h3>
                  </div>
                  <div className="p-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default Transfer Number
                    </label>
                    <input
                      type="tel"
                      value={transferPhoneNumber}
                      onChange={(e) => setTransferPhoneNumber(e.target.value)}
                      placeholder="+1234567890"
                      disabled={!isWorkspaceOwner}
                      readOnly={!isWorkspaceOwner}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Fallback number for call transfers (e.g., human agent)
                    </p>
                  </div>
                </div>

                {/* Default Resources Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Defaults</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {loadingResources ? (
                      <ResourcesLoadingSkeleton />
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Assistant
                          </label>
                          <select
                            value={selectedAssistantId}
                            onChange={(e) => setSelectedAssistantId(e.target.value)}
                            disabled={!isWorkspaceOwner || assistants.length === 0}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="">{assistants.length === 0 ? 'No assistants found' : '-- Select an assistant --'}</option>
                            {assistants.map((assistant) => (
                              <option key={assistant.id} value={assistant.id}>
                                {assistant.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Phone Number
                          </label>
                          <select
                            value={selectedPhoneId}
                            onChange={(e) => setSelectedPhoneId(e.target.value)}
                            disabled={!isWorkspaceOwner || phoneNumbers.length === 0}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="">{phoneNumbers.length === 0 ? 'No numbers found' : '-- Select a phone number --'}</option>
                            {phoneNumbers.map((phone) => (
                              <option key={phone.id} value={phone.id}>
                                {phone.number} {phone.name ? `(${phone.name})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* CustomerConnect Integration Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserSearch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CHAU Text Engine Integration</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                    Optional
                  </span>
                </div>

                <div className="p-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-3xl">
                    Enable automatic customer lookup during calls. When the AI collects a phone number, it will fetch customer data from CHAU Text Engine to provide context.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Workspace ID
                      </label>
                      <input
                        type="text"
                        value={customerconnectWorkspaceId}
                        onChange={(e) => setCustomerconnectWorkspaceId(e.target.value)}
                        placeholder="e.g., 76692"
                        disabled={!isWorkspaceOwner}
                        readOnly={!isWorkspaceOwner}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key
                      </label>
                      <div className="relative group">
                        <input
                          type={showCustomerconnectApiKey ? 'text' : 'password'}
                          value={customerconnectApiKey}
                          onChange={(e) => setCustomerconnectApiKey(e.target.value)}
                          placeholder="Your CHAU Text Engine API key"
                          disabled={!isWorkspaceOwner}
                          readOnly={!isWorkspaceOwner}
                          className="w-full px-4 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCustomerconnectApiKey(!showCustomerconnectApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          {showCustomerconnectApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                    <div className="flex gap-3">
                      <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded-full h-fit">
                        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium mb-1">How it works</p>
                        <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                          When configured, create a <code className="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-200 font-mono text-xs">lookup_customer</code> tool in your assistant.
                          The AI will call this tool to fetch appointment details and household information.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={handleClear}
                  disabled={!isWorkspaceOwner}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Settings
                </button>

                <div className="flex items-center gap-3">
                  {status === 'success' && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-in fade-in">
                      Saved successfully!
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !credentials.privateKey || !isWorkspaceOwner}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apiKeys' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <ApiKeys />
            </Suspense>
          )}

          {activeTab === 'integrations' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <Integration onNavigateToApiConfig={() => setActiveTab('api')} />
            </Suspense>
          )}

          {activeTab === 'webhooks' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <WebhookConfig />
            </Suspense>
          )}

          {activeTab === 'addons' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <Addons />
            </Suspense>
          )}

          {activeTab === 'scheduling' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <SchedulingTriggers />
            </Suspense>
          )}

          {activeTab === 'phoneNumbers' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <PhoneNumbers />
            </Suspense>
          )}

          {activeTab === 'logs' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <ToolCallLogs />
            </Suspense>
          )}

          {activeTab === 'team' && (
            <Suspense fallback={<TabContentSkeleton />}>
              <TeamMembers />
            </Suspense>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Maximize2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Display Preferences</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize your dashboard viewing experience</p>
                </div>
              </div>

              {/* Wide View Mode Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
                  <Maximize2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Layout Settings</h3>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">Wide View Mode</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-600 dark:text-blue-400">
                          Beta
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                        Enable wide view to expand the dashboard content area across the full width of your screen. This is recommended for viewing large datasets and complex charts.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={wideView}
                        onChange={(e) => onWideViewChange?.(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                    <div className="flex gap-3">
                      <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded-full h-fit">
                        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium mb-1">Pro Tip</p>
                        <p className="text-blue-700 dark:text-blue-300">
                          Wide view mode persists across sessions, so you don't need to enable it every time you log in.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div >
      </div >
    </div >
  );
}
