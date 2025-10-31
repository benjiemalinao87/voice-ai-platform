import { useState, useEffect } from 'react';
import { Key, Save, Eye, EyeOff, AlertCircle, CheckCircle, Trash2, RefreshCw, LogOut, User, Settings as SettingsIcon, Plug, Webhook, Maximize2, Zap, Calendar } from 'lucide-react';
import { VapiClient } from '../lib/vapi';
import { useAuth } from '../contexts/AuthContext';
import { useVapi } from '../contexts/VapiContext';
import { d1Client } from '../lib/d1';
import { Integration } from './Integration';
import { WebhookConfig } from './WebhookConfig';
import { Addons } from './Addons';
import { SchedulingTriggers } from './SchedulingTriggers';

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
}

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface SettingsProps {
  wideView?: boolean;
  onWideViewChange?: (value: boolean) => void;
}

export function Settings({ wideView = false, onWideViewChange }: SettingsProps = {}) {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'api' | 'integrations' | 'webhooks' | 'addons' | 'scheduling' | 'preferences'>('api');
  const [credentials, setCredentials] = useState<VapiCredentials>({
    privateKey: '',
    publicKey: ''
  });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
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

  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

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

      const settings: UserSettings = await response.json();
      setUserSettings(settings);
      setSelectedAssistantId(settings.selectedAssistantId || '');
      setSelectedPhoneId(settings.selectedPhoneId || '');
      setOpenaiApiKey(settings.openaiApiKey || '');
      setTwilioAccountSid(settings.twilioAccountSid || '');
      setTwilioAuthToken(settings.twilioAuthToken || '');

      // Load plain keys directly
      if (settings.privateKey) {
        setCredentials({
          privateKey: settings.privateKey,
          publicKey: settings.publicKey || ''
        });
        // Auto-load resources
        await loadVapiResources(settings.privateKey);
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
      
      // Fetch assistants
      const assistantsData = await tempClient.listAssistants();
      setAssistants(assistantsData.map((a: any) => ({
        id: a.id,
        name: a.name || 'Unnamed Assistant'
      })));
      
      // Fetch phone numbers
      const phonesData = await tempClient.listPhoneNumbers();
      setPhoneNumbers(phonesData.map((p: any) => ({
        id: p.id,
        number: p.number || p.phoneNumber || 'Unknown',
        name: p.name
      })));
      
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

    setSaving(true);
    setErrorMessage('');

    try {
      // Save to D1 using d1Client
      await d1Client.updateUserSettings({
        privateKey: credentials.privateKey,
        publicKey: credentials.publicKey || null,
        selectedAssistantId: selectedAssistantId || null,
        selectedPhoneId: selectedPhoneId || null,
        openaiApiKey: openaiApiKey || null,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
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
      setPassword('');
      setSelectedAssistantId('');
      setSelectedPhoneId('');
      setAssistants([]);
      setPhoneNumbers([]);
      setStatus('idle');
      setErrorMessage('');
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
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('api')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'api'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Configuration
              </div>
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'integrations'
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
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'webhooks'
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
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'addons'
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
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'scheduling'
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
              onClick={() => setActiveTab('preferences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'preferences'
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
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Configuration</h2>
              </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">API Configuration</p>
              <p className="text-blue-700 dark:text-blue-300">
                Enter your CHAU Voice AI API keys to connect your account. Your keys are securely stored and sync across your devices.
              </p>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'success' && !errorMessage.includes('password') && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-900 dark:text-green-100">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                {errorMessage || `Connection successful! Found ${assistants.length} assistant(s) and ${phoneNumbers.length} phone number(s).`}
              </span>
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && !errorMessage.includes('password') && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          </div>
        )}

        {errorMessage.includes('password') && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          </div>
        )}


        {/* API Keys Input */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Private API Key *
            </label>
            <div className="relative">
              <input
                type={showPrivateKey ? 'text' : 'password'}
                value={credentials.privateKey}
                onChange={(e) => setCredentials({ ...credentials, privateKey: e.target.value })}
                placeholder="94d99bcc-17cb-4d09-9810-437447ec8072"
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Public API Key (optional)
            </label>
            <div className="relative">
              <input
                type={showPublicKey ? 'text' : 'password'}
                value={credentials.publicKey}
                onChange={(e) => setCredentials({ ...credentials, publicKey: e.target.value })}
                placeholder="9b13c215-aabf-4f80-abc3-75f2ccd29962"
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPublicKey(!showPublicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPublicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Used for Voice Test feature in the Configuration tab
            </p>
          </div>

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

          {/* Twilio Integration */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-gray-400" />
              Twilio Lookup API (optional)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enable caller identification and phone number validation for incoming calls
            </p>

            <div className="space-y-4">
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
            </div>
          </div>

        </div>

        {/* Test Connection Button */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={testConnection}
            disabled={testing || !credentials.privateKey}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {/* Assistants & Phone Numbers Selection */}
        {(assistants.length > 0 || phoneNumbers.length > 0) && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Select Default Resources
            </h3>
            
            <div className="space-y-4">
              {assistants.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Assistant
                  </label>
                  <select
                    value={selectedAssistantId}
                    onChange={(e) => setSelectedAssistantId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Select an assistant --</option>
                    {assistants.map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This will be loaded by default in the Configuration tab
                  </p>
                </div>
              )}

              {phoneNumbers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Phone Number
                  </label>
                  <select
                    value={selectedPhoneId}
                    onChange={(e) => setSelectedPhoneId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Select a phone number --</option>
                    {phoneNumbers.map((phone) => (
                      <option key={phone.id} value={phone.id}>
                        {phone.number} {phone.name ? `(${phone.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Used for outbound calls
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Settings
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !credentials.privateKey}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

              {loadingResources && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <Integration onNavigateToApiConfig={() => setActiveTab('api')} />
          )}

          {activeTab === 'webhooks' && (
            <WebhookConfig />
          )}

          {activeTab === 'addons' && (
            <Addons />
          )}

          {activeTab === 'scheduling' && (
            <SchedulingTriggers />
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <Maximize2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Display Preferences</h2>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">Wide View Mode</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Enable wide view to expand the dashboard content area across the full width of your screen for better visibility of charts and data.
                    </p>
                  </div>
                </div>
              </div>

              {/* Wide View Toggle */}
              <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <Maximize2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        Wide View Mode
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Expand content area to full screen width
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => {
                      const newValue = !wideView;
                      if (onWideViewChange) {
                        onWideViewChange(newValue);
                      }
                      localStorage.setItem('wideView', String(newValue));
                    }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                      wideView
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                        wideView ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Current Status */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wideView ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {wideView ? 'Wide view enabled' : 'Standard view (max-width: 1280px)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">What changes with Wide View?</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Dashboard content expands to use full screen width</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Charts and graphs display with more detail</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Better visibility for data tables and analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Preference saved automatically to your browser</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
