import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Define types for report data
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

interface CallAnalyticsReportProps {
  data: ReportData;
  workspaceName?: string;
}

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#3B82F6',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 3,
  },
  dateRange: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '23%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 4,
    border: 1,
    borderColor: '#E5E7EB',
  },
  metricLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  metricUnit: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 8,
  },
  tableCell: {
    fontSize: 9,
  },
  col1: { width: '25%' },
  col2: { width: '25%' },
  col3: { width: '20%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
    borderTop: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    width: '60%',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
    width: '40%',
  },
  badge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 8,
    padding: 3,
    borderRadius: 3,
    textAlign: 'center',
  },
});

// Helper to format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Helper to format time in minutes
const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const CallAnalyticsReport: React.FC<CallAnalyticsReportProps> = ({ data, workspaceName = 'Your Workspace' }) => {
  const { dateRange, summary, appointments, endedReasons, callsByStatus } = data;
  const generatedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Document>
      {/* Page 1: Summary and Metrics */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Call Analytics Report</Text>
          <Text style={styles.subtitle}>{workspaceName}</Text>
          <Text style={styles.dateRange}>
            Report Period: {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
          </Text>
        </View>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Calls</Text>
              <Text style={styles.metricValue}>{summary.totalCalls}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Answer Rate</Text>
              <Text style={styles.metricValue}>{summary.answerRate}%</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Appointments</Text>
              <Text style={styles.metricValue}>{summary.appointmentsBooked}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Minutes</Text>
              <Text style={styles.metricValue}>{summary.totalMinutes}</Text>
              <Text style={styles.metricUnit}>{formatMinutes(summary.totalMinutes)}</Text>
            </View>
          </View>
        </View>

        {/* Call Volume Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call Volume Breakdown</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Answered Calls (with transcript)</Text>
            <Text style={styles.summaryValue}>{summary.answeredCalls} ({Math.round((summary.answeredCalls / summary.totalCalls) * 100)}%)</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Missed Calls</Text>
            <Text style={styles.summaryValue}>{summary.missedCalls} ({Math.round((summary.missedCalls / summary.totalCalls) * 100)}%)</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Forwarded Calls</Text>
            <Text style={styles.summaryValue}>{summary.forwardedCalls} ({Math.round((summary.forwardedCalls / summary.totalCalls) * 100)}%)</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Voicemail</Text>
            <Text style={styles.summaryValue}>{summary.voicemailCalls} ({Math.round((summary.voicemailCalls / summary.totalCalls) * 100)}%)</Text>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Average Handling Time</Text>
            <Text style={styles.summaryValue}>{formatMinutes(summary.avgHandlingTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Conversion Rate (Appointments/Calls)</Text>
            <Text style={styles.summaryValue}>
              {summary.totalCalls > 0 ? Math.round((summary.appointmentsBooked / summary.totalCalls) * 100) : 0}%
            </Text>
          </View>
        </View>

        {/* Ended Reasons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call End Reasons</Text>
          {endedReasons.slice(0, 5).map((reason, index) => (
            <View key={index} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{reason.reason || 'Unknown'}</Text>
              <Text style={styles.summaryValue}>{reason.count} ({reason.percentage}%)</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated on {generatedDate}</Text>
          <Text>Page 1 of 2</Text>
        </View>
      </Page>

      {/* Page 2: Appointments Details */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Booked Appointments</Text>
          <Text style={styles.subtitle}>{summary.appointmentsBooked} appointments scheduled</Text>
        </View>

        {/* Appointments Table */}
        <View style={styles.section}>
          {appointments.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.col1]}>Phone Number</Text>
                <Text style={[styles.tableCell, styles.col2]}>Customer Name</Text>
                <Text style={[styles.tableCell, styles.col3]}>Appointment Date</Text>
                <Text style={[styles.tableCell, styles.col4]}>Time</Text>
                <Text style={[styles.tableCell, styles.col5]}>Quality Score</Text>
              </View>
              {appointments.map((apt, index) => (
                <View key={apt.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{apt.phone_number}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{apt.customer_name || 'N/A'}</Text>
                  <Text style={[styles.tableCell, styles.col3]}>
                    {apt.appointment_date ? formatDate(apt.appointment_date) : 'N/A'}
                  </Text>
                  <Text style={[styles.tableCell, styles.col4]}>{apt.appointment_time || 'N/A'}</Text>
                  <Text style={[styles.tableCell, styles.col5]}>
                    {apt.quality_score ? `${apt.quality_score}/10` : 'N/A'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>
              No appointments booked during this period
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated on {generatedDate}</Text>
          <Text>Page 2 of 2</Text>
        </View>
      </Page>
    </Document>
  );
};

