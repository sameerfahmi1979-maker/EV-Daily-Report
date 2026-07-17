import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface SummaryCard {
  label: string;
  value: string | number;
  format?: 'number' | 'currency' | 'percent' | 'string';
  icon?: React.ElementType;
  color?: string;
  change?: number; // percentage change (positive = green, negative = red)
}

interface ReportSummaryCardsProps {
  cards: SummaryCard[];
}

function formatValue(card: SummaryCard): string {
  const val = card.value;
  if (card.format === 'currency' && typeof val === 'number') {
    return `${val.toFixed(3)} JOD`;
  }
  if (card.format === 'percent' && typeof val === 'number') {
    return `${val.toFixed(1)}%`;
  }
  if (card.format === 'number' && typeof val === 'number') {
    return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(val % 1 === 0 ? 0 : 2);
  }
  return String(val);
}

const defaultColors = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

export default function ReportSummaryCards({ cards }: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const gradient = card.color || defaultColors[idx % defaultColors.length];

        return (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`} />
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white truncate">
                  {formatValue(card)}
                </p>
              </div>
              {Icon && (
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} bg-opacity-10`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            {card.change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {card.change > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : card.change < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
                <span
                  className={`text-xs font-medium ${
                    card.change > 0
                      ? 'text-green-600 dark:text-green-400'
                      : card.change < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {card.change > 0 ? '+' : ''}{card.change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
