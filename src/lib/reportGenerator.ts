import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { CallAnalyticsReport } from '../components/CallAnalyticsReport';

const API_BASE = 'https://api.voice-config.channelautomation.com';

interface ReportData {
  dateRange: {
    from: string;
    to: string;
  };
  summary: {
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    forwardedCalls: number;
    voicemailCalls: number;
    answerRate: number;
    totalMinutes: number;
    avgHandlingTime: number;
    appointmentsBooked: number;
  };
  appointments: Array<{
    id: string;
    phone_number: string;
    customer_name: string | null;
    appointment_date: string;
    appointment_time: string;
    quality_score: number | null;
    created_at: number;
  }>;
  endedReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  callsByStatus: {
    answered: number;
    missed: number;
    forwarded: number;
    voicemail: number;
  };
}

/**
 * Fetch report data from API
 */
export async function fetchReportData(
  fromDate?: string,
  toDate?: string
): Promise<ReportData> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const params = new URLSearchParams();
  if (fromDate) params.append('from', fromDate);
  if (toDate) params.append('to', toDate);

  const response = await fetch(`${API_BASE}/api/reports/call-analytics?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report data: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Generate PDF report and return as Blob
 */
export async function generateReportPDF(
  data: ReportData,
  workspaceName?: string
): Promise<Blob> {
  // Create React element
  const reportElement = createElement(CallAnalyticsReport, { 
    data, 
    workspaceName 
  });

  // Generate PDF
  const pdfDoc = pdf(reportElement);
  const blob = await pdfDoc.toBlob();
  
  return blob;
}

/**
 * Download PDF report
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for report
 */
export function generateReportFilename(
  workspaceName: string,
  fromDate: string,
  toDate: string
): string {
  const sanitizedName = workspaceName.replace(/[^a-zA-Z0-9]/g, '_');
  const from = fromDate.replace(/\//g, '-');
  const to = toDate.replace(/\//g, '-');
  return `CallAnalytics_${sanitizedName}_${from}_${to}.pdf`;
}

/**
 * Complete report generation workflow
 */
export async function generateAndDownloadReport(
  fromDate: string,
  toDate: string,
  workspaceName: string,
  onProgress?: (step: string) => void
): Promise<void> {
  try {
    // Step 1: Fetch data
    if (onProgress) onProgress('Fetching report data...');
    const data = await fetchReportData(fromDate, toDate);

    // Step 2: Generate PDF
    if (onProgress) onProgress('Generating PDF...');
    const blob = await generateReportPDF(data, workspaceName);

    // Step 3: Download
    if (onProgress) onProgress('Downloading...');
    const filename = generateReportFilename(workspaceName, fromDate, toDate);
    downloadPDF(blob, filename);

    if (onProgress) onProgress('Complete!');
  } catch (error) {
    console.error('Report generation error:', error);
    throw error;
  }
}

