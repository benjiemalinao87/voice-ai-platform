import { useState } from 'react';
import type { Node } from 'reactflow';
import { X, Plus, Trash2 } from 'lucide-react';
import type { FlowNodeData } from './flowToPrompt';

interface NodeEditorModalProps {
  node: Node<FlowNodeData>;
  onSave: (data: FlowNodeData) => void;
  onClose: () => void;
}

export function NodeEditorModal({ node, onSave, onClose }: NodeEditorModalProps) {
  const [formData, setFormData] = useState<FlowNodeData>({
    ...node.data
  });

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
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
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

