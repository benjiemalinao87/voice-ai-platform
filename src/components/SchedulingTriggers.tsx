import { useState, useEffect } from 'react';
import { Zap, Plus, Edit3, Trash2, Power, Calendar, ExternalLink, CheckCircle, XCircle, Eye } from 'lucide-react';

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface SchedulingTrigger {
  id: string;
  name: string;
  destination_url: string;
  is_active: number;
  send_enhanced_data: number;
  created_at: number;
  updated_at: number;
}

interface TriggerLog {
  id: string;
  trigger_id: string;
  call_id: string;
  status: string;
  http_status: number;
  response_body: string;
  error_message: string;
  payload_sent: string;
  created_at: number;
  trigger_name: string;
  customer_name: string;
  appointment_date: string;
  appointment_time: string;
}

export function SchedulingTriggers() {
  const [triggers, setTriggers] = useState<SchedulingTrigger[]>([]);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<SchedulingTrigger | null>(null);
  const [selectedLog, setSelectedLog] = useState<TriggerLog | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    destination_url: '',
    send_enhanced_data: true
  });

  useEffect(() => {
    loadTriggers();
    loadLogs();
  }, []);

  const loadTriggers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/scheduling-triggers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setTriggers(data);
    } catch (error) {
      console.error('Error loading triggers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/scheduling-trigger-logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const url = editingTrigger
        ? `${API_URL}/api/scheduling-triggers/${editingTrigger.id}`
        : `${API_URL}/api/scheduling-triggers`;

      const method = editingTrigger ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      await loadTriggers();
      setShowCreateModal(false);
      setEditingTrigger(null);
      setFormData({ name: '', destination_url: '', send_enhanced_data: true });
    } catch (error) {
      console.error('Error saving trigger:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return;

    try {
      await fetch(`${API_URL}/api/scheduling-triggers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      await loadTriggers();
    } catch (error) {
      console.error('Error deleting trigger:', error);
    }
  };

  const handleToggleActive = async (trigger: SchedulingTrigger) => {
    try {
      await fetch(`${API_URL}/api/scheduling-triggers/${trigger.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...trigger,
          is_active: trigger.is_active ? 0 : 1
        })
      });
      await loadTriggers();
    } catch (error) {
      console.error('Error toggling trigger:', error);
    }
  };

  const openEditModal = (trigger: SchedulingTrigger) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      destination_url: trigger.destination_url,
      send_enhanced_data: trigger.send_enhanced_data === 1
    });
    setShowCreateModal(true);
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Scheduling Triggers
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Automatically send appointment data to your webhook when customers book appointments
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTrigger(null);
            setFormData({ name: '', destination_url: '', send_enhanced_data: true });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Trigger
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">
              How It Works
            </h3>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              When a caller successfully books an appointment (detected by AI), we automatically send their information
              (name, email, phone, appointment details, call recording, and optional enhanced data) to your webhook URL in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Triggers List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Active Triggers ({triggers.length})
          </h3>
        </div>

        {triggers.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No triggers configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first scheduling trigger to start receiving appointment webhooks
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {trigger.name}
                      </h4>
                      <button
                        onClick={() => handleToggleActive(trigger)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                          trigger.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {trigger.is_active ? 'Active' : 'Inactive'}
                      </button>
                      {trigger.send_enhanced_data === 1 && (
                        <span className="px-3 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                          Enhanced Data Enabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {trigger.destination_url}
                      </code>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {formatDate(trigger.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(trigger)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(trigger.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Webhook Deliveries ({logs.length})
          </h3>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No webhook deliveries yet. Logs will appear here when appointments are booked.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Appointment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.status === 'success' ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">{log.http_status}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Failed</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {log.customer_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {log.appointment_date} {log.appointment_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {log.trigger_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTrigger ? 'Edit Trigger' : 'Create Scheduling Trigger'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigger Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CRM Integration"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Destination Webhook URL
                </label>
                <input
                  type="url"
                  value={formData.destination_url}
                  onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
                  placeholder="https://your-app.com/webhook"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="send_enhanced_data"
                  checked={formData.send_enhanced_data}
                  onChange={(e) => setFormData({ ...formData, send_enhanced_data: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="send_enhanced_data" className="text-sm text-gray-700 dark:text-gray-300">
                  Include Enhanced Data (property, financial info) if available
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTrigger(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={!formData.name || !formData.destination_url}
                className="flex-1 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTrigger ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Webhook Delivery Details
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                  <p className={`text-sm font-semibold ${selectedLog.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {selectedLog.status === 'success' ? `Success (${selectedLog.http_status})` : 'Failed'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLog.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Appointment</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedLog.appointment_date} at {selectedLog.appointment_time}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Trigger</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLog.trigger_name}</p>
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Error</p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-300">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Payload Sent</p>
                <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs text-gray-900 dark:text-gray-100 overflow-x-auto">
                  {JSON.stringify(JSON.parse(selectedLog.payload_sent || '{}'), null, 2)}
                </pre>
              </div>

              {selectedLog.response_body && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Response</p>
                  <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs text-gray-900 dark:text-gray-100 overflow-x-auto">
                    {selectedLog.response_body}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
