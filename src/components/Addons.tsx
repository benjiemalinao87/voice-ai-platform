import { useState, useEffect } from 'react';
import { Zap, Database, Sparkles, ChevronRight, Check, X, Globe } from 'lucide-react';
import { d1Client } from '../lib/d1';
import { EmbeddingModal } from './EmbeddingModal';

interface Addon {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  type: string;
  isPaid: boolean;
  isEnabled: boolean;
  features: string[];
  price?: string;
}

const availableAddons: Omit<Addon, 'isEnabled'>[] = [
  {
    id: 'enhanced_data',
    name: 'Enhanced Data',
    description: 'Enrich customer phone numbers with additional contact information, location data, carrier details, and verification status.',
    icon: <Database className="w-6 h-6" />,
    type: 'enhanced_data',
    isPaid: true,
    price: 'Request-based pricing',
    features: [
      'Phone number validation',
      'Carrier information',
      'Location data',
      'Contact enrichment',
      'Real-time verification'
    ]
  },
  {
    id: 'embedding',
    name: 'Embedding',
    description: 'Embed external websites and applications as modals within your dashboard. Provide a URL to open any site in a modal overlay.',
    icon: <Globe className="w-6 h-6" />,
    type: 'embedding',
    isPaid: false,
    features: [
      'Embed any website URL',
      'Modal overlay display',
      'Full-screen support',
      'Easy configuration',
      'Secure iframe embedding'
    ]
  }
];

export function Addons() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showEmbeddingModal, setShowEmbeddingModal] = useState(false);
  const [embeddingUrl, setEmbeddingUrl] = useState<string>('');
  const [embeddingButtonName, setEmbeddingButtonName] = useState<string>('');

  useEffect(() => {
    loadAddons();
  }, []);

  const loadAddons = async () => {
    try {
      setLoading(true);
      const response = await d1Client.getAddons();

      // Merge available addons with user's enabled status
      const mergedAddons = availableAddons.map(addon => {
        const userAddon = response.addons.find((a: any) => a.addon_type === addon.type);
        return {
          ...addon,
          isEnabled: userAddon ? userAddon.is_enabled === 1 : false
        };
      });

      setAddons(mergedAddons);

      // Load embedding URL and button name if embedding addon exists
      const embeddingAddon = response.addons.find((a: any) => a.addon_type === 'embedding');
      if (embeddingAddon && embeddingAddon.settings) {
        try {
          const settings = JSON.parse(embeddingAddon.settings);
          if (settings.url) {
            setEmbeddingUrl(settings.url);
          }
          if (settings.buttonName) {
            setEmbeddingButtonName(settings.buttonName);
          }
        } catch (e) {
          console.error('Error parsing embedding settings:', e);
        }
      }
    } catch (error) {
      console.error('Error loading addons:', error);
      // Set default state if error
      setAddons(availableAddons.map(addon => ({ ...addon, isEnabled: false })));
    } finally {
      setLoading(false);
    }
  };

  const toggleAddon = async (addonType: string, currentState: boolean) => {
    try {
      setToggling(addonType);
      const newState = !currentState;

      await d1Client.toggleAddon(addonType, newState);

      // Update local state
      setAddons(prev => prev.map(addon =>
        addon.type === addonType ? { ...addon, isEnabled: newState } : addon
      ));
    } catch (error) {
      console.error('Error toggling addon:', error);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Addons</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enhance your Voice AI dashboard with powerful addons</p>
        </div>
      </div>

      {/* Addons Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {addons.map((addon) => (
          <div
            key={addon.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${addon.isEnabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                  {addon.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {addon.name}
                    {addon.isPaid && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                        Paid
                      </span>
                    )}
                  </h3>
                  {addon.price && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {addon.price}
                    </p>
                  )}
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => toggleAddon(addon.type, addon.isEnabled)}
                disabled={toggling === addon.type}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${addon.isEnabled
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                  } ${toggling === addon.type ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addon.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {addon.description}
            </p>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Features
              </p>
              <ul className="space-y-1.5">
                {addon.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Status */}
            <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-gray-700`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${addon.isEnabled
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  {addon.isEnabled ? 'Active' : 'Inactive'}
                </span>
                {addon.isEnabled && addon.type !== 'embedding' && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Sparkles className="w-3 h-3" />
                    Processing calls automatically
                  </span>
                )}
              </div>
              {addon.type === 'embedding' && addon.isEnabled && (
                <button
                  onClick={() => setShowEmbeddingModal(true)}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  {embeddingUrl ? 'Open Embedded Site' : 'Configure Embedding'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 p-4">
        <div className="flex gap-3">
          <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded-full h-fit">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">How Addons Work</p>
            <p className="text-blue-700 dark:text-blue-300">
              Addons are automatically triggered when a call ends and data is received. They process information in the background and results are stored with your call records. Billing is based on actual usage.
            </p>
          </div>
        </div>
      </div>

      {/* Embedding Modal */}
      {showEmbeddingModal && (
        <EmbeddingModal
          isOpen={showEmbeddingModal}
          onClose={() => setShowEmbeddingModal(false)}
          initialUrl={embeddingUrl}
          initialButtonName={embeddingButtonName}
          onUrlSaved={(url, buttonName) => {
            setEmbeddingUrl(url);
            setEmbeddingButtonName(buttonName);
            loadAddons(); // Reload to get updated settings
            // Trigger a custom event to notify App.tsx to reload embedding settings
            window.dispatchEvent(new CustomEvent('embeddingSettingsUpdated'));
          }}
        />
      )}
    </div>
  );
}
