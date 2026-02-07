import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TextArea } from './ui/Input';
import { openaiService } from '../services/ai/openaiService';
import type { Beat, StoryBible, BeatNumber, EmotionalTone, EmotionalDataPoint } from '../types/story';

interface BeatCardProps {
  beat: Beat;
  storyBible: StoryBible;
  previousBeats: Beat[];
  onUpdate: (beat: Partial<Beat>) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function BeatCard({
  beat,
  storyBible,
  previousBeats,
  onUpdate,
  isExpanded,
  onToggleExpand,
}: BeatCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(beat.summary);
  const [loading, setLoading] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);

  const handleWriteIt = () => {
    setIsEditing(true);
    setEditValue(beat.summary);
  };

  const handleSave = () => {
    onUpdate({
      summary: editValue,
      userWritten: true,
      status: editValue.trim() ? 'complete' : 'empty',
      metadata: {
        ...beat.metadata,
        updatedAt: new Date().toISOString(),
        source: 'user',
      },
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(beat.summary);
    setIsEditing(false);
  };

  const handleSurpriseMe = async () => {
    setLoading(true);
    try {
      const suggestions = await openaiService.generateBeatWithContext(
        beat.number as BeatNumber,
        beat.title,
        storyBible,
        previousBeats
      );

      if (suggestions.length > 0) {
        setAlternatives(suggestions);
        setShowAlternatives(true);
      }
    } catch (error) {
      console.error('Error generating beat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlternative = async (alternative: string, index: number) => {
    const tones: EmotionalTone[] = ['neutral', 'negative', 'positive', 'wildCard'];
    const selectedTone = tones[index];

    // If we're in editing mode, populate the edit field instead of saving directly
    if (isEditing) {
      setEditValue(alternative);
      setShowAlternatives(false);
      setAlternatives([]);
      return;
    }

    // Calculate emotional intensity for this beat
    try {
      const emotionalMetrics = await openaiService.calculateEmotionalIntensity(
        alternative,
        selectedTone,
        beat.number as BeatNumber,
        beat.title
      );

      const emotionalData: EmotionalDataPoint = {
        beatNumber: beat.number as BeatNumber,
        intensity: emotionalMetrics.intensity,
        tension: emotionalMetrics.tension,
        tone: selectedTone,
        timestamp: new Date().toISOString(),
      };

      onUpdate({
        summary: alternative,
        userWritten: false,
        status: 'complete',
        selectedTone,
        emotionalData,
        metadata: {
          ...beat.metadata,
          updatedAt: new Date().toISOString(),
          source: 'ai-with-context',
        },
        alternativeVersions: [...(beat.alternativeVersions || []), alternative],
      });
    } catch (error) {
      console.error('Failed to calculate emotional intensity:', error);
      // Still update beat, just without emotional data
      onUpdate({
        summary: alternative,
        userWritten: false,
        status: 'complete',
        selectedTone,
        metadata: {
          ...beat.metadata,
          updatedAt: new Date().toISOString(),
          source: 'ai-with-context',
        },
        alternativeVersions: [...(beat.alternativeVersions || []), alternative],
      });
    }

    setShowAlternatives(false);
    setAlternatives([]);
  };

  const handleRegenerate = async () => {
    if (!beat.summary) return;

    setLoading(true);
    try {
      const suggestions = await openaiService.regenerateBeat(
        beat.number as BeatNumber,
        beat.title,
        storyBible,
        previousBeats
      );

      if (suggestions.length > 0) {
        setAlternatives(suggestions);
        setShowAlternatives(true);
      }
    } catch (error) {
      console.error('Error regenerating beat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onUpdate({
      summary: '',
      status: 'empty',
      metadata: {
        ...beat.metadata,
        updatedAt: new Date().toISOString(),
      },
    });
    setIsEditing(false);
  };

  const handleToggleLock = () => {
    onUpdate({ locked: !beat.locked });
  };

  const handleSkip = () => {
    onUpdate({ status: 'incomplete' });
    onToggleExpand();
  };

  const statusColor = {
    empty: 'border-slate-600',
    incomplete: 'border-yellow-500/50',
    complete: 'border-green-500/50',
  };

  return (
    <Card
      className={`${statusColor[beat.status]} border-2 transition-all ${
        isExpanded ? 'ring-2 ring-cosmic-500/30' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold text-cosmic-400">Beat {beat.number}</span>
            {beat.locked && <span className="text-xs">🔒</span>}
            {beat.status === 'complete' && !beat.locked && <span className="text-xs">✓</span>}
            {beat.status === 'incomplete' && <span className="text-xs">⏭</span>}
          </div>
          {!isExpanded && beat.summary && (
            <p className="text-sm text-slate-300 mt-1 line-clamp-2">{beat.summary}</p>
          )}
          {!isExpanded && !beat.summary && (
            <p className="text-sm text-slate-500 italic mt-1">{beat.title}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="flex-shrink-0"
        >
          {isExpanded ? '▲' : '▼'}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {showAlternatives ? (
            <div className="space-y-3">
              <h4 className="font-medium text-cosmic-300">Choose a version:</h4>
              {alternatives.map((alt, idx) => {
                const labels = ['Neutral', 'Negative', 'Positive', 'Wild Card'];
                const colors = ['bg-slate-600', 'bg-red-600', 'bg-green-600', 'bg-purple-600'];
                const label = labels[idx] || `Option ${idx + 1}`;
                const colorClass = colors[idx] || 'bg-cosmic-600';

                return (
                  <Card
                    key={idx}
                    hover
                    onClick={() => handleSelectAlternative(alt, idx)}
                    className="cursor-pointer p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`${colorClass} text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0`}>
                        {label}
                      </span>
                      <p className="text-sm flex-1">{alt}</p>
                    </div>
                  </Card>
                );
              })}
              <Button
                variant="ghost"
                onClick={() => setShowAlternatives(false)}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              <TextArea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                placeholder="Write what happens in this beat..."
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!editValue.trim()}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSurpriseMe}
                  disabled={loading}
                >
                  {loading ? 'Generating...' : '🤖 AI Help (Show 4 Options)'}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : beat.summary ? (
            <div className="space-y-3">
              <p className="text-slate-200">{beat.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleWriteIt} disabled={beat.locked}>
                  ✏️ Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={beat.locked || loading}
                >
                  🔄 Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={beat.locked}
                >
                  🧹 Clear
                </Button>
                <Button size="sm" variant="ghost" onClick={handleToggleLock}>
                  {beat.locked ? '🔓 Unlock' : '🔒 Lock'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm italic">This beat is empty</p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleWriteIt} fullWidth>
                  ✏️ Write It
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSurpriseMe}
                  disabled={loading}
                  fullWidth
                >
                  {loading ? 'Generating...' : '✨ Give me an idea! (AI)'}
                </Button>
                <Button variant="ghost" onClick={handleSkip} fullWidth>
                  ⏭ Skip for Now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
