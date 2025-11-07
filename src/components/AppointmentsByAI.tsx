import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, User, FileText, Star, AlertCircle, Package, CheckCircle, XCircle, X } from 'lucide-react';
import { d1Client } from '../lib/d1';

interface AppointmentData {
  id: string;
  vapi_call_id: string;
  phone_number: string | null;
  customer_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  quality_score: number | null;
  issue_type: string | null;
  customer_frustrated: boolean | null;
  escalation_required: boolean | null;
  call_summary: string | null;
  product: string | null;
  created_at: number;
}

interface DedupedAppointment extends AppointmentData {
  appointmentCount: number;
  allAppointments: AppointmentData[];
}

export function AppointmentsByAI() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<DedupedAppointment | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await d1Client.getAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Deduplicate appointments by phone number
  const deduplicateAppointments = (): DedupedAppointment[] => {
    const phoneMap = new Map<string, AppointmentData[]>();

    // Group appointments by phone number
    appointments.forEach(apt => {
      const phone = apt.phone_number || 'unknown';
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, []);
      }
      phoneMap.get(phone)!.push(apt);
    });

    // For each phone number, get the most recent appointment
    const deduped: DedupedAppointment[] = [];
    phoneMap.forEach((apts, phone) => {
      // Sort by created_at descending (most recent first)
      const sorted = [...apts].sort((a, b) => b.created_at - a.created_at);
      const latest = sorted[0];

      deduped.push({
        ...latest,
        appointmentCount: sorted.length,
        allAppointments: sorted
      });
    });

    // Sort the final list by created_at descending
    return deduped.sort((a, b) => b.created_at - a.created_at);
  };

  const dedupedAppointments = deduplicateAppointments();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    return timeString;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
          </div>
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-center">
                    <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mx-auto"></div>
                  </th>
                  <th className="px-6 py-3 text-center">
                    <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mx-auto"></div>
                  </th>
                  <th className="px-6 py-3 text-center">
                    <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mx-auto"></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...Array(5)].map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mx-auto"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Appointments by AI
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-generated appointment data from call analysis
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {dedupedAppointments.length} Unique Customers
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({appointments.length} total)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Name
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Product
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <Star className="w-4 h-4" />
                    Quality Score
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Escalation Required
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dedupedAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No appointments found
                  </td>
                </tr>
              ) : (
                dedupedAppointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedAppointment(appointment)}
                  >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          <span>{appointment.phone_number || 'N/A'}</span>
                          {appointment.appointmentCount > 1 && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-blue-600 dark:bg-blue-500 text-white rounded-full">
                              {appointment.appointmentCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {appointment.customer_name || (
                          <span className="text-gray-400 dark:text-gray-500 italic">Not available</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(appointment.appointment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatTime(appointment.appointment_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {appointment.product ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 capitalize">
                            {appointment.product}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {appointment.quality_score !== null ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                              {appointment.quality_score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {appointment.escalation_required !== null ? (
                          appointment.escalation_required ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30">
                              <span className="text-green-600 dark:text-green-400 text-sm font-bold">✓</span>
                            </div>
                          )
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {appointment.call_summary ? (
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto" />
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Drawer Panel */}
      {selectedAppointment && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setSelectedAppointment(null)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appointment Details</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedAppointment.phone_number || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Main Appointment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Name</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedAppointment.customer_name || 'Not available'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Date & Time</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(selectedAppointment.appointment_date)} at {formatTime(selectedAppointment.appointment_time)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Product</p>
                  {selectedAppointment.product ? (
                    <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-medium capitalize">
                      {selectedAppointment.product}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Quality Score</p>
                  {selectedAppointment.quality_score !== null ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAppointment.quality_score}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </div>
              </div>

              {/* Call Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Issue Type</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedAppointment.issue_type?.replace(/_/g, ' ') || '-'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Customer Frustrated</p>
                  <div className="flex items-center gap-2">
                    {selectedAppointment.customer_frustrated !== null ? (
                      selectedAppointment.customer_frustrated ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Yes</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">No</span>
                        </>
                      )
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 col-span-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Escalation Required</p>
                  <div className="flex items-center gap-2">
                    {selectedAppointment.escalation_required !== null ? (
                      selectedAppointment.escalation_required ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Yes</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">No</span>
                        </>
                      )
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Call Summary */}
              {selectedAppointment.call_summary && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Call Summary</h4>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedAppointment.call_summary}
                  </p>
                </div>
              )}

              {/* Appointment History */}
              {selectedAppointment.appointmentCount > 1 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Appointment History ({selectedAppointment.appointmentCount} total)
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {selectedAppointment.allAppointments.map((apt, index) => (
                      <div
                        key={apt.id}
                        className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-semibold text-sm flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {formatDate(apt.appointment_date)}
                                </span>
                              </div>
                              {apt.appointment_time && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {apt.appointment_time}
                                  </span>
                                </div>
                              )}
                              {apt.product && (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full capitalize">
                                  {apt.product}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Call Date: {new Date(apt.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
