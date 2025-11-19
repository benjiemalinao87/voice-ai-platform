import { useState, useEffect } from 'react';
import { Globe, X, Save, ExternalLink, Maximize2, Minimize2, Settings } from 'lucide-react';
import { d1Client } from '../lib/d1';

interface EmbeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  initialButtonName?: string;
  onUrlSaved?: (url: string, buttonName: string) => void;
}

export function EmbeddingModal({ isOpen, onClose, initialUrl = '', initialButtonName = '', onUrlSaved }: EmbeddingModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [buttonName, setButtonName] = useState(initialButtonName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIframe, setShowIframe] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setButtonName(initialButtonName);
      // If there's an initial URL, show iframe directly
      setShowIframe(!!initialUrl);
    } else {
      // Reset when modal closes
      setShowIframe(false);
      setIsFullscreen(false);
    }
  }, [initialUrl, initialButtonName, isOpen]);

  if (!isOpen) return null;

  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) return false;
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    if (!buttonName.trim()) {
      setError('Please enter a button name');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await d1Client.saveEmbeddingSettings(url, buttonName);
      if (onUrlSaved) {
        onUrlSaved(url, buttonName);
      }
      setShowIframe(true);
    } catch (err: any) {
      console.error('Error saving embedding settings:', err);
      setError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setShowIframe(true);
    setError('');
  };

  const handleClose = () => {
    setError('');
    setShowIframe(false);
    setIsFullscreen(false);
    onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // If showing iframe, display the embedded site
  if (showIframe && url) {
    return (
      <div className={`fixed inset-0 bg-black/90 z-50 ${isFullscreen ? '' : 'p-4'}`}>
        {/* Header Bar */}
        <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-gray-200">
              {buttonName || 'Embedded Site'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Iframe Container */}
        <div className={`${isFullscreen ? 'h-[calc(100vh-73px)]' : 'h-[calc(100vh-120px)]'} w-full`}>
          <iframe
            src={url}
            className="w-full h-full border-0"
            title="Embedded Site"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            allow="fullscreen"
          />
        </div>
      </div>
    );
  }

  // Configuration modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Configure Embedding</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Button Name
            </label>
            <input
              type="text"
              value={buttonName}
              onChange={(e) => {
                setButtonName(e.target.value);
                setError('');
              }}
              placeholder="My App"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This name will appear on the button in the main header
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter the URL of the website you want to embed
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !url.trim() || !buttonName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Open'}
            </button>
            {url && validateUrl(url) && (
              <button
                onClick={handleOpen}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

