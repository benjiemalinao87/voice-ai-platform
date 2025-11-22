import { useMemo } from 'react';

interface FunnelChartProps {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  height?: number;
}

export function FunnelChart({ data, height = 400 }: FunnelChartProps) {
  // Sort data by value descending (largest at top)
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.value - a.value);
  }, [data]);

  const maxValue = sortedData[0]?.value || 1;
  const totalCalls = sortedData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full overflow-x-hidden" style={{ height }}>
      <div className="flex flex-col justify-start items-center w-full gap-1 py-4">
        {sortedData.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const percentageOfTotal = totalCalls > 0 ? (item.value / totalCalls) * 100 : 0;

          // Calculate width - funnel effect (narrower as we go down)
          // Ensure minimum width of 30% for visibility
          const widthPercentage = Math.max(percentage * 0.9, 30);

          return (
            <div
              key={item.label}
              className="w-full flex flex-col items-center px-4"
              style={{
                maxWidth: `${widthPercentage}%`,
                transition: 'all 0.3s ease'
              }}
            >
              {/* Bar */}
              <div
                className="w-full rounded-md relative group cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                style={{
                  backgroundColor: item.color,
                  height: '50px',
                  minHeight: '50px'
                }}
              >
                {/* Label and value */}
                <div className="absolute inset-0 flex items-center justify-center px-3">
                  <div className="text-center w-full">
                    <p className="text-xs font-semibold text-white truncate max-w-full">
                      {item.label}
                    </p>
                    <p className="text-xs text-white/90 mt-0.5">
                      {item.value} calls ({percentageOfTotal.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-gray-300">Count: {item.value}</div>
                    <div className="text-gray-300">Percentage: {percentageOfTotal.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Connector line (except for last item) */}
              {index < sortedData.length - 1 && (
                <div className="h-1 w-px border-l border-dashed border-gray-300 dark:border-gray-600" />
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 px-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Calls</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCalls}</span>
        </div>
      </div>
    </div>
  );
}
