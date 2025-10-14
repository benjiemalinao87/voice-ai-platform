interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  showValues?: boolean;
}

export function BarChart({ data, height = 200, showValues = true }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const barColor = item.color || '#3b82f6';

          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
                {showValues && (
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {item.value}
                  </span>
                )}
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: barColor,
                    minHeight: item.value > 0 ? '4px' : '0'
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 text-center line-clamp-2">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
