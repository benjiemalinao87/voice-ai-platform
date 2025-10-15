import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  showValues?: boolean;
  showGridlines?: boolean;
}

export function BarChart({ 
  data, 
  height = 240, 
  showValues = true, 
  showGridlines = true 
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const roundedMax = Math.ceil(maxValue / 100) * 100;
  const gridlineCount = 5;
  const gridlineStep = roundedMax / gridlineCount;

  return (
    <div className="w-full">
      <div className="flex gap-4">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between" style={{ height: `${height}px` }}>
          {Array.from({ length: gridlineCount + 1 }).map((_, i) => {
            const value = roundedMax - (i * gridlineStep);
            return (
              <div key={i} className="text-xs text-gray-500 dark:text-gray-400 pr-2">
                {Math.round(value)}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="flex-1">
          {/* Gridlines */}
          {showGridlines && (
            <div className="relative" style={{ height: `${height}px` }}>
              {Array.from({ length: gridlineCount + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-gray-200 dark:border-gray-700"
                  style={{ top: `${(i / gridlineCount) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Bars */}
          <div 
            className="relative flex items-end justify-around gap-4 px-2" 
            style={{ height: `${height}px`, marginTop: `-${height}px` }}
          >
            {data.map((item, index) => {
              const heightPercent = maxValue > 0 ? (item.value / roundedMax) * 100 : 0;
              const barColor = item.color || '#3b82f6';
              const isHovered = hoveredIndex === index;

              return (
                <div 
                  key={index} 
                  className="flex-1 flex flex-col items-center justify-end h-full max-w-[120px]"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg shadow-lg z-10 animate-in fade-in duration-200"
                         style={{ transform: 'translateY(-100%)' }}>
                      <div className="text-center">
                        <div className="font-semibold">{item.label}</div>
                        <div className="mt-1">{item.value.toLocaleString()} calls</div>
                      </div>
                      <div 
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"
                      />
                    </div>
                  )}

                  {/* Value label */}
                  {showValues && (
                    <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                      {item.value}
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-lg transition-all duration-300 cursor-pointer relative overflow-hidden group"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: barColor,
                      minHeight: item.value > 0 ? '8px' : '0',
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)',
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    {/* Shine effect on hover */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex gap-4 mt-3">
        <div className="w-[32px]" /> {/* Spacer for Y-axis */}
        <div className="flex-1 flex justify-around gap-4 px-2">
          {data.map((item, index) => (
            <div 
              key={index} 
              className="flex-1 text-center text-sm font-medium text-gray-600 dark:text-gray-400 max-w-[120px]"
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
