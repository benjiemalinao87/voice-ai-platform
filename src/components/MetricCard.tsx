import { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, iconColor = 'text-blue-600' }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Extract the color value from iconColor class
  const getColorValue = (colorClass: string) => {
    const colorMap: Record<string, string> = {
      'text-blue-600': '#2563eb',
      'text-green-600': '#16a34a',
      'text-orange-600': '#ea580c',
      'text-slate-600': '#475569',
      'text-emerald-600': '#059669',
      'text-purple-600': '#9333ea',
      'text-red-600': '#dc2626',
    };
    return colorMap[colorClass] || '#2563eb';
  };

  const colorValue = getColorValue(iconColor);

  return (
    <div 
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative"
      style={{
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 12px 24px -4px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.08)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${colorValue}08 0%, transparent 50%)`,
        }}
      />

      {/* Top border accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
        style={{
          background: colorValue,
          transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
        }}
      />

      <div className="flex items-start justify-between relative">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
            {title}
          </p>
          <p 
            className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-all duration-300"
            style={{
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: 'left',
            }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-3 flex items-center gap-1">
              <span className={`text-sm font-bold px-2 py-1 rounded-md ${
                trend.isPositive 
                  ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30' 
                  : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
              }`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">vs last period</span>
            </div>
          )}
        </div>
        
        {/* Icon container */}
        <div 
          className="relative p-3 rounded-xl transition-all duration-300"
          style={{
            backgroundColor: isHovered ? colorValue : 'rgb(249 250 251)',
            transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
            boxShadow: isHovered ? `0 8px 16px -4px ${colorValue}40` : 'none',
          }}
        >
          <Icon 
            className="w-6 h-6 transition-all duration-300" 
            style={{
              color: isHovered ? 'white' : colorValue,
            }}
          />
          
          {/* Pulse effect */}
          {isHovered && (
            <div 
              className="absolute inset-0 rounded-xl animate-ping opacity-30"
              style={{ backgroundColor: colorValue }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
