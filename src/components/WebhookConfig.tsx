import { useState } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  AlertCircle, 
  Send, 
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  Tag,
  Filter
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  enabled: boolean;
  keywords: string[];
  triggers: {
    allCalls: boolean;
    keywordMatch: boolean;
    callCompleted: boolean;
    callFailed: boolean;
  };
  createdAt: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  webhookName: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  responseTime?: number;
  callId: string;
  customerName: string;
  matchedKeywords: string[];
  payload: any;
  errorMessage?: string;
}

// Mock webhook endpoints
const mockWebhooks: WebhookEndpoint[] = [
  {
    id: 'wh_1',
    name: 'Salesforce Lead Sync',
    url: 'https://api.salesforce.com/webhooks/leads',
    secret: 'sk_live_abc123xyz789',
    enabled: true,
    keywords: ['interested', 'pricing', 'purchase', 'schedule appointment'],
    triggers: {
      allCalls: false,
      keywordMatch: true,
      callCompleted: true,
      callFailed: false
    },
    createdAt: '2025-01-10T08:30:00Z'
  },
  {
    id: 'wh_2',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX',
    enabled: true,
    keywords: ['complaint', 'urgent', 'emergency', 'dissatisfied'],
    triggers: {
      allCalls: false,
      keywordMatch: true,
      callCompleted: true,
      callFailed: true
    },
    createdAt: '2025-01-12T14:20:00Z'
  }
];

// Mock webhook logs
const mockLogs: WebhookLog[] = [
  {
    id: 'log_1',
    webhookId: 'wh_1',
    webhookName: 'Salesforce Lead Sync',
    timestamp: '2025-01-15T10:30:45Z',
    status: 'success',
    statusCode: 200,
    responseTime: 245,
    callId: 'call_abc123',
    customerName: 'Erin Farley',
    matchedKeywords: ['schedule appointment', 'interested'],
    payload: {
      customer: 'Erin Farley',
      phone: '+1 (316) 299-3145',
      intent: 'scheduling',
      confidence: 0.85,
      keywords: ['schedule appointment', 'interested']
    }
  },
  {
    id: 'log_2',
    webhookId: 'wh_2',
    webhookName: 'Slack Notifications',
    timestamp: '2025-01-15T11:15:22Z',
    status: 'success',
    statusCode: 200,
    responseTime: 180,
    callId: 'call_xyz789',
    customerName: 'María González',
    matchedKeywords: ['complaint', 'dissatisfied'],
    payload: {
      customer: 'María González',
      phone: '+1 (555) 234-5678',
      intent: 'complaint',
      confidence: 0.78,
      keywords: ['complaint', 'dissatisfied']
    }
  },
  {
    id: 'log_3',
    webhookId: 'wh_1',
    webhookName: 'Salesforce Lead Sync',
    timestamp: '2025-01-15T12:05:10Z',
    status: 'failed',
    statusCode: 500,
    responseTime: 5000,
    callId: 'call_def456',
    customerName: 'Michael Rodriguez',
    matchedKeywords: ['pricing', 'purchase'],
    payload: {
      customer: 'Michael Rodriguez',
      phone: '+1 (555) 345-6789',
      intent: 'information',
      confidence: 0.92,
      keywords: ['pricing', 'purchase']
    },
    errorMessage: 'Connection timeout - Could not reach Salesforce API'
  }
];

export function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(mockWebhooks);
  const [logs, setLogs] = useState<WebhookLog[]>(mockLogs);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [showSecret, setShowSecret] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  // New webhook form state
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    secret: '',
    keywords: '',
    triggers: {
      allCalls: false,
      keywordMatch: true,
      callCompleted: true,
      callFailed: false
    }
  });

  const handleAddWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) return;

    const webhook: WebhookEndpoint = {
      id: `wh_${Date.now()}`,
      name: newWebhook.name,
      url: newWebhook.url,
      secret: newWebhook.secret || undefined,
      enabled: true,
      keywords: newWebhook.keywords.split(',').map(k => k.trim()).filter(k => k),
      triggers: newWebhook.triggers,
      createdAt: new Date().toISOString()
    };

    setWebhooks([...webhooks, webhook]);
    setShowAddModal(false);
    setNewWebhook({
      name: '',
      url: '',
      secret: '',
      keywords: '',
      triggers: {
        allCalls: false,
        keywordMatch: true,
        callCompleted: true,
        callFailed: false
      }
    });
  };

  const handleDeleteWebhook = (id: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      setWebhooks(webhooks.filter(w => w.id !== id));
    }
  };

  const toggleWebhook = (id: string) => {
    setWebhooks(webhooks.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const testWebhook = async (id: string) => {
    setTestingWebhook(id);
    
    // Simulate webhook test
    setTimeout(() => {
      const webhook = webhooks.find(w => w.id === id);
      if (webhook) {
        const testLog: WebhookLog = {
          id: `log_test_${Date.now()}`,
          webhookId: id,
          webhookName: webhook.name,
          timestamp: new Date().toISOString(),
          status: 'success',
          statusCode: 200,
          responseTime: 150,
          callId: 'call_test_' + Date.now(),
          customerName: 'Test Customer',
          matchedKeywords: webhook.keywords.slice(0, 2),
          payload: {
            customer: 'Test Customer',
            phone: '+1 (555) 000-0000',
            intent: 'test',
            confidence: 1.0,
            keywords: webhook.keywords.slice(0, 2)
          }
        };
        setLogs([testLog, ...logs]);
      }
      setTestingWebhook(null);
    }, 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Webhook className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Webhook Configuration</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Send call data to external systems based on keyword detection
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">How Webhooks Work</p>
              <p className="text-blue-700 dark:text-blue-300">
                Webhooks automatically send POST requests to your specified URLs when calls are completed. 
                Set up keyword triggers to send data only when specific words are detected in conversations.
              </p>
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
                    webhook.enabled 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                  }`}>
                    {webhook.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {/* URL */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-20">URL:</span>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-800 dark:text-gray-200 flex-1">
                      {webhook.url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhook.url, webhook.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      {copiedId === webhook.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Secret */}
                  {webhook.secret && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Secret:</span>
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-800 dark:text-gray-200 flex-1">
                        {showSecret[webhook.id] ? webhook.secret : '••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowSecret({ ...showSecret, [webhook.id]: !showSecret[webhook.id] })}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {showSecret[webhook.id] ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-20 mt-1">Keywords:</span>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {webhook.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs rounded-md"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Triggers */}
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-20 mt-1">Triggers:</span>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {webhook.triggers.allCalls && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">✓ All Calls</span>
                      )}
                      {webhook.triggers.keywordMatch && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">✓ Keyword Match</span>
                      )}
                      {webhook.triggers.callCompleted && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">✓ Call Completed</span>
                      )}
                      {webhook.triggers.callFailed && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">✓ Call Failed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => testWebhook(webhook.id)}
                  disabled={testingWebhook === webhook.id}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Test Webhook"
                >
                  {testingWebhook === webhook.id ? (
                    <PlayCircle className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => toggleWebhook(webhook.id)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    webhook.enabled
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30'
                  }`}
                >
                  {webhook.enabled ? 'Disable' : 'Enable'}
                </button>
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
              No Webhooks Configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add your first webhook to start receiving call data
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Webhook
            </button>
          </div>
        )}
      </div>

      {/* Webhook Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Webhook Activity
        </h3>
        
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(log.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {log.webhookName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Call from <span className="font-medium">{log.customerName}</span>
                      {log.statusCode && (
                        <span className="ml-2">
                          • Status: {log.statusCode} • {log.responseTime}ms
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {log.matchedKeywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded"
                        >
                          <Tag className="w-3 h-3 inline mr-1" />
                          {keyword}
                        </span>
                      ))}
                    </div>
                    {log.errorMessage && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No webhook activity yet
            </div>
          )}
        </div>
      </div>

      {/* Add Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Add New Webhook
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
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
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                    placeholder="e.g., Salesforce Lead Sync"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook URL *
                  </label>
                  <input
                    type="url"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    placeholder="https://api.example.com/webhook"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secret Key (optional)
                  </label>
                  <input
                    type="text"
                    value={newWebhook.secret}
                    onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                    placeholder="For webhook signature verification"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newWebhook.keywords}
                    onChange={(e) => setNewWebhook({ ...newWebhook, keywords: e.target.value })}
                    placeholder="interested, pricing, schedule, urgent"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Webhook will trigger when these keywords are detected in call transcripts
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trigger Conditions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newWebhook.triggers.allCalls}
                        onChange={(e) => setNewWebhook({
                          ...newWebhook,
                          triggers: { ...newWebhook.triggers, allCalls: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Send for all calls</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newWebhook.triggers.keywordMatch}
                        onChange={(e) => setNewWebhook({
                          ...newWebhook,
                          triggers: { ...newWebhook.triggers, keywordMatch: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Send only when keywords match</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newWebhook.triggers.callCompleted}
                        onChange={(e) => setNewWebhook({
                          ...newWebhook,
                          triggers: { ...newWebhook.triggers, callCompleted: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Send when call completes successfully</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newWebhook.triggers.callFailed}
                        onChange={(e) => setNewWebhook({
                          ...newWebhook,
                          triggers: { ...newWebhook.triggers, callFailed: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Send when call fails</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWebhook}
                  disabled={!newWebhook.name || !newWebhook.url}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Webhook Request Details
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedLog.status)}
                  <span className={`font-medium ${
                    selectedLog.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedLog.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                  {selectedLog.statusCode && (
                    <span className="text-gray-600 dark:text-gray-400">
                      • HTTP {selectedLog.statusCode}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook</h4>
                  <p className="text-gray-900 dark:text-gray-100">{selectedLog.webhookName}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timestamp</h4>
                  <p className="text-gray-900 dark:text-gray-100">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Matched Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.matchedKeywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-sm rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payload Sent</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
                    <code className="text-gray-800 dark:text-gray-200">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </code>
                  </pre>
                </div>

                {selectedLog.errorMessage && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Error Message</h4>
                    <p className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedLog(null)}
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

