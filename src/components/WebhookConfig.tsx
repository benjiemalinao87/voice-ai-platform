import { useState, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  XCircle,
  Tag,
  Loader,
  ExternalLink,
  Phone
} from 'lucide-react';
import { d1Client } from '../lib/d1';
import type { Webhook as WebhookType, WebhookCall } from '../types';

export function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [webhookCalls, setWebhookCalls] = useState<WebhookCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<WebhookCall | null>(null);

  // Load webhooks and calls on mount
  useEffect(() => {
    loadWebhooks();
    loadWebhookCalls();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const data = await d1Client.listWebhooks();
      setWebhooks(data.map(w => ({
        id: w.id,
        user_id: '',
        webhook_url: w.webhook_url,
        name: w.name,
        is_active: w.is_active,
        created_at: w.created_at,
        updated_at: w.created_at,
        call_count: w.call_count
      })));
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookCalls = async () => {
    try {
      const data = await d1Client.getWebhookCalls({ limit: 50 });
      setWebhookCalls(data.map(c => ({
        ...c,
        user_id: ''
      })));
    } catch (error) {
      console.error('Failed to load webhook calls:', error);
    }
  };

  const handleGenerateWebhook = async () => {
    if (!webhookName.trim()) return;

    try {
      setGenerating(true);
      const newWebhook = await d1Client.createWebhook(webhookName);

      setWebhooks([{
        id: newWebhook.id,
        user_id: '',
        webhook_url: newWebhook.url,
        name: newWebhook.name,
        is_active: newWebhook.is_active,
        created_at: newWebhook.created_at,
        updated_at: newWebhook.created_at,
        call_count: 0
      }, ...webhooks]);

      setShowAddModal(false);
      setWebhookName('');
    } catch (error) {
      console.error('Failed to generate webhook:', error);
      alert('Failed to generate webhook. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook? All associated call data will be removed.')) {
      return;
    }

    try {
      await d1Client.deleteWebhook(id);
      setWebhooks(webhooks.filter(w => w.id !== id));
      setWebhookCalls(webhookCalls.filter(c => c.webhook_id !== id));
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook. Please try again.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Webhook className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CHAU Voice AI Webhook Integration</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Receive real-time call data from CHAU Voice AI when calls end
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Webhook
          </button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">How to Use</p>
              <ol className="text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
                <li>Click "Generate Webhook" to create a new webhook endpoint</li>
                <li>Copy the webhook URL</li>
                <li>Go to Voice AI Dashboard → Assistant → Server URL</li>
                <li>Paste the webhook URL and save</li>
                <li>CHAU Voice AI will send call data to this endpoint when calls end</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook List */}
      <div className="grid grid-cols-1 gap-6">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {webhook.name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    webhook.is_active
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                  }`}>
                    {webhook.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {webhook.call_count !== undefined && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                      {webhook.call_count} calls
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Webhook URL */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-32">Webhook URL:</span>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded text-gray-800 dark:text-gray-200 flex-1 font-mono">
                      {webhook.webhook_url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhook.webhook_url, webhook.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy webhook URL"
                    >
                      {copiedId === webhook.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-32">Created:</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {formatTimestamp(webhook.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleDeleteWebhook(webhook.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete Webhook"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {webhooks.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Webhooks Generated
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Generate your first webhook to start receiving call data from CHAU Voice AI
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Generate Webhook
            </button>
          </div>
        )}
      </div>

      {/* Received Webhook Calls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-gray-400" />
          Recent Webhook Calls
        </h3>

        <div className="space-y-3">
          {webhookCalls.slice(0, 10).map((call) => (
            <div
              key={call.id}
              onClick={() => setSelectedCall(call)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {call.phone_number || call.customer_number || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(call.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-medium">Reason:</span> {call.ended_reason}
                      {call.vapi_call_id && (
                        <span className="ml-2">
                          • <span className="font-medium">Call ID:</span> {call.vapi_call_id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                    {call.summary && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {call.summary}
                      </p>
                    )}
                    {call.structured_data && Object.keys(call.structured_data).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(call.structured_data).slice(0, 3).map(([key, value], idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded"
                          >
                            <Tag className="w-3 h-3 inline mr-1" />
                            {key}: {String(value).substring(0, 20)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {webhookCalls.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No webhook calls received yet
            </div>
          )}
        </div>
      </div>

      {/* Generate Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Generate New Webhook
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setWebhookName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook Name *
                  </label>
                  <input
                    type="text"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="e.g., Production Assistant Webhook"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    A unique webhook URL will be automatically generated. You'll use this URL in your Voice AI Assistant settings.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setWebhookName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateWebhook}
                  disabled={!webhookName.trim() || generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Webhook'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Webhook Call Details
                </h3>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</h4>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedCall.phone_number || selectedCall.customer_number || 'Unknown'}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timestamp</h4>
                  <p className="text-gray-900 dark:text-gray-100">
                    {formatTimestamp(selectedCall.created_at)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ended Reason</h4>
                  <p className="text-gray-900 dark:text-gray-100">{selectedCall.ended_reason}</p>
                </div>

                {selectedCall.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Summary</h4>
                    <p className="text-gray-900 dark:text-gray-100">{selectedCall.summary}</p>
                  </div>
                )}

                {selectedCall.recording_url && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recording</h4>
                    <a
                      href={selectedCall.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Listen to Recording <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {selectedCall.structured_data && Object.keys(selectedCall.structured_data).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Structured Data</h4>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
                      <code className="text-gray-800 dark:text-gray-200">
                        {JSON.stringify(selectedCall.structured_data, null, 2)}
                      </code>
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedCall(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
