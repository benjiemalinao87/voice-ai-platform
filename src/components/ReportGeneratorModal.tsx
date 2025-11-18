import React, { useState } from 'react';
import { FileText, X, Download, AlertCircle } from 'lucide-react';
import { generateAndDownloadReport } from '../lib/reportGenerator';

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName?: string;
}

export function ReportGeneratorModal({ isOpen, onClose, workspaceName = 'Your Workspace' }: ReportGeneratorModalProps) {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default: 30 days ago
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setProgress('Initializing...');

    try {
      await generateAndDownloadReport(
        fromDate,
        toDate,
        workspaceName,
        (step) => setProgress(step)
      );
      
      // Success
      setTimeout(() => {
        setIsGenerating(false);
        setProgress('');
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Report generation failed:', err);
      setError(err.message || 'Failed to generate report');
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      onClose();
      setError('');
      setProgress('');
    }
  };

  // Date range presets
  const setDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(from.toISOString().split('T')[0]);
    setToDate(to.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#1E293B] rounded-lg shadow-2xl w-full max-w-md border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Generate Report</h2>
          </div>
          {!isGenerating && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Date Range */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={isGenerating}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateRange(7)}
              disabled={isGenerating}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors disabled:opacity-50"
            >
              Last 7 days
            </button>
            <button
              onClick={() => setDateRange(30)}
              disabled={isGenerating}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors disabled:opacity-50"
            >
              Last 30 days
            </button>
            <button
              onClick={() => setDateRange(90)}
              disabled={isGenerating}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors disabled:opacity-50"
            >
              Last 90 days
            </button>
          </div>

          {/* Progress */}
          {progress && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                <p className="text-sm text-blue-300">{progress}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">Error</p>
                  <p className="text-sm text-red-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Report Info */}
          {!isGenerating && !error && (
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Report will include:</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Total calls and answer rate</li>
                <li>• Call breakdown (answered, missed, forwarded)</li>
                <li>• Appointments booked with details</li>
                <li>• Total minutes and handling time</li>
                <li>• Call end reasons distribution</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !fromDate || !toDate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

