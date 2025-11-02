import { useState, useMemo } from 'react';

interface StackedBarChartProps {
  dates: string[];
  reasons: Record<string, number[]>; // reason -> values per date
  colors: Record<string, string>; // reason -> color
  height?: number;
  showLegend?: boolean;
}

export function StackedBarChart({
  dates,
  reasons,
  colors,
  height = 300,
  showLegend = true
}: StackedBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { reasonKeys, maxValue, totals, yAxisLabels } = useMemo(() => {
    if (dates.length === 0 || Object.keys(reasons).length === 0) {
      return { reasonKeys: [], maxValue: 0, totals: [], yAxisLabels: [] };
    }

    const reasonKeys = Object.keys(reasons);
    
    // Calculate totals for each date
    const totals = dates.map((_, dateIndex) => {
      return reasonKeys.reduce((sum, reason) => {
        return sum + (reasons[reason][dateIndex] || 0);
      }, 0);
    });

    const maxValue = Math.max(...totals, 1);
    const roundedMax = Math.ceil(maxValue / 5) * 5; // Round to nearest 5
    
    // Generate Y-axis labels
    const gridlineCount = 5;
    const gridlineStep = roundedMax / gridlineCount;
    const yAxisLabels = Array.from({ length: gridlineCount + 1 }, (_, i) => 
      Math.round(roundedMax - (i * gridlineStep))
    );

    return { reasonKeys, maxValue: roundedMax, totals, yAxisLabels };
  }, [dates, reasons]);

  if (dates.length === 0 || Object.keys(reasons).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  // Format date labels
  const formatDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full">
      {/* Legend */}
      {showLegend && reasonKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          {reasonKeys.map((reason) => (
            <div key={reason} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors[reason] || '#3b82f6' }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[200px]">
                {reason.length > 30 ? reason.substring(0, 30) + '...' : reason}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 font-medium pr-1" style={{ height: `${height}px` }}>
          {yAxisLabels.map((label, i) => (
            <span key={i} className="leading-none">{label}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          {/* Gridlines */}
          <div className="absolute inset-0" style={{ height: `${height}px` }}>
            {yAxisLabels.slice(1).map((_, i) => {
              const y = ((i + 1) / yAxisLabels.length) * height;
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700"
                  style={{ top: `${y}px` }}
                />
              );
            })}
          </div>

          {/* Bars */}
          <div
            className="relative flex items-end justify-around gap-2 px-2"
            style={{ height: `${height}px` }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {dates.map((date, dateIndex) => {
              const total = totals[dateIndex];
              const heightPercent = maxValue > 0 ? (total / maxValue) * 100 : 0;
              const isHovered = hoveredIndex === dateIndex;

              return (
                <div
                  key={dateIndex}
                  className="flex-1 flex flex-col items-center justify-end h-full max-w-[120px] relative group"
                  onMouseEnter={() => setHoveredIndex(dateIndex)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-20 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg shadow-xl animate-in fade-in duration-200"
                      style={{ transform: 'translateY(-100%)' }}
                    >
                      <div className="text-center font-semibold mb-2">
                        {formatDateLabel(date)}
                      </div>
                      {reasonKeys.map((reason) => {
                        const value = reasons[reason][dateIndex] || 0;
                        if (value === 0) return null;
                        return (
                          <div
                            key={reason}
                            className="flex items-center gap-2 mb-1 last:mb-0 whitespace-nowrap"
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: colors[reason] || '#3b82f6' }}
                            />
                            <span className="font-medium">
                              {reason.length > 25 ? reason.substring(0, 25) + '...' : reason}:
                            </span>
                            <span className="font-bold">{value}</span>
                          </div>
                        );
                      })}
                      <div
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"
                      />
                    </div>
                  )}

                  {/* Stacked bar segments */}
                  <div
                    className="w-full rounded-t-lg transition-all duration-300 cursor-pointer relative overflow-hidden"
                    style={{
                      height: `${heightPercent}%`,
                      minHeight: total > 0 ? '4px' : '0',
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    {reasonKeys.map((reason, reasonIndex) => {
                      const value = reasons[reason][dateIndex] || 0;
                      if (value === 0 || total === 0) return null;

                      const segmentHeight = (value / total) * 100;
                      const previousSegments = reasonKeys
                        .slice(0, reasonIndex)
                        .reduce((sum, r) => sum + (reasons[r][dateIndex] || 0), 0);
                      const bottomOffset = (previousSegments / total) * 100;

                      return (
                        <div
                          key={reason}
                          className="absolute left-0 right-0 transition-all duration-200"
                          style={{
                            height: `${segmentHeight}%`,
                            bottom: `${bottomOffset}%`,
                            backgroundColor: colors[reason] || '#3b82f6',
                            borderTop: reasonIndex > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                          }}
                        />
                      );
                    })}

                    {/* Shine effect on hover */}
                    {isHovered && (
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-50 transition-opacity duration-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-3 mt-3">
        <div className="w-[32px]" /> {/* Spacer for Y-axis */}
        <div className="flex-1 flex justify-around gap-2 px-2">
          {dates.map((date, index) => (
            <div
              key={index}
              className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-gray-400 max-w-[120px]"
              style={{
                transform: 'rotate(-45deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {formatDateLabel(date)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

