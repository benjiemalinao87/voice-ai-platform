import { useState } from 'react';
import type { Node } from 'reactflow';
import { X, Plus, Trash2, Play, Loader2, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import type { FlowNodeData, ApiConfig, ApiHeader, ResponseMapping } from './flowToPrompt';

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface NodeEditorModalProps {
  node: Node<FlowNodeData>;
  onSave: (data: FlowNodeData) => void;
  onClose: () => void;
}

// Helper to get value from object by dot-notation path
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to extract all paths from a JSON object
function extractPaths(obj: any, prefix: string = ''): { path: string; value: any }[] {
  const paths: { path: string; value: any }[] = [];
  
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse into nested objects
        paths.push(...extractPaths(value, fullPath));
      } else {
        // Leaf value (including arrays)
        paths.push({ path: fullPath, value });
      }
    }
  }
  
  return paths;
}

export function NodeEditorModal({ node, onSave, onClose }: NodeEditorModalProps) {
  const [formData, setFormData] = useState<FlowNodeData>({
    ...node.data,
    apiConfig: node.data.apiConfig || {
      endpoint: '',
      method: 'GET',
      headers: [],
      testPhone: '',
      responseMapping: [],
      lastTestResponse: null
    }
  });
  
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(!!node.data.apiConfig?.endpoint);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addIntent = () => {
    setFormData({
      ...formData,
      intents: [...(formData.intents || []), 'New Intent']
    });
  };

  const removeIntent = (index: number) => {
    setFormData({
      ...formData,
      intents: formData.intents?.filter((_, i) => i !== index)
    });
  };

  const updateIntent = (index: number, value: string) => {
    setFormData({
      ...formData,
      intents: formData.intents?.map((intent, i) => i === index ? value : intent)
    });
  };

  // API Config helpers
  const updateApiConfig = (updates: Partial<ApiConfig>) => {
    setFormData({
      ...formData,
      apiConfig: {
        ...formData.apiConfig!,
        ...updates
      }
    });
  };

  const addHeader = () => {
    updateApiConfig({
      headers: [...(formData.apiConfig?.headers || []), { key: '', value: '' }]
    });
  };

  const removeHeader = (index: number) => {
    updateApiConfig({
      headers: formData.apiConfig?.headers.filter((_, i) => i !== index)
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    updateApiConfig({
      headers: formData.apiConfig?.headers.map((h, i) => 
        i === index ? { ...h, [field]: value } : h
      )
    });
  };

  // Test API function
  const testApi = async () => {
    const apiConfig = formData.apiConfig;
    if (!apiConfig?.endpoint) {
      setTestError('Please enter an API endpoint');
      return;
    }

    setTestLoading(true);
    setTestError(null);

    try {
      // Replace {phone} placeholder with test phone
      let targetUrl = apiConfig.endpoint;
      if (apiConfig.testPhone) {
        targetUrl = targetUrl.replace('{phone}', encodeURIComponent(apiConfig.testPhone));
      }

      // Build headers object
      const targetHeaders: Record<string, string> = {};
      apiConfig.headers.forEach(h => {
        if (h.key && h.value) {
          targetHeaders[h.key] = h.value;
        }
      });

      // Use proxy to avoid CORS issues
      const response = await fetch(`${API_URL}/api/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          url: targetUrl,
          method: 'GET',
          headers: targetHeaders
        })
      });

      const proxyResult = await response.json();

      if (!response.ok || proxyResult.status >= 400) {
        throw new Error(proxyResult.error || `HTTP ${proxyResult.status}: ${proxyResult.statusText}`);
      }

      const data = proxyResult.data;
      
      // Extract available paths from response
      const paths = extractPaths(data);
      
      // Merge with existing mappings (preserve enabled state)
      const existingPaths = new Set(apiConfig.responseMapping.map(m => m.path));
      const newMappings: ResponseMapping[] = [
        ...apiConfig.responseMapping,
        ...paths
          .filter(p => !existingPaths.has(p.path))
          .map(p => ({
            path: p.path,
            label: p.path.split('.').pop() || p.path,
            enabled: false
          }))
      ];

      updateApiConfig({
        lastTestResponse: data,
        responseMapping: newMappings
      });
    } catch (error: any) {
      setTestError(error.message || 'API request failed');
      updateApiConfig({ lastTestResponse: null });
    } finally {
      setTestLoading(false);
    }
  };

  const toggleMapping = (path: string) => {
    updateApiConfig({
      responseMapping: formData.apiConfig?.responseMapping.map(m =>
        m.path === path ? { ...m, enabled: !m.enabled } : m
      )
    });
  };

  const updateMappingLabel = (path: string, label: string) => {
    updateApiConfig({
      responseMapping: formData.apiConfig?.responseMapping.map(m =>
        m.path === path ? { ...m, label } : m
      )
    });
  };

  const getNodeTypeLabel = () => {
    switch (node.type) {
      case 'start': return 'Start Node';
      case 'message': return 'Message Node';
      case 'listen': return 'Listen Node';
      case 'branch': return 'Branch Node';
      case 'action': return 'Action Node';
      case 'transfer': return 'Transfer Node';
      case 'end': return 'End Node';
      default: return 'Node';
    }
  };

  const getNodeColor = () => {
    switch (node.type) {
      case 'start': return 'bg-green-500';
      case 'message': return 'bg-blue-500';
      case 'listen': return 'bg-indigo-500';
      case 'branch': return 'bg-purple-500';
      case 'action': return 'bg-orange-500';
      case 'transfer': return 'bg-cyan-500';
      case 'end': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white dark:bg-gray-800 rounded-lg w-full max-h-[85vh] overflow-hidden flex flex-col ${node.type === 'action' ? 'max-w-2xl' : 'max-w-md'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${getNodeColor()} rounded-full`} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit {getNodeTypeLabel()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Content - for message, action nodes */}
          {(node.type === 'message' || node.type === 'action') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {node.type === 'message' ? 'Message Content' : 'Action Description'}
              </label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder={node.type === 'message' ? 'What should the agent say?' : 'Describe the action...'}
              />
            </div>
          )}

          {/* Intents - for listen nodes */}
          {node.type === 'listen' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Intents to Detect
              </label>
              <div className="space-y-2">
                {formData.intents?.map((intent, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={intent}
                      onChange={(e) => updateIntent(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Intent name"
                    />
                    <button
                      type="button"
                      onClick={() => removeIntent(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIntent}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <Plus className="w-4 h-4" />
                  Add Intent
                </button>
              </div>
            </div>
          )}

          {/* Action Type - for action nodes */}
          {node.type === 'action' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Action Type
                </label>
                <select
                  value={formData.actionType || 'custom'}
                  onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="custom">Custom Action</option>
                  <option value="appointment">Book Appointment</option>
                  <option value="lookup">Data Lookup</option>
                  <option value="notify">Send Notification</option>
                  <option value="crm">CRM Update</option>
                </select>
              </div>

              {/* API Configuration Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowApiConfig(!showApiConfig)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      API Configuration
                    </span>
                    {formData.apiConfig?.endpoint && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                        Configured
                      </span>
                    )}
                  </div>
                  {showApiConfig ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {showApiConfig && (
                  <div className="mt-4 space-y-4">
                    {/* Endpoint */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Endpoint
                      </label>
                      <input
                        type="text"
                        value={formData.apiConfig?.endpoint || ''}
                        onChange={(e) => updateApiConfig({ endpoint: e.target.value })}
                        placeholder="https://api.example.com/customer/{phone}"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{phone}'}</code> for customer's phone number
                      </p>
                    </div>

                    {/* Headers */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Headers
                      </label>
                      <div className="space-y-2">
                        {formData.apiConfig?.headers.map((header, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => updateHeader(index, 'key', e.target.value)}
                              placeholder="Header name"
                              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => updateHeader(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeHeader(index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addHeader}
                          className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                        >
                          <Plus className="w-3 h-3" />
                          Add Header
                        </button>
                      </div>
                    </div>

                    {/* Test Section */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Test API
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={formData.apiConfig?.testPhone || ''}
                          onChange={(e) => updateApiConfig({ testPhone: e.target.value })}
                          placeholder="+1234567890"
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />
                        <button
                          type="button"
                          onClick={testApi}
                          disabled={testLoading || !formData.apiConfig?.endpoint}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          {testLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Test
                        </button>
                      </div>

                      {/* Error */}
                      {testError && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs">
                          {testError}
                        </div>
                      )}

                      {/* Response */}
                      {formData.apiConfig?.lastTestResponse && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Response
                          </label>
                          <pre className="p-2 bg-gray-800 dark:bg-gray-950 text-green-400 rounded-lg text-xs overflow-auto max-h-32 font-mono">
                            {JSON.stringify(formData.apiConfig.lastTestResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Response Mapping */}
                    {formData.apiConfig?.responseMapping && formData.apiConfig.responseMapping.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Map Response to Context
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Select fields to pass to AI as conversation context
                        </p>
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {formData.apiConfig.responseMapping.map((mapping) => (
                            <div key={mapping.path} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={mapping.enabled}
                                onChange={() => toggleMapping(mapping.path)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              />
                              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                {mapping.path}
                              </code>
                              <span className="text-gray-400">→</span>
                              <input
                                type="text"
                                value={mapping.label}
                                onChange={(e) => updateMappingLabel(mapping.path, e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                                placeholder="Display label"
                              />
                            </div>
                          ))}
                        </div>
                        
                        {/* Preview of enabled mappings */}
                        {formData.apiConfig.responseMapping.some(m => m.enabled) && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                              Context Preview (passed to AI):
                            </p>
                            <div className="text-xs text-blue-600 dark:text-blue-300">
                              {formData.apiConfig.responseMapping
                                .filter(m => m.enabled)
                                .map(m => {
                                  const value = getValueByPath(formData.apiConfig?.lastTestResponse, m.path);
                                  return (
                                    <div key={m.path}>
                                      • {m.label}: {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'N/A')}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Transfer Number - for transfer nodes */}
          {node.type === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transfer Number
              </label>
              <input
                type="tel"
                value={formData.transferNumber || ''}
                onChange={(e) => setFormData({ ...formData, transferNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="+1234567890"
              />
            </div>
          )}

          {/* End Message - for end nodes */}
          {node.type === 'end' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Closing Message
              </label>
              <textarea
                value={formData.endMessage || ''}
                onChange={(e) => setFormData({ ...formData, endMessage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={2}
                placeholder="Thank you for calling. Have a great day!"
              />
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

