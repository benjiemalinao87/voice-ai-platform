import { useState, useEffect } from 'react';
import { X, Phone, User, MessageSquare, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

interface WarmTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  defaultAgentNumber?: string;
}

type TransferStatus = 'idle' | 'initiated' | 'dialing_agent' | 'agent_answered' | 'connected' | 'failed' | 'cancelled';

export function WarmTransferModal({ isOpen, onClose, callId, defaultAgentNumber = '' }: WarmTransferModalProps) {
  const [agentNumber, setAgentNumber] = useState(defaultAgentNumber);
  const [announcement, setAnnouncement] = useState('');
  const [status, setStatus] = useState<TransferStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll for transfer status when transfer is in progress
  useEffect(() => {
    if (!transferId || status === 'connected' || status === 'failed' || status === 'cancelled') {
      return;
    }

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/calls/${callId}/warm-transfer-status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setStatus(data.status);
          if (data.errorMessage) {
            setErrorMessage(data.errorMessage);
          }
          
          // If connected or failed, stop polling
          if (data.status === 'connected' || data.status === 'failed' || data.status === 'cancelled') {
            return;
          }
        }
      } catch (error) {
        console.error('Error polling transfer status:', error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [transferId, callId, status]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAgentNumber(defaultAgentNumber);
      setAnnouncement('');
      setStatus('idle');
      setErrorMessage(null);
      setTransferId(null);
    }
  }, [isOpen, defaultAgentNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agentNumber.trim()) {
      setErrorMessage('Please enter an agent phone number');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/calls/${callId}/warm-transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentNumber: agentNumber.trim(),
          announcement: announcement.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to initiate warm transfer');
        throw new Error(errorMsg);
      }

      setTransferId(data.transferId);
      setStatus(data.status || 'initiated');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initiate transfer');
      setStatus('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!transferId) {
      onClose();
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/api/calls/${callId}/warm-transfer-cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setStatus('cancelled');
    } catch (error) {
      console.error('Error cancelling transfer:', error);
    }
    
    onClose();
  };

  if (!isOpen) return null;

  const getStatusDisplay = () => {
    switch (status) {
      case 'idle':
        return null;
      case 'initiated':
        return (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Initiating transfer...</span>
          </div>
        );
      case 'dialing_agent':
        return (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Phone className="w-4 h-4 animate-pulse" />
            <span>Dialing agent...</span>
          </div>
        );
      case 'agent_answered':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Agent answered! Connecting customer...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Customer connected to agent!</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span>{errorMessage || 'Transfer failed'}</span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" />
            <span>Transfer cancelled</span>
          </div>
        );
      default:
        return null;
    }
  };

  const isInProgress = status === 'initiated' || status === 'dialing_agent' || status === 'agent_answered';
  const isComplete = status === 'connected' || status === 'failed' || status === 'cancelled';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Warm Transfer
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Status Display */}
          {status !== 'idle' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {getStatusDisplay()}
            </div>
          )}

          {/* Agent Number Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Agent Phone Number
            </label>
            <input
              type="tel"
              value={agentNumber}
              onChange={(e) => setAgentNumber(e.target.value)}
              placeholder="+1234567890"
              disabled={isInProgress || isComplete}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              The agent will be called first. Customer connects when agent answers.
            </p>
          </div>

          {/* Announcement Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Announcement (Optional)
            </label>
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="E.g., You have an incoming call from a customer about..."
              rows={2}
              disabled={isInProgress || isComplete}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This message will be played to the agent before connecting.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && status !== 'failed' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!isComplete ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {isInProgress ? 'Cancel Transfer' : 'Cancel'}
                </button>
                {!isInProgress && (
                  <button
                    type="submit"
                    disabled={isSubmitting || !agentNumber.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        Start Transfer
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

