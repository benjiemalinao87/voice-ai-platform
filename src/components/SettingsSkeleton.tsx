/**
 * Settings Skeleton Components
 * Provides loading placeholders for Settings page sections
 * Shows immediate visual feedback while data loads
 */

export function UserProfileSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export function TabNavigationSkeleton() {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-8 px-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-4 px-1 animate-pulse">
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </nav>
    </div>
  );
}

export function ApiConfigSkeleton() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>

      {/* VAPI Credentials Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="h-5 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
        </div>
        <div className="p-6 space-y-6">
          {/* Private Key Field */}
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
          {/* Public Key Field */}
          <div>
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
          {/* Test Button */}
          <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>

      {/* Two Column Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Call Control Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="p-6">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>

        {/* Defaults Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="p-6 space-y-4">
            <div>
              <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
            <div>
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResourcesLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div>
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export function IntegrationCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="space-y-2">
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="flex flex-wrap gap-1 mb-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-md" />
            ))}
          </div>
          <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function TeamMembersSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="space-y-2">
          <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-600 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabContentSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <UserProfileSkeleton />
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <TabNavigationSkeleton />
        <div className="p-6">
          <ApiConfigSkeleton />
        </div>
      </div>
    </div>
  );
}
