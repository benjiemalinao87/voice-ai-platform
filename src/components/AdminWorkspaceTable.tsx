/**
 * Admin Workspace Table Component
 * Displays all workspaces with subscription details and usage metrics
 * Premium design matching Customer Connect Command Center patterns
 */

import { useState, useEffect } from 'react';
import { Search, Users, Edit3, X } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface Workspace {
  id: string;
  name: string;
  api_requests_count?: number;
  api_limit?: number;
  contacts_count?: number;
  workspace_subscriptions?: Array<{
    plan_name: string;
    subscription_status: string;
    subscription_plans?: {
      display_name: string;
      limits?: {
        contacts?: number;
        sequences?: number;
      };
    };
  }>;
}

export function AdminWorkspaceTable() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [updateReason, setUpdateReason] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getWorkspaces();
      setWorkspaces(response.data || []);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedWorkspace || !selectedPlan || !updateReason.trim()) {
      return;
    }

    try {
      setUpdating(true);
      await adminApi.updateWorkspaceSubscription(
        selectedWorkspace.id,
        selectedPlan,
        updateReason
      );

      // Reload workspaces
      await loadWorkspaces();

      // Close modal and reset
      setShowUpdateModal(false);
      setSelectedWorkspace(null);
      setSelectedPlan('');
      setUpdateReason('');
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      alert(`Failed to update subscription: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const getPlanBadgeColor = (planName: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
      pro: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700',
      advanced: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700',
      developer: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700',
    };
    return colors[planName] || colors.free;
  };

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    if (!limit || limit === 0) return 100;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const filteredWorkspaces = workspaces.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase());
    const currentPlan = workspace.workspace_subscriptions?.[0]?.plan_name || 'free';
    const matchesPlan = !filterPlan || currentPlan === filterPlan;
    return matchesSearch && matchesPlan;
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Premium Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-300 hover:border-gray-400 dark:hover:border-gray-500"
            />
          </div>

          {/* Plan Filter */}
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-300"
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="advanced">Advanced</option>
            <option value="developer">Developer</option>
          </select>

          {/* Results Count */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {filteredWorkspaces.length} / {workspaces.length}
            </span>
          </div>
        </div>
      </div>

      {/* Premium Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Workspace
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  API Usage
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Contacts
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredWorkspaces.map((workspace) => {
                const subscription = workspace.workspace_subscriptions?.[0];
                const plan = subscription?.subscription_plans;
                const limits = plan?.limits || {};
                const apiUsagePercent = ((workspace.api_requests_count || 0) / (workspace.api_limit || 1000)) * 100;
                const contactsPercent = getUsagePercentage(workspace.contacts_count || 0, limits.contacts || 1000);

                return (
                  <tr
                    key={workspace.id}
                    className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {workspace.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          ID: {workspace.id.substring(0, 12)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 hover:scale-105 ${getPlanBadgeColor(
                          subscription?.plan_name || 'free'
                        )}`}
                      >
                        {plan?.display_name || 'Free Plan'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {workspace.api_requests_count || 0} / {workspace.api_limit || 1000}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {apiUsagePercent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${getUsageColor(apiUsagePercent)}`}
                            style={{ width: `${Math.min(apiUsagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {workspace.contacts_count || 0} / {limits.contacts === -1 ? '∞' : limits.contacts || 1000}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${getUsageColor(contactsPercent)}`}
                            style={{ width: `${Math.min(contactsPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          subscription?.subscription_status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {subscription?.subscription_status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedWorkspace(workspace);
                          setSelectedPlan(subscription?.plan_name || 'free');
                          setShowUpdateModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 hover:scale-105 font-medium text-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                        Update Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredWorkspaces.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No workspaces found matching your criteria.
            </p>
          </div>
        )}
      </div>

      {/* Update Plan Modal */}
      {showUpdateModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Update Subscription
              </h3>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Workspace</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedWorkspace.name}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  New Plan
                </label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="free">Free Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="advanced">Advanced Plan</option>
                  <option value="developer">Developer Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Reason for Change
                </label>
                <textarea
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  placeholder="Required for audit trail..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUpdateModal(false)}
                disabled={updating}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={updating || !selectedPlan || !updateReason.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
