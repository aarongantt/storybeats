import React from 'react';
import type { Beat } from '../types/story';

interface StoryHeartbeatProps {
  beats: Beat[];
  onBeatClick: (beatNumber: number) => void;
  highlightedBeat?: number;
  className?: string;
}

export function StoryHeartbeat({ beats, onBeatClick, highlightedBeat, className = '' }: StoryHeartbeatProps) {
  const width = 1000;
  const height = 300;
  const padding = 50;

  // Extract emotional data points
  const dataPoints = beats
    .filter(b => b.emotionalData)
    .map(b => ({
      beatNumber: b.number,
      x: padding + ((b.number - 1) / 11) * (width - 2 * padding),
      y: height / 2 - ((b.emotionalData!.intensity / 10) * (height / 2 - padding)),
      intensity: b.emotionalData!.intensity,
      tension: b.emotionalData!.tension,
      tone: b.selectedTone || 'neutral',
      beat: b,
    }));

  // Build SVG path
  const pathD = dataPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  // Color for line based on average intensity
  const avgIntensity = dataPoints.reduce((sum, p) => sum + p.intensity, 0) / (dataPoints.length || 1);
  const getLineColor = () => {
    if (avgIntensity > 3) return '#22c55e'; // green
    if (avgIntensity < -3) return '#ef4444'; // red
    return '#eab308'; // yellow
  };

  // Dot color based on tone
  const getDotColor = (tone: string) => {
    switch (tone) {
      case 'positive': return '#22c55e';
      case 'negative': return '#ef4444';
      case 'wildCard': return '#a855f7';
      default: return '#64748b'; // slate
    }
  };

  if (dataPoints.length === 0) {
    return (
      <div className={`story-heartbeat bg-slate-800/40 rounded-xl p-6 border border-white/10 ${className}`}>
        <h3 className="text-lg font-semibold text-cosmic-300 mb-4">Story Heartbeat</h3>
        <div className="text-center py-8 text-slate-400 text-sm">
          Complete beats with emotional tones to see your story's heartbeat
        </div>
      </div>
    );
  }

  return (
    <div className={`story-heartbeat bg-slate-800/40 rounded-xl p-6 border border-white/10 ${className}`}>
      <h3 className="text-lg font-semibold text-cosmic-300 mb-4">Story Heartbeat</h3>

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Y-axis (intensity scale) */}
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#475569"
          strokeWidth={2}
        />

        {/* X-axis (neutral line) */}
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="5,5"
        />

        {/* Y-axis labels */}
        <text x={padding - 30} y={padding + 5} fill="#94a3b8" fontSize={12}>+10</text>
        <text x={padding - 20} y={height / 2 + 5} fill="#94a3b8" fontSize={12}>0</text>
        <text x={padding - 30} y={height - padding + 5} fill="#94a3b8" fontSize={12}>-10</text>

        {/* Beat number labels */}
        {Array.from({ length: 12 }, (_, i) => {
          const x = padding + (i / 11) * (width - 2 * padding);
          return (
            <text
              key={i}
              x={x}
              y={height - padding + 25}
              fill="#94a3b8"
              fontSize={11}
              textAnchor="middle"
            >
              {i + 1}
            </text>
          );
        })}

        {/* Emotional arc line */}
        {dataPoints.length > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke={getLineColor()}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data point dots */}
        {dataPoints.map(p => (
          <g key={p.beatNumber}>
            {/* Tension ring (larger tension = larger ring) */}
            <circle
              cx={p.x}
              cy={p.y}
              r={8 + (p.tension / 2)}
              fill="none"
              stroke={getDotColor(p.tone)}
              strokeWidth={2}
              opacity={0.3}
            />

            {/* Main dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.beatNumber === highlightedBeat ? 8 : 6}
              fill={getDotColor(p.tone)}
              stroke="#fff"
              strokeWidth={2}
              className="cursor-pointer hover:scale-110 transition-transform"
              onClick={() => onBeatClick(p.beatNumber)}
            />

            {/* Wild card icon */}
            {p.tone === 'wildCard' && (
              <text
                x={p.x}
                y={p.y + 4}
                fill="#fff"
                fontSize={10}
                textAnchor="middle"
                pointerEvents="none"
              >
                ✦
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-slate-400 justify-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span>Negative</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span>Positive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-600"></div>
          <span>Wild Card</span>
        </div>
      </div>
    </div>
  );
}
