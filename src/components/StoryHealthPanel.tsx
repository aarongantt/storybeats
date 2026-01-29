import React from 'react';
import { Card } from './ui/Card';
import type { StoryHealth } from '../types/story';

interface StoryHealthPanelProps {
  health: StoryHealth;
  className?: string;
}

export function StoryHealthPanel({ health, className = '' }: StoryHealthPanelProps) {
  const getHealthColor = (value: number) => {
    if (value >= 7) return 'text-green-500';
    if (value >= 4) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBarColor = (value: number) => {
    if (value >= 7) return 'bg-green-500';
    if (value >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`${className} bg-slate-800/60`}>
      <h3 className="text-lg font-semibold text-cosmic-300 mb-4">
        Health of Your Story
      </h3>

      <div className="space-y-4">
        {/* Overall Tension */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-slate-300">Overall Tension</span>
            <span className={`text-sm font-bold ${getHealthColor(health.overallTension)}`}>
              {health.overallTension.toFixed(1)}/10
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`${getHealthBarColor(health.overallTension)} h-2 rounded-full transition-all`}
              style={{ width: `${(health.overallTension / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Emotional Variety */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-slate-300">Emotional Variety</span>
            <span className={`text-sm font-bold ${getHealthColor(health.emotionalVariety)}`}>
              {health.emotionalVariety.toFixed(1)}/10
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`${getHealthBarColor(health.emotionalVariety)} h-2 rounded-full transition-all`}
              style={{ width: `${(health.emotionalVariety / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Arc Consistency */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-slate-300">Arc Consistency</span>
            <span className={`text-sm font-bold ${getHealthColor(health.arcConsistency)}`}>
              {health.arcConsistency.toFixed(1)}/10
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`${getHealthBarColor(health.arcConsistency)} h-2 rounded-full transition-all`}
              style={{ width: `${(health.arcConsistency / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Structural Checks */}
        <div className="pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <span className={health.hasProperBeginning ? 'text-green-500' : 'text-red-500'}>
              {health.hasProperBeginning ? '✓' : '✗'}
            </span>
            <span className="text-slate-300">Proper beginning (meets main character)</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <span className={health.hasClimacticMoment ? 'text-green-500' : 'text-red-500'}>
              {health.hasClimacticMoment ? '✓' : '✗'}
            </span>
            <span className="text-slate-300">Has climactic moment</span>
          </div>
        </div>

        {/* Recommendations */}
        {health.recommendations && health.recommendations.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-cosmic-400 mb-2">Recommendations:</h4>
            <ul className="space-y-1">
              {health.recommendations.map((rec, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-cosmic-500">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
