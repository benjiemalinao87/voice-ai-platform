import { useState, useEffect } from 'react';
import {
  Phone,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  GripVertical,
  Power,
  Settings,
  Users,
  Clock,
  AlertCircle,
  Loader2,
  Zap,
  CheckCircle2,
  Info,
  History,
  ChevronDown
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { AutoTransferLogs } from './AutoTransferLogs';

interface TransferAgent {
  id: string;
  assistant_id: string;
  phone_number: string;
  agent_name: string | null;
  priority: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

interface TransferSettings {
  assistant_id: string;
  ring_timeout_seconds: number;
  max_attempts: number;
  enabled: number;
  announcement_message: string | null;
  tool_configured?: boolean;
}

interface TransferAgentSettingsProps {
  assistantId: string;
  assistantName?: string;
}

export function TransferAgentSettings({ assistantId, assistantName }: TransferAgentSettingsProps) {
  const [agents, setAgents] = useState<TransferAgent[]>([]);
  const [settings, setSettings] = useState<TransferSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New agent form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentName, setNewAgentName] = useState('');

  // Edit agent state
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editName, setEditName] = useState('');

  // Settings form state
  const [ringTimeout, setRingTimeout] = useState(30);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [enabled, setEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadData();
  }, [assistantId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, settingsRes] = await Promise.all([
        d1Client.getTransferAgents(assistantId),
        d1Client.getTransferSettings(assistantId)
      ]);

      setAgents(agentsRes.agents || []);
      setSettings(settingsRes);

      // Initialize form state from settings
      setRingTimeout(settingsRes.ring_timeout_seconds || 30);
      setMaxAttempts(settingsRes.max_attempts || 3);
      setEnabled(!!settingsRes.enabled);
      setAnnouncement(settingsRes.announcement_message || '');
    } catch (err) {
      console.error('Error loading transfer settings:', err);
      setError('Failed to load transfer settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async () => {
    if (!newAgentPhone.trim()) return;

    setSaving(true);
    try {
      const newAgent = await d1Client.addTransferAgent(assistantId, {
        phone_number: newAgentPhone.trim(),
        agent_name: newAgentName.trim() || undefined
      });

      setAgents([...agents, newAgent as TransferAgent]);
      setNewAgentPhone('');
      setNewAgentName('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding agent:', err);
      setError('Failed to add agent');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAgent = async (agentId: string) => {
    setSaving(true);
    try {
      await d1Client.updateTransferAgent(assistantId, agentId, {
        phone_number: editPhone,
        agent_name: editName
      });

      setAgents(agents.map(a =>
        a.id === agentId
          ? { ...a, phone_number: editPhone, agent_name: editName }
          : a
      ));
      setEditingAgentId(null);
    } catch (err) {
      console.error('Error updating agent:', err);
      setError('Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;

    setSaving(true);
    try {
      await d1Client.deleteTransferAgent(assistantId, agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgentActive = async (agent: TransferAgent) => {
    setSaving(true);
    try {
      await d1Client.updateTransferAgent(assistantId, agent.id, {
        is_active: !agent.is_active
      });

      setAgents(agents.map(a =>
        a.id === agent.id ? { ...a, is_active: a.is_active ? 0 : 1 } : a
      ));
    } catch (err) {
      console.error('Error toggling agent:', err);
      setError('Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !enabled;
    setTogglingEnabled(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await d1Client.updateTransferSettings(assistantId, {
        ring_timeout_seconds: ringTimeout,
        max_attempts: maxAttempts,
        enabled: newEnabled,
        announcement_message: announcement || undefined
      });

      setEnabled(newEnabled);
      setSettings({
        ...settings!,
        ring_timeout_seconds: ringTimeout,
        max_attempts: maxAttempts,
        enabled: newEnabled ? 1 : 0,
        announcement_message: announcement || null,
        tool_configured: result.tool_configured
      });

      // Show success or error message based on assistant update result
      if (result.error) {
        setError(`Settings saved, but assistant update failed: ${result.error}`);
      } else if (newEnabled) {
        setSuccessMessage('✅ Auto-transfer enabled! The transfer_to_sales() function has been added to this assistant.');
      } else {
        setSuccessMessage('Auto-transfer disabled. The transfer function has been removed from the assistant.');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error toggling auto-transfer:', err);
      setError('Failed to update auto-transfer status. Please try again.');
    } finally {
      setTogglingEnabled(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await d1Client.updateTransferSettings(assistantId, {
        ring_timeout_seconds: ringTimeout,
        max_attempts: maxAttempts,
        enabled,
        announcement_message: announcement || undefined
      });

      setSettings({
        ...settings!,
        ring_timeout_seconds: ringTimeout,
        max_attempts: maxAttempts,
        enabled: enabled ? 1 : 0,
        announcement_message: announcement || null
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (agent: TransferAgent) => {
    setEditingAgentId(agent.id);
    setEditPhone(agent.phone_number);
    setEditName(agent.agent_name || '');
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading transfer settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Auto Warm Transfer
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure automatic transfers when AI detects sales opportunities
              </p>
            </div>
          </div>

          {/* Enable Toggle */}
          <button
            onClick={handleToggleEnabled}
            disabled={togglingEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              enabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            } ${togglingEnabled ? 'opacity-70 cursor-wait' : ''}`}
          >
            {togglingEnabled ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {enabled ? 'Disabling...' : 'Enabling...'}
              </>
            ) : (
              <>
                {enabled ? <Zap className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                {enabled ? 'Enabled' : 'Disabled'}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-600 dark:text-green-400">{successMessage}</span>
          </div>
        )}

        {!enabled ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
              Auto-transfer is currently disabled. Enable it to allow AI to automatically connect callers to your sales team.
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                What happens when you enable:
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>AI will automatically get the <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">transfer_to_sales</code> function</li>
                <li>AI will detect keywords like "pricing", "quote", "speak to human"</li>
                <li>AI will call your agents in priority order until one answers</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Success Banner */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Auto-transfer is active
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                When AI detects a sales opportunity, it will automatically dial your agents.
              </p>
            </div>
            
            {/* Tool Configuration Status */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    AI Function Tool
                  </span>
                </div>
                <code className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded font-mono">
                  transfer_to_sales()
                </code>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                ✓ Installed on assistant "{assistantName || 'this assistant'}"
              </p>
              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  <strong>Triggers:</strong> "pricing", "quote", "demo", "buy", "speak to human", "sales rep"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agent List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Transfer Agents</h4>
            <span className="text-sm text-gray-500">({agents.length})</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Agent
          </button>
        </div>

        {/* Add Agent Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  placeholder="+1 555-123-4567"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g., Tom - Sales"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewAgentPhone('');
                  setNewAgentName('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAgent}
                disabled={!newAgentPhone.trim() || saving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Agent
              </button>
            </div>
          </div>
        )}

        {/* Agents Table */}
        {agents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transfer agents configured</p>
            <p className="text-sm">Add agents who should receive transferred calls</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.sort((a, b) => a.priority - b.priority).map((agent, index) => (
              <div
                key={agent.id}
                className={`flex items-center gap-4 p-3 rounded-lg border ${
                  agent.is_active
                    ? 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm font-medium w-6">{index + 1}</span>
                </div>

                {editingAgentId === agent.id ? (
                  // Edit Mode
                  <>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Agent name"
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateAgent(agent.id)}
                        className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingAgentId(null)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  // View Mode
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {agent.phone_number}
                        </span>
                      </div>
                      {agent.agent_name && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {agent.agent_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAgentActive(agent)}
                        className={`p-1.5 rounded transition-colors ${
                          agent.is_active
                            ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={agent.is_active ? 'Active' : 'Inactive'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(agent)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Transfer Settings</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Ring Timeout (seconds)
            </label>
            <input
              type="number"
              min="10"
              max="60"
              value={ringTimeout}
              onChange={(e) => setRingTimeout(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">How long to ring each agent before trying the next</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Max Attempts
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 3)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum number of agents to try before AI continues</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Announcement Message (Optional)
            </label>
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="e.g., You have an incoming call from a customer interested in windows..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">Message played to the agent before connecting the customer</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Settings
          </button>
        </div>
      </div>

      {/* Transfer Logs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Transfer History & Logs</span>
            <span className="text-sm text-gray-500">(Click to {showLogs ? 'hide' : 'view'})</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showLogs ? 'rotate-180' : ''}`} />
        </button>

        {showLogs && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <AutoTransferLogs assistantId={assistantId} />
          </div>
        )}
      </div>
    </div>
  );
}

