import { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/Input';
import { BeatCard } from '../components/BeatCard';
import { StoryHeartbeat } from '../components/StoryHeartbeat';
import { StoryHealthPanel } from '../components/StoryHealthPanel';
import { openaiService } from '../services/ai/openaiService';
import { toFriendlyError, type FriendlyError } from '../services/ai/errorMapping';
import { ErrorBanner } from '../components/ErrorBanner';
import { calculateStoryHealth } from '../utils/storyHealth';
import type { Beat, StoryHealth } from '../types/story';

export default function TimelineBuilderScreen() {
  const { state, dispatch } = useProject();
  const [expandedBeat, setExpandedBeat] = useState<number | null>(1);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [storyHealth, setStoryHealth] = useState<StoryHealth | null>(null);
  const [spineEditing, setSpineEditing] = useState(false);
  const [spineDraft, setSpineDraft] = useState('');
  const [spineLoading, setSpineLoading] = useState(false);
  const [aiError, setAiError] = useState<FriendlyError | null>(null);

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

  const storySpine = state.currentProject.timeline.storySpine;

  // Used to disable the Finish-It button when nothing is left to draft.
  const needsFilling = beats.some(
    (b) => !b.locked && (!b.summary || b.status === 'empty' || b.status === 'incomplete'),
  );

  const handleFinishItForMe = async () => {
    if (!state.currentProject || !needsFilling) return;

    setAutoCompleting(true);
    setAiError(null);
    try {
      const meta = {
        format: state.currentProject.format,
        genres: state.currentProject.genres,
        tones: state.currentProject.tones,
      };
      // Ensure we have a spine for continuity. Generate one if missing.
      let spine = state.currentProject.timeline.storySpine;
      if (!spine) {
        try {
          spine = await openaiService.generateStorySpine(state.currentProject.storyBible, meta);
          dispatch({
            type: 'UPDATE_PROJECT',
            payload: {
              timeline: { ...state.currentProject.timeline, storySpine: spine },
            },
          });
        } catch (e) {
          console.warn('Spine generation failed; drafting beats without it.', e);
        }
      }

      const completions = await openaiService.autoCompleteBeats(
        beats,
        state.currentProject.storyBible,
        spine,
        meta,
      );

      const applied = Object.keys(completions).length;
      if (applied === 0) {
        setAiError({
          message: 'The AI returned no usable beats. Try again, or regenerate a single beat from its card.',
          canRetry: true,
        });
        return;
      }

      for (const [beatNumber, data] of Object.entries(completions)) {
        const num = parseInt(beatNumber, 10);
        // Defense in depth: never overwrite a locked/canon beat even if the
        // model returns one. autoCompleteBeats also asks the model not to,
        // but we trust nothing.
        const target = state.currentProject?.timeline.beats.find((b) => b.number === num);
        if (!target || target.locked || target.status === 'complete') continue;
        const emotionalData =
          data.intensity !== undefined && data.tension !== undefined
            ? {
                beatNumber: num as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
                intensity: data.intensity,
                tension: data.tension,
                tone: 'neutral' as const,
                timestamp: new Date().toISOString(),
              }
            : undefined;
        dispatch({
          type: 'UPDATE_BEAT',
          payload: {
            beatNumber: num,
            beat: {
              summary: data.summary,
              userWritten: false,
              status: 'complete',
              selectedTone: 'neutral',
              ...(emotionalData ? { emotionalData } : {}),
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
      setAiError(toFriendlyError(error));
    } finally {
      setAutoCompleting(false);
    }
  };

  const handleRegenerateSpine = async () => {
    if (!state.currentProject) return;
    setSpineLoading(true);
    setAiError(null);
    try {
      const spine = await openaiService.generateStorySpine(state.currentProject.storyBible, {
        format: state.currentProject.format,
        genres: state.currentProject.genres,
        tones: state.currentProject.tones,
      });
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: {
          timeline: { ...state.currentProject.timeline, storySpine: spine },
        },
      });
      setSpineDraft(spine);
    } catch (error) {
      console.error('Error regenerating spine:', error);
      setAiError(toFriendlyError(error));
    } finally {
      setSpineLoading(false);
    }
  };

  const handleSaveSpine = () => {
    if (!state.currentProject) return;
    dispatch({
      type: 'UPDATE_PROJECT',
      payload: {
        timeline: { ...state.currentProject.timeline, storySpine: spineDraft.trim() || undefined },
      },
    });
    setSpineEditing(false);
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

      {/* Story Spine — the causal backbone for all beat generation */}
      <div className="mb-6 bg-cosmic-900/30 border border-cosmic-700/40 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-cosmic-300">🧭 Story Spine</span>
          <div className="flex gap-2">
            {!spineEditing && storySpine && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSpineDraft(storySpine);
                  setSpineEditing(true);
                }}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRegenerateSpine}
              disabled={spineLoading}
            >
              {spineLoading ? 'Rewriting…' : storySpine ? '🔄 Rewrite' : '✨ Generate'}
            </Button>
          </div>
        </div>
        {spineEditing ? (
          <div className="space-y-2">
            <TextArea
              value={spineDraft}
              onChange={(e) => setSpineDraft(e.target.value)}
              rows={5}
              placeholder="5-7 sentences describing the causal arc of your story…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && spineDraft.trim()) {
                  e.preventDefault();
                  handleSaveSpine();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSpineEditing(false);
                }
              }}
            />
            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={handleSaveSpine} disabled={!spineDraft.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSpineEditing(false)}>
                Cancel
              </Button>
              <span className="ml-2 text-xs text-slate-500">⌘/Ctrl+Enter to save · Esc to cancel</span>
            </div>
          </div>
        ) : storySpine ? (
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{storySpine}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            No spine yet. A spine is the causal backbone of your story — generating one first makes
            all beats flow together.
          </p>
        )}
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
              previousBeats={beats
                .slice(0, beat.number - 1)
                .filter((b) => b.status === 'complete' && b.summary)}
              followingBeats={beats
                .slice(beat.number)
                .filter((b) => b.status === 'complete' && b.summary)}
              storySpine={storySpine}
              projectMeta={{
                format: state.currentProject!.format,
                genres: state.currentProject!.genres,
                tones: state.currentProject!.tones,
              }}
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
        {aiError && (
          <ErrorBanner
            error={aiError}
            onRetry={() => {
              setAiError(null);
              handleFinishItForMe();
            }}
            onDismiss={() => setAiError(null)}
          />
        )}
        {needsFilling && (
          <Button
            variant="outline"
            onClick={handleFinishItForMe}
            disabled={autoCompleting || !needsFilling}
            fullWidth
            className="border-cosmic-500/50 text-cosmic-300 hover:bg-cosmic-900/30"
          >
            {autoCompleting ? '✨ Auto-completing...' : '✨ Finish It For Me (AI)'}
          </Button>
        )}
        <Button onClick={handleContinue} disabled={completeness < 50} fullWidth>
          {(() => {
            if (completeness >= 50) return 'Continue →';
            const beatsNeeded = Math.max(0, 6 - completedBeats);
            return `Complete ${beatsNeeded} more beat${beatsNeeded === 1 ? '' : 's'}`;
          })()}
        </Button>
        <p className="text-xs text-center text-slate-400">
          {!needsFilling
            ? 'All beats complete or locked. Unlock or clear a beat to regenerate it.'
            : 'Click "Finish It For Me" to auto-complete all empty beats'}
        </p>
      </div>
    </Container>
  );
}
