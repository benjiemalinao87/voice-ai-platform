import { useState, useEffect } from 'react';
import {
  Send,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertCircle,
  Eye,
  RefreshCw,
  Power,
  Activity
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import { useAuth } from '../contexts/AuthContext';

interface OutboundWebhook {
  id: string;
  name: string;
  destination_url: string;
  is_active: boolean;
  events: string[];
  created_at: number;
  updated_at: number;
}

interface WebhookLog {
  id: string;
  event_type: string;
  call_id: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: number;
}

export function OutboundWebhookIntegration() {
  const { token } = useAuth();
  const [webhooks, setWebhooks] = useState<OutboundWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<OutboundWebhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    destination_url: '',
    events: ['call.ended'] as string[]
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const response = await d1Client.get('/api/outbound-webhooks', token);
      setWebhooks(response.webhooks || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (webhookId: string) => {
    try {
      setLoadingLogs(true);
      const response = await d1Client.get(`/api/outbound-webhooks/${webhookId}/logs`, token);
      setLogs(response.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!formData.name || !formData.destination_url) {
      setError('Name and destination URL are required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await d1Client.post('/api/outbound-webhooks', {
        name: formData.name,
        destination_url: formData.destination_url,
        events: formData.events.join(',')
      }, token);

      setShowAddModal(false);
      setFormData({ name: '', destination_url: '', events: ['call.ended'] });
      fetchWebhooks();
    } catch (error: any) {
      setError(error.message || 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (webhook: OutboundWebhook) => {
    try {
      await d1Client.patch(`/api/outbound-webhooks/${webhook.id}`, {
        is_active: !webhook.is_active
      }, token);
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      return;
    }

    try {
      await d1Client.delete(`/api/outbound-webhooks/${webhookId}`, token);
      fetchWebhooks();
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  };

  const handleViewLogs = (webhook: OutboundWebhook) => {
    setSelectedWebhook(webhook);
    fetchLogs(webhook.id);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Outbound Webhooks</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Subscribe to real-time inbound call events
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {/* Description */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">How it works</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Configure your webhook URL to receive real-time notifications when inbound calls occur.
              Choose between <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">call.started</code> (when call is ringing)
              or <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">call.ended</code> (with full call details, transcript, and recording).
            </p>
            <a
              href="/OUTBOUND_WEBHOOK_PAYLOAD.md"
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              View payload documentation <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Send className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No webhooks configured</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first webhook to start receiving real-time call events
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Webhook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {webhook.name}
                    </h3>
                    <button
                      onClick={() => handleToggleActive(webhook)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        webhook.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <ExternalLink className="w-4 h-4" />
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {webhook.destination_url}
                    </code>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded"
                      >
                        {event}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Created {formatDate(webhook.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewLogs(webhook)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="View Logs"
                  >
                    <Activity className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Outbound Webhook</h2>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CRM Integration, Zapier Webhook"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Destination URL
                </label>
                <input
                  type="url"
                  value={formData.destination_url}
                  onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
                  placeholder="https://your-domain.com/webhook"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Must be a valid HTTPS URL
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subscribe to Events
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.events.includes('call.started')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, events: [...formData.events, 'call.started'] });
                        } else {
                          setFormData({ ...formData, events: formData.events.filter(ev => ev !== 'call.started') });
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">call.started</code> - Notified when call is ringing
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.events.includes('call.ended')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, events: [...formData.events, 'call.ended'] });
                        } else {
                          setFormData({ ...formData, events: formData.events.filter(ev => ev !== 'call.ended') });
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">call.ended</code> - Full call details with transcript and recording
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ name: '', destination_url: '', events: ['call.ended'] });
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleAddWebhook}
                disabled={saving || !formData.name || !formData.destination_url || formData.events.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {selectedWebhook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delivery Logs</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedWebhook.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLogs(selectedWebhook.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={loadingLogs}
                >
                  <RefreshCw className={`w-5 h-5 ${loadingLogs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    setSelectedWebhook(null);
                    setLogs([]);
                  }}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No delivery logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {log.event_type}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                            HTTP {log.http_status || 'N/A'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Call ID: <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">{log.call_id}</code>
                      </div>
                      {log.error_message && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
