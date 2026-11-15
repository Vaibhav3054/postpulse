"use client";

import React, { useState } from "react";

// Platform Color Palette
export const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#E4405F",
  FACEBOOK: "#1877F2",
  YOUTUBE: "#FF0000",
  LINKEDIN: "#0A66C2",
};

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
  size?: number;
  innerRadiusRatio?: number;
  title?: string;
}

export function PerformancePieChart({
  data,
  size = 180,
  innerRadiusRatio = 0.65,
  title,
}: PieChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // If no data or 0 total, render clean empty state ring
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-3">
        {title && <div className="text-xs font-semibold text-zinc-400 mb-2">{title}</div>}
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size / 2) * 0.8}
              fill="none"
              stroke="currentColor"
              className="text-zinc-200 dark:text-zinc-800"
              strokeWidth={(size / 2) * (1 - innerRadiusRatio)}
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-xs font-medium text-zinc-400">0</span>
            <div className="text-[10px] text-zinc-500">Live Data</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">Awaiting live metrics</div>
      </div>
    );
  }

  // Calculate SVG Pie/Donut paths
  let cumulativeAngle = -90; // Start at top
  const radius = size / 2;
  const innerRadius = radius * innerRadiusRatio;

  const slices = data
    .filter((d) => d.value > 0)
    .map((item, idx) => {
      const percentage = (item.value / total) * 100;
      const angle = (item.value / total) * 360;

      const startAngleRad = (cumulativeAngle * Math.PI) / 180;
      const endAngleRad = ((cumulativeAngle + angle) * Math.PI) / 180;

      // Arc coordinates
      const x1 = radius + radius * Math.cos(startAngleRad);
      const y1 = radius + radius * Math.sin(startAngleRad);
      const x2 = radius + radius * Math.cos(endAngleRad);
      const y2 = radius + radius * Math.sin(endAngleRad);

      const ix1 = radius + innerRadius * Math.cos(endAngleRad);
      const iy1 = radius + innerRadius * Math.sin(endAngleRad);
      const ix2 = radius + innerRadius * Math.cos(startAngleRad);
      const iy2 = radius + innerRadius * Math.sin(startAngleRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      cumulativeAngle += angle;

      return {
        ...item,
        pathData,
        percentage,
        idx,
      };
    });

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="flex flex-col items-center">
      {title && (
        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
          {title}
        </div>
      )}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice) => (
            <path
              key={slice.label}
              d={slice.pathData}
              fill={slice.color}
              className="transition-transform duration-200 cursor-pointer hover:opacity-90"
              style={{
                transformOrigin: "center",
                transform: hoveredIdx === slice.idx ? "scale(1.04)" : "scale(1)",
              }}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center Tooltip/Summary */}
        <div className="absolute text-center pointer-events-none">
          <div className="text-sm font-bold text-zinc-900 dark:text-white">
            {activeItem ? activeItem.value.toLocaleString() : total.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {activeItem ? activeItem.label : "Total"}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-2.5 mt-3 text-[11px]">
        {data.map((item, idx) => (
          <div
            key={item.label}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
              hoveredIdx === idx ? "bg-zinc-100 dark:bg-zinc-800 font-semibold" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span className="font-mono text-zinc-400 text-[10px]">
              {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BarItem {
  label: string;
  value: number;
  color?: string;
  helper?: string;
}

interface BarChartProps {
  data: BarItem[];
  title?: string;
  height?: number;
}

export function PerformanceBarChart({ data, title, height = 150 }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full flex flex-col justify-between">
      {title && (
        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
          {title}
        </div>
      )}

      <div className="flex items-end justify-around gap-2 pt-6 pb-2 border-b border-zinc-200 dark:border-zinc-800" style={{ height }}>
        {data.map((bar) => {
          const heightPercent = Math.max(Math.round((bar.value / maxValue) * 100), bar.value > 0 ? 8 : 2);
          const barColor = bar.color || "#6366F1";

          return (
            <div key={bar.label} className="flex-1 flex flex-col items-center h-full justify-end group">
              <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 mb-1 group-hover:scale-110 transition-transform">
                {bar.value.toLocaleString()}
              </span>

              <div className="w-full max-w-[36px] bg-zinc-100 dark:bg-zinc-800 rounded-t-md overflow-hidden flex items-end h-full">
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>

              <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-2 truncate max-w-[50px] text-center">
                {bar.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
