import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface DataSeries {
  name: string;
  data: DataPoint[];
  color: string;
}

interface MultiLineChartProps {
  series: DataSeries[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function MultiLineChart({
  series,
  height = 200,
  showGrid = true,
  showLegend = true
}: MultiLineChartProps) {
  const { allLabels, maxValue, minValue, yAxisLabels, seriesWithPaths, width, svgHeight } = useMemo(() => {
    if (series.length === 0 || series[0].data.length === 0) {
      return { allLabels: [], maxValue: 0, minValue: 0, yAxisLabels: [], seriesWithPaths: [], width: 600, svgHeight: 300 };
    }

    const allLabels = series[0].data.map(d => d.label);
    const allValues = series.flatMap(s => s.data.map(d => d.value));
    const maxValue = Math.max(...allValues);
    const minValue = 0; // Start from 0 for better visualization
    const range = maxValue - minValue || 1;

    // Calculate nice Y-axis labels
    const step = Math.ceil(maxValue / 4 / 10) * 10; // Round to nearest 10
    const yAxisLabels = [0, step, step * 2, step * 3, step * 4];

    const width = 600;
    const svgHeight = 300;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;
    const chartHeight = svgHeight - paddingTop - paddingBottom;
    const chartWidth = width - paddingLeft - paddingRight;

    const seriesWithPaths = series.map(s => {
      const points = s.data.map((d, i) => {
        const x = paddingLeft + (i / (s.data.length - 1 || 1)) * chartWidth;
        const y = paddingTop + ((maxValue - d.value) / range) * chartHeight;
        return { x, y, value: d.value, label: d.label };
      });

      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        ...s,
        points,
        path
      };
    });

    return { allLabels, maxValue, minValue, yAxisLabels, seriesWithPaths, width, svgHeight };
  }, [series, height]);

  if (series.length === 0 || series[0].data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {showLegend && (
        <div className="flex items-center justify-center gap-6 mb-4">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400" style={{ height: `${height}px` }}>
          {yAxisLabels.slice().reverse().map((label, i) => (
            <span key={i} className="leading-none">{label}</span>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1">
          <svg
            viewBox={`0 0 ${width} ${svgHeight}`}
            className="w-full"
            style={{ height: `${height}px` }}
            preserveAspectRatio="xMidYMid meet"
          >
            {showGrid && (
              <g className="opacity-10">
                {yAxisLabels.slice(1).map((label, i) => {
                  const y = 20 + ((yAxisLabels.length - 1 - i - 1) / (yAxisLabels.length - 1)) * 260;
                  return (
                    <line
                      key={i}
                      x1="40"
                      y1={y}
                      x2="580"
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-gray-400 dark:text-gray-600"
                    />
                  );
                })}
              </g>
            )}

            {seriesWithPaths.map((s, seriesIndex) => (
              <g key={seriesIndex}>
                <path
                  d={s.path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {s.points.map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    fill={s.color}
                  />
                ))}
              </g>
            ))}
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-2 text-xs text-gray-500 dark:text-gray-400">
            {allLabels.map((label, i) => (
              <span key={i} className="text-center" style={{ width: `${100 / allLabels.length}%` }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
