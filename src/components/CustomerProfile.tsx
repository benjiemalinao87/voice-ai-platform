import { User, MapPin, Phone, Home, DollarSign, Calendar, TrendingUp, Award, Building2, Briefcase } from 'lucide-react';

interface EnhancedData {
  identities?: Array<{
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    countyName?: string;
    latitude?: number;
    longitude?: number;
    gender?: string;
    age?: number;
    phones?: Array<{
      phone?: number;
      carrier?: string;
      phoneType?: number;
      workPhone?: boolean;
      activityStatus?: string;
      contactabilityScore?: string;
    }>;
    data?: {
      addressType?: string;
      incomeLevel?: string;
      creditRange?: string;
      householdIncome?: string;
      homeOwnership?: string;
      homePrice?: number;
      homeValue?: number;
      age?: number;
    };
    properties?: Array<{
      propertyType?: string;
      value?: number;
      estimatedValue?: number;
      yearBuilt?: number;
      bedrooms?: string;
      rooms?: string;
      saleDate?: string;
      saleAmount?: number;
    }>;
  }>;
}

interface CustomerProfileProps {
  enhancedData: EnhancedData | null;
  compact?: boolean;
}

export function CustomerProfile({ enhancedData, compact = false }: CustomerProfileProps) {
  if (!enhancedData || !enhancedData.identities || enhancedData.identities.length === 0) {
    return null;
  }

  const identity = enhancedData.identities[0];
  const data = identity.data || {};
  const property = identity.properties?.[0];
  const phone = identity.phones?.[0];

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPhone = (phoneNumber?: number) => {
    if (!phoneNumber) return 'N/A';
    const phoneStr = phoneNumber.toString();
    return `(${phoneStr.slice(0, 3)}) ${phoneStr.slice(3, 6)}-${phoneStr.slice(6)}`;
  };

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Customer Insights
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Name</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {identity.firstName} {identity.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Home Value</p>
            <p className="font-medium text-green-700 dark:text-green-400">
              {formatCurrency(property?.estimatedValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Income</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {data.householdIncome || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Credit</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {data.creditRange || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-4">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-white/20 rounded-lg">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {identity.firstName} {identity.lastName}
            </h3>
            <p className="text-sm text-blue-100">
              {data.age ? `${data.age} years old` : ''} • {identity.gender === 'M' ? 'Male' : identity.gender === 'F' ? 'Female' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Contact Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Contact Information
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Address</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {identity.address}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {identity.city}, {identity.state} {identity.zip}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Phone</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatPhone(phone?.phone)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {phone?.carrier}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Profile */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            Financial Profile
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-400 mb-1">Household Income</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-300">
                {data.householdIncome || 'N/A'}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Credit Score</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-300">
                {data.creditRange || 'N/A'}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">Home Ownership</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-300">
                {data.homeOwnership || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Property Information */}
        {property && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              Property Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Property Type</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {property.propertyType}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Year Built</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {property.yearBuilt}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bedrooms</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {property.bedrooms || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-400 mb-1">Estimated Value</p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-300">
                    {formatCurrency(property.estimatedValue)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Purchase Price</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(property.saleAmount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {property.saleDate ? new Date(property.saleDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lead Quality Indicators */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Lead Quality
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Contactability</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {phone?.contactabilityScore || 'N/A'}
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Activity</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {phone?.activityStatus || 'N/A'}
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">County</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {identity.countyName || 'N/A'}
              </p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Phone Type</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {phone?.workPhone ? 'Work' : 'Personal'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
