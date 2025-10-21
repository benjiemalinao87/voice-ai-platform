/**
 * Admin User Activity Component
 * Displays user login activity, signups, and active users over time
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Users, UserPlus, Activity } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

export function AdminUserActivity() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7days');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getUserActivity(timeRange);
      setData(response.data);
    } catch (error) {
      console.error('Error loading user activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            User Activity Trends
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Login activity, signups, and active users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30" />
          <div className="relative flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Total Logins
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">
                {data?.summary?.totalLogins || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/30 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30" />
          <div className="relative flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                New Signups
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">
                {data?.summary?.totalSignups || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/30 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30" />
          <div className="relative flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Active Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">
                {data?.summary?.totalActiveUsers || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Bar Chart Visualization */}
      <div className="space-y-3">
        {data?.labels?.map((label: string, index: number) => {
          const loginValue = data.datasets.logins[index];
          const signupValue = data.datasets.signups[index];
          const maxValue = Math.max(...data.datasets.logins);

          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 font-medium">{label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {loginValue} logins
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {signupValue} signups
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(loginValue / maxValue) * 100}%` }}
                  />
                </div>
                {signupValue > 0 && (
                  <div className="w-12 bg-green-200 dark:bg-green-900/30 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-2 rounded-full w-full" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
