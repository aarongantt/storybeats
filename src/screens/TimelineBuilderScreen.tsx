import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { BeatCard } from '../components/BeatCard';
import { StoryHeartbeat } from '../components/StoryHeartbeat';
import { StoryHealthPanel } from '../components/StoryHealthPanel';
import { openaiService } from '../services/ai/openaiService';
import { calculateStoryHealth } from '../utils/storyHealth';
import type { Beat, StoryHealth } from '../types/story';

export default function TimelineBuilderScreen() {
  const { state, dispatch } = useProject();
  const [expandedBeat, setExpandedBeat] = useState<number | null>(1);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [storyHealth, setStoryHealth] = useState<StoryHealth | null>(null);

  // Calculate story health when beats change
  useEffect(() => {
    if (state.currentProject) {
      const health = calculateStoryHealth(state.currentProject.timeline.beats);
      setStoryHealth(health);
    }
  }, [state.currentProject?.timeline.beats]);

  if (!state.currentProject) {
    return null;
  }

  const beats = state.currentProject.timeline.beats;
  const completedBeats = beats.filter(b => b.status === 'complete').length;
  const completeness = Math.round((completedBeats / beats.length) * 100);

  const handleUpdateBeat = (beatNumber: number, updates: Partial<Beat>) => {
    dispatch({
      type: 'UPDATE_BEAT',
      payload: { beatNumber, beat: updates },
    });
  };

  const handleToggleExpand = (beatNumber: number) => {
    setExpandedBeat(expandedBeat === beatNumber ? null : beatNumber);
  };

  const handleContinue = () => {
    if (completeness >= 50) {
      dispatch({ type: 'SET_SCREEN', payload: 'what-next' });
    }
  };

  const handleExpandStory = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'expand-story' });
  };

  const handleFinishItForMe = async () => {
    if (!state.currentProject) return;

    setAutoCompleting(true);
    try {
      // Auto-complete all empty beats
      const completions = await openaiService.autoCompleteBeats(
        beats,
        state.currentProject.storyBible
      );

      // Update all completed beats
      for (const [beatNumber, summary] of Object.entries(completions)) {
        dispatch({
          type: 'UPDATE_BEAT',
          payload: {
            beatNumber: parseInt(beatNumber),
            beat: {
              summary,
              userWritten: false,
              status: 'complete',
              metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'ai-with-context',
              },
            },
          },
        });
      }
    } catch (error) {
      console.error('Error auto-completing story:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to auto-complete story. Please try again.' });
    } finally {
      setAutoCompleting(false);
    }
  };

  return (
    <Container maxWidth="2xl">
      <Header
        title="Your Story Timeline"
        subtitle={`${completedBeats} of 12 beats complete (${completeness}%)`}
      />

      <div className="mb-6 bg-slate-800/40 rounded-lg p-4 backdrop-blur-sm border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Story Progress</span>
          <span className="text-sm font-bold text-cosmic-400">{completeness}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-cosmic-600 to-cosmic-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Story Heartbeat Graph */}
      {storyHealth && (
        <StoryHeartbeat
          beats={beats}
          onBeatClick={(beatNumber) => {
            setExpandedBeat(beatNumber);
            const element = document.getElementById(`beat-${beatNumber}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          highlightedBeat={expandedBeat || undefined}
          className="mb-6"
        />
      )}

      <div className="space-y-4 mb-8">
        {beats.map((beat) => (
          <div key={beat.id} id={`beat-${beat.number}`}>
            <BeatCard
              beat={beat}
              storyBible={state.currentProject!.storyBible}
              previousBeats={beats.slice(0, beat.number - 1).filter(b => b.status === 'complete')}
              onUpdate={(updates) => handleUpdateBeat(beat.number, updates)}
              isExpanded={expandedBeat === beat.number}
              onToggleExpand={() => handleToggleExpand(beat.number)}
            />
          </div>
        ))}
      </div>

      {/* Story Health Panel */}
      {storyHealth && completeness >= 50 && (
        <StoryHealthPanel health={storyHealth} className="mb-6" />
      )}

      <div className="flex flex-col gap-3 sticky bottom-4 bg-slate-900/90 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        {completeness < 100 && (
          <Button
            variant="outline"
            onClick={handleFinishItForMe}
            disabled={autoCompleting}
            fullWidth
            className="border-cosmic-500/50 text-cosmic-300 hover:bg-cosmic-900/30"
          >
            {autoCompleting ? '✨ Auto-completing...' : '✨ Finish It For Me (AI)'}
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleExpandStory}
            fullWidth
          >
            💡 Expand Your Story
          </Button>
          <Button
            onClick={handleContinue}
            disabled={completeness < 50}
            fullWidth
          >
            {completeness >= 50 ? 'Continue →' : `Complete ${Math.ceil((50 - completeness) / 8.33)} more beats`}
          </Button>
        </div>
        <p className="text-xs text-center text-slate-400">
          {completeness < 100 ? 'Click "Finish It For Me" to auto-complete all empty beats' : 'All beats complete!'}
        </p>
      </div>
    </Container>
  );
}
