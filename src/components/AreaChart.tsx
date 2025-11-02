import { useState, useMemo } from 'react';

interface AreaChartProps {
  labels: string[];
  data: number[];
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export function AreaChart({
  labels,
  data,
  color = '#06b6d4',
  height = 300,
  showGrid = true,
  showTooltip = true
}: AreaChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { points, path, areaPath, maxValue, minValue, yAxisLabels } = useMemo(() => {
    if (data.length === 0 || labels.length === 0) {
      return {
        points: [],
        path: '',
        areaPath: '',
        maxValue: 0,
        minValue: 0,
        yAxisLabels: []
      };
    }

    const maxValue = Math.max(...data, 1);
    const minValue = 0;
    const range = maxValue - minValue || 1;

    // Calculate nice Y-axis labels
    const step = Math.ceil(maxValue / 4 / 0.5) * 0.5; // Round to nearest 0.5
    const yAxisLabels = [0, step, step * 2, step * 3, step * 4].filter(v => v <= maxValue * 1.1);

    const width = 600;
    const svgHeight = 300;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;
    const chartHeight = svgHeight - paddingTop - paddingBottom;
    const chartWidth = width - paddingLeft - paddingRight;

    const points = data.map((value, i) => {
      const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
      const y = paddingTop + ((maxValue - value) / range) * chartHeight;
      return { x, y, value, label: labels[i] };
    });

    // Create line path
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Create area path (line + bottom closure)
    const firstX = points[0]?.x || paddingLeft;
    const lastX = points[points.length - 1]?.x || paddingLeft + chartWidth;
    const bottomY = paddingTop + chartHeight;
    const areaPath = `${path} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { points, path, areaPath, maxValue, minValue, yAxisLabels, width, svgHeight };
  }, [data, labels]);

  if (data.length === 0 || labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        No data available
      </div>
    );
  }

  // Format label for display
  const formatLabel = (label: string) => {
    try {
      // Try to parse as date
      if (label.includes('-') || label.includes(':')) {
        const date = new Date(label);
        if (!isNaN(date.getTime())) {
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const day = date.getDate();
          const hour = date.getHours();
          const minute = date.getMinutes();
          return `${month} ${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
      }
      return label;
    } catch {
      return label;
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-3">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 font-medium pr-1" style={{ height: `${height}px` }}>
          {yAxisLabels.slice().reverse().map((label, i) => (
            <span key={i} className="leading-none">{label}</span>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 relative">
          <svg
            viewBox={`0 0 ${600} ${300}`}
            className="w-full"
            style={{ height: `${height}px` }}
            preserveAspectRatio="xMidYMid meet"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid lines */}
            {showGrid && (
              <g>
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
                      strokeWidth="1.5"
                      className="text-gray-300 dark:text-gray-600"
                    />
                  );
                })}
              </g>
            )}

            {/* Vertical line on hover */}
            {hoveredIndex !== null && points[hoveredIndex] && (
              <line
                x1={points[hoveredIndex].x}
                y1="20"
                x2={points[hoveredIndex].x}
                y2="280"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-gray-400 dark:text-gray-600"
              />
            )}

            {/* Area */}
            <path
              d={areaPath}
              fill={color}
              fillOpacity="0.3"
              className="transition-opacity duration-200"
            />

            {/* Line */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-200"
            />

            {/* Data points */}
            {points.map((point, pointIndex) => {
              const isHovered = hoveredIndex === pointIndex;

              return (
                <g key={pointIndex}>
                  {/* Invisible hover area */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="18"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(pointIndex)}
                  />

                  {/* Visible point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? "6" : "4"}
                    fill={color}
                    className="transition-all duration-200 pointer-events-none"
                    style={{
                      filter: isHovered
                        ? 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))'
                        : 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                    }}
                  />

                  {/* White stroke on hover */}
                  {isHovered && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {showTooltip && hoveredIndex !== null && points[hoveredIndex] && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${(points[hoveredIndex].x / 600) * 100}%`,
                top: `${(points[hoveredIndex].y / 300) * 100}%`,
                transform: 'translate(-50%, -120%)'
              }}
            >
              <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg shadow-xl animate-in fade-in duration-200">
                <div className="text-xs font-semibold mb-1">
                  {formatLabel(points[hoveredIndex].label)}
                </div>
                <div className="text-xs">
                  <span className="font-bold" style={{ color }}>
                    concurrency
                  </span>{' '}
                  <span className="font-semibold">
                    {points[hoveredIndex].value}
                  </span>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
              </div>
            </div>
          )}

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
            {labels.map((label, i) => (
              <span
                key={i}
                className={`text-center transition-colors ${
                  hoveredIndex === i ? 'text-gray-900 dark:text-gray-100 font-semibold' : ''
                }`}
                style={{ width: `${100 / labels.length}%` }}
              >
                {formatLabel(label).split(' ').slice(0, 2).join(' ')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

