import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DataPoint[];
  size?: number;
  innerSize?: number;
  showLegend?: boolean;
}

export function DonutChart({ data, size = 200, innerSize = 70, showLegend = true }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  const radius = (size - 20) / 2;
  const innerRadius = innerSize / 2;
  const center = size / 2;
  const strokeWidth = 8;

  let currentAngle = -90;

  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    // Handle edge case: if angle is very close to 360, make it slightly less to render properly
    const adjustedAngle = angle >= 359.99 ? 359.99 : angle;
    const adjustedEndRad = (startAngle + adjustedAngle) * Math.PI / 180;
    const adjustedX2 = center + radius * Math.cos(adjustedEndRad);
    const adjustedY2 = center + radius * Math.sin(adjustedEndRad);
    const adjustedX3 = center + innerRadius * Math.cos(adjustedEndRad);
    const adjustedY3 = center + innerRadius * Math.sin(adjustedEndRad);

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${adjustedX2} ${adjustedY2}`,
      `L ${adjustedX3} ${adjustedY3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    return {
      ...item,
      path,
      percentage
    };
  });

  return (
    <div className="flex items-center justify-center gap-8">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Donut segments */}
        <svg width={size} height={size} className="relative">
          {segments.map((segment, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <g key={index}>
                <path
                  d={segment.path}
                  fill={segment.color}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: isHovered 
                      ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.25)) brightness(1.15)' 
                      : hoveredIndex !== null 
                      ? 'opacity(0.4)' 
                      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))',
                    transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Center content with white background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-full p-6 shadow-inner">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {hoveredIndex !== null ? segments[hoveredIndex].value : total}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                {hoveredIndex !== null ? segments[hoveredIndex].label : 'Total'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-col gap-3">
          {segments.map((segment, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <div 
                key={index} 
                className={`flex items-center gap-3 transition-all duration-200 cursor-pointer ${
                  isHovered ? 'scale-105' : hoveredIndex !== null ? 'opacity-50' : ''
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className="w-3 h-3 rounded-sm transition-all duration-200"
                  style={{ 
                    backgroundColor: segment.color,
                    boxShadow: isHovered ? `0 0 8px ${segment.color}` : 'none',
                  }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">
                  {segment.label}
                </span>
                <span className={`text-sm font-bold text-gray-900 dark:text-gray-100 ml-auto ${
                  isHovered ? 'text-base' : ''
                }`}>
                  {segment.percentage.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
