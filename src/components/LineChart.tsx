import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
}

export function LineChart({ data, height = 200, color = '#3b82f6', showGrid = true }: LineChartProps) {
  const { points, max, min, path } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], max: 0, min: 0, path: '' };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const width = 100;
    const padding = 10;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding + ((max - d.value) / range) * chartHeight;
      return { x, y, value: d.value, label: d.label };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { points, max, min, path };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 100 100"
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        {showGrid && (
          <g className="opacity-20">
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="10"
                y1={y}
                x2="90"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-gray-400 dark:text-gray-600"
              />
            ))}
          </g>
        )}

        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
