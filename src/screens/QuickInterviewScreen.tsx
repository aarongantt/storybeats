import { useState, useEffect, useRef } from 'react';
import { useProject, deepMergeStoryBible } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextArea } from '../components/ui/Input';
import { openaiService } from '../services/ai/openaiService';
import {
  OpenAITimeoutError,
  OpenAIRateLimitError,
  OpenAIValidationError,
  OpenAIAuthError,
  OpenAIServerError,
} from '../services/ai/retry';
import {
  PILLAR_ORDER,
  TURNING_POINT_ORDER,
  BROAD_QUESTIONS,
  PILLAR_TO_BIBLE_PATH,
} from '../constants/broadQuestions';
import { setNestedValue } from '../utils/beatValidation';
import type {
  StoryBible,
  QuestionHistory,
  PillarKey,
  BeatCursor,
  InterviewPhase,
} from '../types/story';

interface FriendlyError {
  message: string;
  canRetry: boolean;
}

function toFriendlyError(error: unknown): FriendlyError {
  if (error instanceof OpenAITimeoutError) {
    return { message: 'The AI is taking too long. Try again?', canRetry: true };
  }
  if (error instanceof OpenAIRateLimitError) {
    return { message: 'Rate limit hit. Wait a moment and try again.', canRetry: true };
  }
  if (error instanceof OpenAIValidationError) {
    return { message: 'The AI returned an unexpected response. Try again?', canRetry: true };
  }
  if (error instanceof OpenAIAuthError) {
    return { message: 'Your API key is invalid. Please reset it.', canRetry: false };
  }
  if (error instanceof OpenAIServerError) {
    return { message: 'OpenAI is having trouble right now. Try again?', canRetry: true };
  }
  if (error instanceof Error) return { message: error.message, canRetry: true };
  return { message: 'Something went wrong. Try again?', canRetry: true };
}

type DraftStage = 'spine' | 'beats' | 'characters' | 'done';

export default function QuickInterviewScreen() {
  const { state, dispatch } = useProject();
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState<DraftStage | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [localError, setLocalError] = useState<FriendlyError | null>(null);
  const hasRequestedRef = useRef(false);
  const draftingRef = useRef(false);
  const [draftError, setDraftError] = useState<FriendlyError | null>(null);

  const interview = state.interviewState;
  const pillarKey: PillarKey | undefined = state.currentQuestion?.pillarKey;
  const suggestion =
    pillarKey && interview.suggestedAnswers[pillarKey]?.source === 'extracted'
      ? interview.suggestedAnswers[pillarKey]?.suggestion
      : undefined;

  // Sync textarea with suggestion on new pillar question.
  useEffect(() => {
    if (state.currentQuestion && suggestion) {
      setCustomAnswer(suggestion);
    } else if (state.currentQuestion) {
      setCustomAnswer('');
    }
  }, [state.currentQuestion?.id]);

  useEffect(() => {
    if (hasRequestedRef.current) return;
    if (state.currentQuestion) return;
    if (!state.currentProject) return;
    if (interview.phase === 'complete') return;
    hasRequestedRef.current = true;
    void fetchNextQuestion();
  }, [state.currentProject?.id, interview.phase]);

  async function fetchNextQuestion(
    freshBible?: StoryBible,
    freshHistory?: QuestionHistory[],
    phaseOverride?: InterviewPhase,
    phase1IndexOverride?: number,
    phase2IndexOverride?: number,
    beatCursorOverride?: BeatCursor,
  ) {
    if (!state.currentProject) return;
    const bibleToUse = freshBible ?? state.currentProject.storyBible;
    const historyToUse = freshHistory ?? state.questionHistory;
    const beatsToUse = state.currentProject.timeline.beats;

    const phase = phaseOverride ?? interview.phase;
    const phase1Index = phase1IndexOverride ?? interview.phase1Index;
    const phase2Index = phase2IndexOverride ?? interview.phase2Index;
    const cursor = beatCursorOverride ?? interview.beatCursor;

    setLoading(true);
    setLocalError(null);
    try {
      const result = await openaiService.generateInterviewQuestion(
        phase,
        phase1Index,
        phase2Index,
        bibleToUse,
        historyToUse,
        beatsToUse,
        cursor,
      );

      dispatch({
        type: 'SET_INTERVIEW_STATE',
        payload: {
          phase: result.nextPhase,
          phase1Index: result.nextPhase1Index,
          phase2Index: result.nextPhase2Index,
          beatCursor: result.nextBeatCursor,
        },
      });

      if (result.question) {
        dispatch({ type: 'SET_QUESTION', payload: result.question });
      } else if (result.nextPhase === 'complete') {
        await finishInterview(bibleToUse, historyToUse);
      }
    } catch (error) {
      console.error('Error generating question:', error);
      setLocalError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function finishInterview(bible: StoryBible, history: QuestionHistory[]) {
    if (!state.currentProject) return;
    // Guard against concurrent invocations (e.g. fetchNextQuestion returning
    // complete while the user also clicks "Draft my outline now").
    if (draftingRef.current) return;
    draftingRef.current = true;
    setDraftError(null);
    setDrafting('characters');

    // Character hierarchy is non-blocking — best-effort.
    let workingBible: StoryBible = bible;
    try {
      const characters = await openaiService.extractCharacterHierarchy(bible, history);
      if (characters.length > 0) {
        dispatch({ type: 'UPDATE_STORY_BIBLE', payload: { characters } });
        workingBible = { ...workingBible, characters };
      }
    } catch (error) {
      console.error('Failed to extract character hierarchy:', error);
    }

    // Draft the story spine — the causal backbone all beats will follow.
    setDrafting('spine');
    let spine: string | undefined;
    try {
      spine = await openaiService.generateStorySpine(workingBible, state.currentProject.format);
      dispatch({
        type: 'UPDATE_PROJECT',
        payload: {
          timeline: { ...state.currentProject.timeline, storySpine: spine },
        },
      });
    } catch (error) {
      console.error('Failed to generate story spine:', error);
      // Non-fatal — beats can still be drafted without a spine.
    }

    // Draft all 12 beats in one continuity-enforced call. This is the
    // critical step — if it fails, surface a retry rather than silently
    // landing the user on an empty timeline.
    setDrafting('beats');
    try {
      const completions = await openaiService.autoCompleteBeats(
        state.currentProject.timeline.beats,
        workingBible,
        spine,
      );
      for (const [beatNumber, data] of Object.entries(completions)) {
        const num = parseInt(beatNumber, 10);
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
      console.error('Failed to auto-draft beats:', error);
      setDrafting(null);
      draftingRef.current = false;
      setDraftError(toFriendlyError(error));
      return;
    }

    setDrafting('done');
    draftingRef.current = false;
    dispatch({ type: 'SET_QUESTION', payload: null });
    dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' });
  }

  async function retryDrafting() {
    if (!state.currentProject) return;
    setDraftError(null);
    await finishInterview(state.currentProject.storyBible, state.questionHistory);
  }

  function skipDraftAndGoToTimeline() {
    setDraftError(null);
    dispatch({ type: 'SET_QUESTION', payload: null });
    dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' });
  }

  async function handleAnswer(answer: string) {
    if (!state.currentQuestion || !state.currentProject) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    setLoading(true);
    setLocalError(null);
    try {
      const question = state.currentQuestion;
      const currentPillar = question.pillarKey;

      const updates = await openaiService.analyzeResponse(
        question,
        trimmed,
        state.currentProject.storyBible,
      );

      let freshBible = deepMergeStoryBible(state.currentProject.storyBible, updates);

      // Phase 1 fallback: if analyzeResponse didn't populate the canonical
      // field for this pillar, write the raw answer in. If the question
      // targets a specific sub-field (e.g. a name follow-up), prefer that
      // path over the pillar's default.
      if (currentPillar) {
        const primaryPath =
          question.fallbackBiblePath ?? PILLAR_TO_BIBLE_PATH[currentPillar][0];
        const exists = primaryPath.split('.').reduce<any>(
          (acc, key) => (acc == null ? acc : acc[key]),
          freshBible,
        );
        if (!exists) {
          freshBible = JSON.parse(JSON.stringify(freshBible));
          setNestedValue(freshBible, primaryPath, trimmed);
        }
      }

      const newEntry: QuestionHistory = {
        question: question.text,
        answer: trimmed,
        extractedData: updates,
        timestamp: new Date().toISOString(),
        phase: interview.phase,
        pillarKey: currentPillar,
      };
      const freshHistory = [...state.questionHistory, newEntry];

      dispatch({ type: 'ADD_QUESTION_HISTORY', payload: newEntry });
      dispatch({ type: 'INCREMENT_QUESTION_COUNT' });
      dispatch({ type: 'UPDATE_STORY_BIBLE', payload: updates });
      if (currentPillar) {
        const primaryPath =
          question.fallbackBiblePath ?? PILLAR_TO_BIBLE_PATH[currentPillar][0];
        const pathParts = primaryPath.split('.');
        const patch: any = {};
        let cursorObj = patch;
        for (let i = 0; i < pathParts.length - 1; i++) {
          cursorObj[pathParts[i]] = {};
          cursorObj = cursorObj[pathParts[i]];
        }
        cursorObj[pathParts[pathParts.length - 1]] = trimmed;
        dispatch({ type: 'UPDATE_STORY_BIBLE', payload: patch });
      }

      setCustomAnswer('');
      setAiOptions([]);

      // Advance the index for whichever phase we were in.
      let nextPhase: InterviewPhase = interview.phase;
      let nextPhase1Index = interview.phase1Index;
      let nextPhase2Index = interview.phase2Index;

      if (interview.phase === 'phase1-pillars') {
        nextPhase1Index = interview.phase1Index + 1;
        dispatch({ type: 'ADVANCE_PHASE1' });
        if (nextPhase1Index >= PILLAR_ORDER.length) {
          nextPhase = 'phase2-turning-points';
          dispatch({ type: 'SET_PHASE', payload: 'phase2-turning-points' });
        }
      } else if (interview.phase === 'phase2-turning-points') {
        nextPhase2Index = interview.phase2Index + 1;
        dispatch({ type: 'ADVANCE_PHASE2' });
        if (nextPhase2Index >= TURNING_POINT_ORDER.length) {
          nextPhase = 'complete';
          dispatch({ type: 'SET_PHASE', payload: 'complete' });
        }
      }

      await fetchNextQuestion(
        freshBible,
        freshHistory,
        nextPhase,
        nextPhase1Index,
        nextPhase2Index,
        interview.beatCursor,
      );
    } catch (error) {
      console.error('Error processing answer:', error);
      setLocalError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (!state.currentQuestion || !state.currentProject) return;
    setLoading(true);
    setLocalError(null);
    try {
      const skipEntry: QuestionHistory = {
        question: state.currentQuestion.text,
        answer: '[Skipped]',
        extractedData: {},
        timestamp: new Date().toISOString(),
        phase: interview.phase,
        pillarKey: state.currentQuestion.pillarKey,
      };
      const freshHistory = [...state.questionHistory, skipEntry];
      dispatch({ type: 'ADD_QUESTION_HISTORY', payload: skipEntry });

      let nextPhase: InterviewPhase = interview.phase;
      let nextPhase1Index = interview.phase1Index;
      let nextPhase2Index = interview.phase2Index;

      if (interview.phase === 'phase1-pillars') {
        nextPhase1Index = interview.phase1Index + 1;
        dispatch({ type: 'ADVANCE_PHASE1' });
        if (nextPhase1Index >= PILLAR_ORDER.length) {
          nextPhase = 'phase2-turning-points';
          dispatch({ type: 'SET_PHASE', payload: 'phase2-turning-points' });
        }
      } else if (interview.phase === 'phase2-turning-points') {
        nextPhase2Index = interview.phase2Index + 1;
        dispatch({ type: 'ADVANCE_PHASE2' });
        if (nextPhase2Index >= TURNING_POINT_ORDER.length) {
          nextPhase = 'complete';
          dispatch({ type: 'SET_PHASE', payload: 'complete' });
        }
      }

      setCustomAnswer('');
      setAiOptions([]);
      await fetchNextQuestion(
        undefined,
        freshHistory,
        nextPhase,
        nextPhase1Index,
        nextPhase2Index,
        interview.beatCursor,
      );
    } catch (error) {
      console.error('Error skipping question:', error);
      setLocalError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSurpriseMe() {
    if (!state.currentQuestion || !state.currentProject) return;
    setLoading(true);
    setLocalError(null);
    try {
      const options = await openaiService.generateAIAnswerOptions(
        state.currentQuestion,
        state.currentProject.storyBible,
      );
      setAiOptions(options);
    } catch (error) {
      console.error('Error generating options:', error);
      setLocalError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAiOption(option: string) {
    setAiOptions([]);
    await handleAnswer(option);
  }

  async function handleDraftNow() {
    if (!state.currentProject) return;
    dispatch({ type: 'SET_PHASE', payload: 'complete' });
    await finishInterview(state.currentProject.storyBible, state.questionHistory);
  }

  // Draft failed — let the user retry or skip to the timeline.
  if (draftError) {
    return (
      <Container maxWidth="lg">
        <Header title="Drafting hit a snag" />
        <Card className="py-8">
          <p className="text-red-200 mb-4">{draftError.message}</p>
          <p className="text-sm text-slate-400 mb-6">
            Your answers are saved. You can try drafting again, or skip straight to the timeline and
            build beats there.
          </p>
          <div className="flex gap-3">
            {draftError.canRetry && (
              <Button onClick={retryDrafting}>Try drafting again</Button>
            )}
            <Button variant="outline" onClick={skipDraftAndGoToTimeline}>
              Go to timeline →
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  // Drafting overlay — shown while the spine + beats are being drafted.
  if (drafting && drafting !== 'done') {
    const msg =
      drafting === 'characters'
        ? 'Sorting out your characters…'
        : drafting === 'spine'
          ? 'Finding the shape of your story…'
          : 'Drafting all 12 beats with continuity…';
    return (
      <Container maxWidth="lg">
        <Header title="Drafting your outline" />
        <Card className="text-center py-12">
          <div className="animate-pulse text-cosmic-400 text-lg mb-2">{msg}</div>
          <p className="text-sm text-slate-400">
            This takes a few seconds — we're generating all 12 beats in one pass so they flow as a single story.
          </p>
        </Card>
      </Container>
    );
  }

  if (!state.currentQuestion && loading) {
    return (
      <Container maxWidth="lg">
        <Header title="Building your story foundation…" />
        <Card className="text-center py-12">
          <div className="animate-pulse text-cosmic-400 text-lg">Preparing your question…</div>
        </Card>
      </Container>
    );
  }

  if (!state.currentQuestion) return null;

  const question = state.currentQuestion;
  const isPhase2 = interview.phase === 'phase2-turning-points';
  const phaseTitle = isPhase2
    ? 'Phase 2 · Key Dramatic Moments'
    : 'Phase 1 · The Classic Story Pillars';
  const phaseOrder = isPhase2 ? TURNING_POINT_ORDER : PILLAR_ORDER;
  const phaseIndex = isPhase2 ? interview.phase2Index : interview.phase1Index;
  const phaseSubtitle = isPhase2
    ? `Question ${Math.min(phaseIndex + 1, phaseOrder.length)} of ${phaseOrder.length} — turning points that drive your beats`
    : `Question ${Math.min(phaseIndex + 1, phaseOrder.length)} of ${phaseOrder.length} — broad strokes`;

  return (
    <Container maxWidth="lg">
      <Header title="Let's build your story foundation" subtitle={phaseSubtitle} />

      <div className="mb-4 p-4 bg-slate-800/40 border border-white/10 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-cosmic-400">{phaseTitle}</h4>
          <span className="text-xs text-slate-400">
            {phaseIndex + 1} / {phaseOrder.length}
          </span>
        </div>
        <div className="flex gap-2">
          {phaseOrder.map((pillar, idx) => {
            const done = idx < phaseIndex;
            const current = idx === phaseIndex;
            return (
              <div
                key={pillar}
                className={`flex-1 h-2 rounded-full transition-all ${
                  done
                    ? isPhase2
                      ? 'bg-amber-400'
                      : 'bg-cosmic-400'
                    : current
                      ? isPhase2
                        ? 'bg-amber-500/60'
                        : 'bg-cosmic-500/60'
                      : 'bg-slate-700'
                }`}
                title={BROAD_QUESTIONS[pillar].shortLabel}
              />
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {question.pillarKey ? BROAD_QUESTIONS[question.pillarKey].shortLabel : ''}
        </p>
        {/* Tiny indicator: where we are in the overall journey */}
        <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider">
          <span className={!isPhase2 ? 'text-cosmic-300' : ''}>Foundation</span>
          <span>›</span>
          <span className={isPhase2 ? 'text-amber-300' : ''}>Key Moments</span>
          <span>›</span>
          <span>Draft</span>
        </div>
      </div>

      <Card>
        <h3 className="text-xl font-semibold mb-6">{question.text}</h3>

        {suggestion && aiOptions.length === 0 && (
          <div className="mb-4 p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
            <p className="text-xs text-green-300 font-semibold mb-2">
              💡 We pulled this from your story idea
            </p>
            <p className="text-white mb-3">"{suggestion}"</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleAnswer(suggestion)} disabled={loading}>
                Use this
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCustomAnswer(suggestion)} disabled={loading}>
                Edit it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCustomAnswer('')} disabled={loading}>
                Write my own
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {aiOptions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300 mb-3">Pick one, or go back and type your own:</p>
              {aiOptions.map((option, index) => {
                const labels = ['Neutral', 'Negative', 'Positive', 'Wild Card'];
                const colors = ['bg-slate-600', 'bg-red-600', 'bg-green-600', 'bg-purple-600'];
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAiOption(option)}
                    disabled={loading}
                    className="w-full text-left p-4 bg-slate-800/40 hover:bg-slate-700/60 border border-white/10 hover:border-cosmic-500/50 rounded-lg transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`${colors[index] ?? 'bg-cosmic-600'} text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0`}
                      >
                        {labels[index] ?? `Option ${index + 1}`}
                      </span>
                      <p className="text-white flex-1">{option}</p>
                    </div>
                  </button>
                );
              })}
              <Button variant="ghost" onClick={() => setAiOptions([])} disabled={loading} fullWidth>
                ← Back to typing
              </Button>
            </div>
          ) : (
            <>
              <TextArea
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                placeholder={
                  question.pillarKey
                    ? BROAD_QUESTIONS[question.pillarKey].placeholder
                    : 'Type your answer…'
                }
                rows={4}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && customAnswer.trim()) {
                    handleAnswer(customAnswer);
                  }
                }}
              />
              {customAnswer.trim() && (
                <Button onClick={() => handleAnswer(customAnswer)} disabled={loading} fullWidth>
                  Submit answer
                </Button>
              )}
              {question.allowSurpriseMe && (
                <Button variant="outline" onClick={handleSurpriseMe} disabled={loading} fullWidth>
                  🤖 Give me an idea (4 options)
                </Button>
              )}
            </>
          )}

          {question.allowSkip && aiOptions.length === 0 && (
            <Button variant="ghost" onClick={handleSkip} disabled={loading} fullWidth>
              ⏭ Skip for now
            </Button>
          )}
        </div>

        {localError && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700/60 rounded-lg text-sm">
            <p className="text-red-200 mb-2">{localError.message}</p>
            {localError.canRetry && (
              <Button size="sm" variant="outline" onClick={() => fetchNextQuestion()}>
                Retry
              </Button>
            )}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'format-confirmation' })}
            disabled={loading}
          >
            ← Back
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{state.questionHistory.length} answered</span>
            <Button variant="ghost" size="sm" onClick={handleDraftNow} disabled={loading}>
              ✨ Draft my outline now →
            </Button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
