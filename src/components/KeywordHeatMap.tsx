import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface KeywordData {
  keyword: string;
  count: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  avg_sentiment: number;
}

interface KeywordHeatMapProps {
  keywords: KeywordData[];
}

export function KeywordHeatMap({ keywords }: KeywordHeatMapProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (keywords.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Keyword Sentiment Map
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400 text-sm">
          No keyword data available
        </div>
      </div>
    );
  }

  // Find max count for scaling
  const maxCount = Math.max(...keywords.map(k => k.count));

  // Get color based on sentiment score (-1 to 1)
  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) {
      // Positive: green gradient
      const intensity = Math.min(sentiment, 1);
      return `rgb(${Math.round(16 + (255 - 16) * (1 - intensity))}, ${Math.round(185 + (255 - 185) * (0.3 - intensity * 0.3))}, ${Math.round(129 + (255 - 129) * (1 - intensity))})`;
    } else if (sentiment < -0.3) {
      // Negative: red gradient
      const intensity = Math.min(Math.abs(sentiment), 1);
      return `rgb(${Math.round(239 + (255 - 239) * (1 - intensity))}, ${Math.round(68 + (255 - 68) * (1 - intensity))}, ${Math.round(68 + (255 - 68) * (1 - intensity))})`;
    } else {
      // Neutral: blue/gray
      return '#6b7280';
    }
  };

  // Get font size based on count (like a word cloud)
  const getFontSize = (count: number) => {
    const ratio = count / maxCount;
    const minSize = 0.875; // 14px
    const maxSize = 2.5; // 40px
    return minSize + (ratio * (maxSize - minSize));
  };

  // Get sentiment label
  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.3) return 'Positive';
    if (sentiment < -0.3) return 'Negative';
    return 'Neutral';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Keyword Sentiment Map
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Negative</span>
          </div>
        </div>
      </div>

      {/* Keyword Cloud */}
      <div className="flex flex-wrap items-center justify-center gap-4 p-8 min-h-[300px] bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        {keywords.map((keyword, index) => {
          const fontSize = getFontSize(keyword.count);
          const color = getSentimentColor(keyword.avg_sentiment);
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={index}
              className="relative cursor-pointer transition-all duration-300"
              style={{
                transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                zIndex: isHovered ? 10 : 1
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="font-semibold transition-all duration-300"
                style={{
                  fontSize: `${fontSize}rem`,
                  color: color,
                  textShadow: isHovered ? `0 0 20px ${color}40` : 'none',
                  filter: hoveredIndex !== null && !isHovered ? 'opacity(0.4)' : 'opacity(1)'
                }}
              >
                {keyword.keyword}
              </span>

              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-fadeIn">
                  <div className="space-y-1">
                    <div className="font-semibold border-b border-gray-700 dark:border-gray-600 pb-1">
                      {keyword.keyword}
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">Total:</span>
                      <span className="font-medium">{keyword.count} calls</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">Sentiment:</span>
                      <span className="font-medium">{getSentimentLabel(keyword.avg_sentiment)}</span>
                    </div>
                    <div className="pt-1 border-t border-gray-700 dark:border-gray-600 space-y-0.5">
                      <div className="flex justify-between gap-3 text-green-400">
                        <span>Positive:</span>
                        <span>{keyword.positive_count}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-gray-400">
                        <span>Neutral:</span>
                        <span>{keyword.neutral_count}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-red-400">
                        <span>Negative:</span>
                        <span>{keyword.negative_count}</span>
                      </div>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
              {keywords.filter(k => k.avg_sentiment > 0.3).length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Positive Keywords</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
              {keywords.filter(k => k.avg_sentiment >= -0.3 && k.avg_sentiment <= 0.3).length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Neutral Keywords</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {keywords.filter(k => k.avg_sentiment < -0.3).length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Negative Keywords</p>
          </div>
        </div>
      </div>
    </div>
  );
}
