import { useState, useEffect } from 'react';
import {
  Phone,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader,
  Download,
  X,
  User
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { VapiClient } from '../lib/vapi';

interface Assistant {
  id: string;
  name: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  assistantId?: string;
  createdAt?: string;
  status?: string; // e.g., 'activating', 'active', etc.
}

interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
  };
}

export function PhoneNumbers() {
  const [vapiNumbers, setVapiNumbers] = useState<VapiPhoneNumber[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [loadingTwilio, setLoadingTwilio] = useState(false);
  const [selectedTwilioNumber, setSelectedTwilioNumber] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [phoneName, setPhoneName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assigningAssistant, setAssigningAssistant] = useState<string | null>(null);

  useEffect(() => {
    loadNumbers();
    loadAssistants();
  }, []);

  const loadNumbers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user settings to check if CHAU Voice Engine credentials exist
      const settings = await d1Client.getUserSettings();
      if (!settings.privateKey) {
        setError('Please configure your CHAU Voice Engine API keys in the API Configuration tab first.');
        return;
      }

      // Load phone numbers directly from CHAU Voice Engine
      const client = new VapiClient(settings.privateKey);
      const numbers = await client.listPhoneNumbers();
      
      setVapiNumbers((numbers as any[]).map((n: any) => ({
        id: n.id,
        number: n.number || n.phoneNumber || 'Unknown',
        name: n.name,
        assistantId: n.assistantId,
        createdAt: n.createdAt,
        status: n.status
      })));
    } catch (error: any) {
      console.error('Failed to load phone numbers:', error);
      setError(error.message || 'Failed to load phone numbers. Please check your API keys.');
    } finally {
      setLoading(false);
    }
  };

  const loadAssistants = async () => {
    try {
      // Use cached endpoint (cache-first, falls back to Vapi if needed)
      const { assistants } = await d1Client.getAssistants();
      
      setAssistants(assistants.map((a: any) => ({
        id: a.id,
        name: a.name || 'Unnamed Assistant'
      })));
    } catch (error: any) {
      console.error('Failed to load assistants:', error);
      // Don't show error - assistants are optional for display
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNumbers();
    await loadAssistants();
    setRefreshing(false);
  };

  const handleAssignAssistant = async (phoneNumberId: string, assistantId: string | null) => {
    try {
      setAssigningAssistant(phoneNumberId);
      setError(null);

      await d1Client.assignAssistantToPhoneNumber(phoneNumberId, assistantId);

      // Update local state
      setVapiNumbers(prev => prev.map(num => 
        num.id === phoneNumberId 
          ? { ...num, assistantId: assistantId || undefined }
          : num
      ));

      setSuccess(assistantId 
        ? 'Assistant assigned successfully!' 
        : 'Assistant removed successfully!'
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to assign assistant');
    } finally {
      setAssigningAssistant(null);
    }
  };

  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setError(null);
    setSuccess(null);
    setLoadingTwilio(true);

    try {
      const settings = await d1Client.getUserSettings();
      if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
        setError('Please configure your Twilio credentials in the API Configuration tab first.');
        setLoadingTwilio(false);
        return;
      }

      const numbers = await d1Client.getTwilioPhoneNumbers();
      setTwilioNumbers(numbers);
    } catch (error: any) {
      console.error('Failed to load Twilio numbers:', error);
      setError(error.message || 'Failed to load Twilio numbers. Please check your Twilio credentials.');
    } finally {
      setLoadingTwilio(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTwilioNumber) {
      setError('Please select a phone number to import.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      const selected = twilioNumbers.find(n => n.sid === selectedTwilioNumber || n.phoneNumber === selectedTwilioNumber);
      if (!selected) {
        setError('Selected number not found.');
        return;
      }

      await d1Client.importTwilioNumber({
        sid: selected.sid,
        phoneNumber: selected.phoneNumber,
        name: phoneName || undefined
      });

      setSuccess('Phone number imported successfully!');
      setShowImportModal(false);
      setSelectedTwilioNumber('');
      setPhoneName('');
      await loadNumbers();
    } catch (error: any) {
      console.error('Failed to import phone number:', error);
      setError(error.message || 'Failed to import phone number.');
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = async () => {
    if (!areaCode || areaCode.length !== 3 || !/^\d{3}$/.test(areaCode)) {
      setError('Please enter a valid 3-digit area code.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      await d1Client.createVapiPhoneNumber({
        areaCode,
        name: phoneName || undefined
      });

      setSuccess('Phone number created successfully!');
      setShowCreateModal(false);
      setAreaCode('');
      setPhoneName('');
      await loadNumbers();
    } catch (error: any) {
      console.error('Failed to create phone number:', error);
      setError(error.message || 'Failed to create phone number.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Phone Numbers</h2>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Manage Phone Numbers</p>
            <p className="text-blue-700 dark:text-blue-300">
              Import phone numbers from Twilio or create a free CHAU Voice Engine number by area code. Free US numbers available (up to 10 per account). All numbers are configured for voice calls only (SMS disabled).
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-900 dark:text-green-100">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{success}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-900 dark:text-red-100">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={handleOpenImportModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          <Download className="w-4 h-4" />
          Import from Twilio
        </button>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setError(null);
            setSuccess(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
        >
          <Plus className="w-4 h-4" />
          Create Free Number
        </button>
      </div>

      {/* Phone Numbers List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : vapiNumbers.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Phone Numbers
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by importing a number from Twilio or creating a free number.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {vapiNumbers.map((number) => (
              <div
                key={number.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {number.number}
                        </h3>
                        {number.status && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            number.status === 'active' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : number.status === 'activating'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {number.status.charAt(0).toUpperCase() + number.status.slice(1)}
                          </span>
                        )}
                      </div>
                      {number.name && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{number.name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Voice Only
                        </span>
                        {number.createdAt && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(number.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {number.assistantId ? (
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              Assigned: {assistants.find(a => a.id === number.assistantId)?.name || 'Unknown Assistant'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={number.assistantId || ''}
                      onChange={(e) => handleAssignAssistant(number.id, e.target.value || null)}
                      disabled={assigningAssistant === number.id}
                      className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">No Assistant</option>
                      {assistants.map(assistant => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </option>
                      ))}
                    </select>
                    {assigningAssistant === number.id && (
                      <Loader className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Twilio Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Import from Twilio
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedTwilioNumber('');
                  setPhoneName('');
                  setError(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a phone number from your Twilio account to import. Only voice-capable numbers are shown. SMS will be disabled.
              </p>

              {loadingTwilio ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : twilioNumbers.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    No voice-capable phone numbers found in your Twilio account.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {twilioNumbers.map((number) => (
                    <label
                      key={number.sid}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTwilioNumber === number.sid
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="twilio-number"
                        value={number.sid}
                        checked={selectedTwilioNumber === number.sid}
                        onChange={(e) => setSelectedTwilioNumber(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {number.phoneNumber}
                        </div>
                        {number.friendlyName && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {number.friendlyName}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Optional Name
                </label>
                <input
                  type="text"
                  value={phoneName}
                  onChange={(e) => setPhoneName(e.target.value)}
                  placeholder="My Phone Number"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedTwilioNumber('');
                    setPhoneName('');
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedTwilioNumber || importing}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importing && <Loader className="w-4 h-4 animate-spin" />}
                  {importing ? 'Importing...' : 'Import Number'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Free Number Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Create Phone Number
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setAreaCode('');
                  setPhoneName('');
                  setError(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter a 3-digit US area code to create a free CHAU Voice Engine phone number. Free US numbers are available (up to 10 per account). The number will use your default transfer number as fallback (configured in API Configuration).
              </p>

              {/* Error Display in Modal */}
              {error && showCreateModal && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-red-900 dark:text-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{error}</p>
                      {error.includes('area code') && (
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                          Try a different area code like 848, 341, or 279.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Area Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={areaCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setAreaCode(value);
                    // Clear error when user starts typing again
                    if (error) setError(null);
                  }}
                  placeholder="415"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  3-digit US area code (e.g., 415, 212, 310)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Optional Name
                </label>
                <input
                  type="text"
                  value={phoneName}
                  onChange={(e) => setPhoneName(e.target.value)}
                  placeholder="Main Business Line"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setAreaCode('');
                    setPhoneName('');
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!areaCode || areaCode.length !== 3 || creating}
                  className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creating && <Loader className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creating...' : 'Create Number'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

