import { useMemo, useState } from 'react';

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
  const [hoveredPoint, setHoveredPoint] = useState<{ seriesIndex: number; pointIndex: number } | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

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
  }, [series]);

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
              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      )}

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
            viewBox={`0 0 ${width} ${svgHeight}`}
            className="w-full"
            style={{ height: `${height}px` }}
            preserveAspectRatio="xMidYMid meet"
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
            {hoveredColumn !== null && seriesWithPaths[0]?.points[hoveredColumn] && (
              <line
                x1={seriesWithPaths[0].points[hoveredColumn].x}
                y1="20"
                x2={seriesWithPaths[0].points[hoveredColumn].x}
                y2="280"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-gray-400 dark:text-gray-600"
              />
            )}

            {/* Lines and points */}
            {seriesWithPaths.map((s, seriesIndex) => (
              <g key={seriesIndex}>
                {/* Line path */}
                <path
                  d={s.path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-200"
                  style={{
                    filter: hoveredColumn === null || hoveredPoint?.seriesIndex === seriesIndex
                      ? 'none'
                      : 'opacity(0.4)'
                  }}
                />

                {/* Data points */}
                {s.points.map((point, pointIndex) => {
                  const isHovered = hoveredPoint?.seriesIndex === seriesIndex && hoveredPoint?.pointIndex === pointIndex;
                  const isColumnHovered = hoveredColumn === pointIndex;
                  
                  return (
                    <g key={pointIndex}>
                      {/* Invisible hover area */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="12"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredPoint({ seriesIndex, pointIndex });
                          setHoveredColumn(pointIndex);
                        }}
                        onMouseLeave={() => {
                          setHoveredPoint(null);
                          setHoveredColumn(null);
                        }}
                      />
                      
                      {/* Visible point */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isHovered ? "5" : isColumnHovered ? "4" : "3"}
                        fill={s.color}
                        className="transition-all duration-200 pointer-events-none"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none'
                        }}
                      />
                      
                      {/* White stroke on hover */}
                      {isHovered && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          className="pointer-events-none"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>

          {/* Tooltip */}
          {hoveredPoint !== null && seriesWithPaths[hoveredPoint.seriesIndex]?.points[hoveredPoint.pointIndex] && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${(seriesWithPaths[hoveredPoint.seriesIndex].points[hoveredPoint.pointIndex].x / width) * 100}%`,
                top: `${(seriesWithPaths[hoveredPoint.seriesIndex].points[hoveredPoint.pointIndex].y / svgHeight) * 100}%`,
                transform: 'translate(-50%, -120%)'
              }}
            >
              <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg shadow-xl animate-in fade-in duration-200">
                <div className="text-xs font-semibold mb-1">
                  {seriesWithPaths[hoveredPoint.seriesIndex].points[hoveredPoint.pointIndex].label}
                </div>
                <div className="text-xs">
                  <span className="font-bold" style={{ color: seriesWithPaths[hoveredPoint.seriesIndex].color }}>
                    {seriesWithPaths[hoveredPoint.seriesIndex].name}:
                  </span>{' '}
                  <span className="font-semibold">
                    {seriesWithPaths[hoveredPoint.seriesIndex].points[hoveredPoint.pointIndex].value}
                  </span>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
              </div>
            </div>
          )}

          {/* Multi-value tooltip on column hover */}
          {hoveredColumn !== null && hoveredPoint === null && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${(seriesWithPaths[0].points[hoveredColumn].x / width) * 100}%`,
                top: '0',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-lg shadow-xl animate-in fade-in duration-200">
                <div className="text-xs font-semibold mb-2">
                  {seriesWithPaths[0].points[hoveredColumn].label}
                </div>
                {seriesWithPaths.map((s, idx) => (
                  <div key={idx} className="text-xs flex items-center gap-2 mb-1 last:mb-0">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-medium">{s.name}:</span>
                    <span className="font-bold">{s.points[hoveredColumn].value}</span>
                  </div>
                ))}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
              </div>
            </div>
          )}

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
            {allLabels.map((label, i) => (
              <span 
                key={i} 
                className={`text-center transition-colors ${hoveredColumn === i ? 'text-gray-900 dark:text-gray-100 font-semibold' : ''}`}
                style={{ width: `${100 / allLabels.length}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
