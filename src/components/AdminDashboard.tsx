/**
 * Admin Dashboard - SaaS Owner Control Panel
 * Connects to deepseek-test-livechat backend for workspace management
 * Follows Customer Connect Command Center design patterns
 */

import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Database,
  Shield,
  Settings as SettingsIcon,
  BarChart3,
  Zap
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { MetricCard } from './MetricCard';
import { AdminWorkspaceTable } from './AdminWorkspaceTable';
import { AdminUserActivity } from './AdminUserActivity';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'workspaces' | 'monitoring' | 'system'>('overview');

  useEffect(() => {
    checkAdminAccessAndLoadData();
  }, []);

  const checkAdminAccessAndLoadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check admin access
      const hasAccess = await adminApi.checkAdminAccess();
      setHasAdminAccess(hasAccess);

      if (hasAccess) {
        // Load dashboard overview
        const response = await adminApi.getDashboardOverview();
        setDashboardData(response.data);
      }
    } catch (error: any) {
      console.error('Error loading admin dashboard:', error);
      setError(error.message);
      setHasAdminAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen-minus-nav">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="flex items-center justify-center h-screen-minus-nav px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full shadow-lg">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-xl mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
            {error || 'You do not have permission to access the admin dashboard. Please contact support if you believe this is an error.'}
          </p>
          {error?.includes('not available') || error?.includes('not configured') ? (
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
              Note: Admin features require a separate backend service. If you need admin access, please configure the admin API endpoint.
            </p>
          ) : error?.includes('Failed to fetch') || error?.includes('Connection refused') ? (
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
              Could not connect to the admin API. Make sure the admin backend service is running.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const { overview } = dashboardData || {};
  const totalRevenue = (overview?.planDistribution?.pro || 0) * 99 +
                       (overview?.planDistribution?.advanced || 0) * 199 +
                       (overview?.planDistribution?.developer || 0) * 399;

  return (
    <div className="space-y-6">
      {/* Header with Tab Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            SaaS Owner Control Panel - Manage all workspaces and subscriptions
          </p>
        </div>

        {/* Premium Segmented Control */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'workspaces'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'monitoring'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            System
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Premium Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Workspaces"
              value={overview?.totalWorkspaces || 0}
              subtitle="Active organizations"
              icon={Users}
              iconColor="text-blue-600"
            />
            <MetricCard
              title="Active Subscriptions"
              value={overview?.activeSubscriptions || 0}
              subtitle="Paying customers"
              icon={TrendingUp}
              iconColor="text-green-600"
            />
            <MetricCard
              title="Monthly Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              subtitle="Recurring revenue"
              icon={DollarSign}
              iconColor="text-emerald-600"
            />
            <MetricCard
              title="System Health"
              value="99.9%"
              subtitle="Uptime this month"
              icon={Zap}
              iconColor="text-purple-600"
            />
          </div>

          {/* Plan Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Subscription Plan Distribution
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Customer breakdown by plan tier
                </p>
              </div>
              <Database className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {overview?.planDistribution && Object.entries(overview.planDistribution).map(([plan, count]) => (
                <div
                  key={plan}
                  className="group bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20" />
                  <div className="relative">
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {plan}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">
                      {count as number}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Activity Chart */}
          <AdminUserActivity />
        </div>
      )}

      {/* Workspaces Tab */}
      {activeTab === 'workspaces' && (
        <div className="space-y-6">
          <AdminWorkspaceTable />
        </div>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Activity className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            API Monitoring
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            API request analytics and rate limit monitoring coming soon
          </p>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <SettingsIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            System Settings
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            System health monitoring and audit logs coming soon
          </p>
        </div>
      )}
    </div>
  );
}
