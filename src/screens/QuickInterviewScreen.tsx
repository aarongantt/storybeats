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
import { PILLAR_ORDER, BROAD_QUESTIONS, PILLAR_TO_BIBLE_PATH } from '../constants/broadQuestions';
import { BEAT_CONTRACTS, getMissingFieldsForBeat } from '../constants/beatContracts';
import { setNestedValue } from '../utils/beatValidation';
import type {
  StoryBible,
  QuestionHistory,
  Question,
  PillarKey,
  BeatCursor,
  InterviewPhase,
  BeatNumber,
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

export default function QuickInterviewScreen() {
  const { state, dispatch } = useProject();
  const [loading, setLoading] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [localError, setLocalError] = useState<FriendlyError | null>(null);
  const hasRequestedRef = useRef(false);

  const interview = state.interviewState;
  const pillarKey: PillarKey | undefined = state.currentQuestion?.pillarKey;
  const suggestion =
    pillarKey && interview.suggestedAnswers[pillarKey]?.source === 'extracted'
      ? interview.suggestedAnswers[pillarKey]?.suggestion
      : undefined;

  // Keep the textarea in sync with the suggestion when a new pillar question loads.
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
    beatCursorOverride?: BeatCursor,
  ) {
    if (!state.currentProject) return;
    const bibleToUse = freshBible ?? state.currentProject.storyBible;
    const historyToUse = freshHistory ?? state.questionHistory;
    const beatsToUse = state.currentProject.timeline.beats;

    const phase = phaseOverride ?? interview.phase;
    const phase1Index = phase1IndexOverride ?? interview.phase1Index;
    const cursor = beatCursorOverride ?? interview.beatCursor;

    setLoading(true);
    setLocalError(null);
    try {
      const result = await openaiService.generateInterviewQuestion(
        phase,
        phase1Index,
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
    try {
      const characters = await openaiService.extractCharacterHierarchy(bible, history);
      if (characters.length > 0) {
        dispatch({ type: 'UPDATE_STORY_BIBLE', payload: { characters } });
      }
    } catch (error) {
      console.error('Failed to extract character hierarchy:', error);
      // Non-critical — continue to timeline regardless.
    }
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
      const wasPhase1 = interview.phase === 'phase1-pillars';
      const currentPillar = question.pillarKey;
      const currentBeat = interview.beatCursor.beatNumber;

      // 1. Ask the model to extract structured updates from the raw answer.
      const updates = await openaiService.analyzeResponse(
        question,
        trimmed,
        state.currentProject.storyBible,
      );

      // 2. Merge locally so downstream logic has the new values.
      let freshBible = deepMergeStoryBible(state.currentProject.storyBible, updates);

      // 3. Phase 1 fallback: ensure the pillar's canonical field is written even
      //    if analyzeResponse didn't fill it in (common for tone/endingFeeling).
      if (wasPhase1 && currentPillar) {
        const paths = PILLAR_TO_BIBLE_PATH[currentPillar];
        const primaryPath = paths[0];
        const current: any = freshBible;
        const exists = primaryPath.split('.').reduce<any>(
          (acc, key) => (acc == null ? acc : acc[key]),
          current,
        );
        if (!exists) {
          freshBible = JSON.parse(JSON.stringify(freshBible));
          setNestedValue(freshBible, primaryPath, trimmed);
        }
      }

      // 4. Record history (tagged with phase + pillar/beat for later).
      const newEntry: QuestionHistory = {
        question: question.text,
        answer: trimmed,
        extractedData: updates,
        timestamp: new Date().toISOString(),
        phase: interview.phase,
        pillarKey: currentPillar,
        beatNumber: interview.phase === 'phase2-beats' ? (currentBeat as BeatNumber) : undefined,
      };
      const freshHistory = [...state.questionHistory, newEntry];

      dispatch({ type: 'ADD_QUESTION_HISTORY', payload: newEntry });
      dispatch({ type: 'INCREMENT_QUESTION_COUNT' });
      dispatch({ type: 'UPDATE_STORY_BIBLE', payload: updates });
      if (wasPhase1 && currentPillar) {
        // Persist the pillar fallback write so the merged bible matches state.
        const primaryPath = PILLAR_TO_BIBLE_PATH[currentPillar][0];
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

      // 5. Advance phase/cursor locally for the next fetch.
      let nextPhase: InterviewPhase = interview.phase;
      let nextPhase1Index = interview.phase1Index;
      let nextCursor: BeatCursor = interview.beatCursor;

      if (wasPhase1) {
        nextPhase1Index = interview.phase1Index + 1;
        dispatch({ type: 'ADVANCE_PHASE1' });
        if (nextPhase1Index >= PILLAR_ORDER.length) {
          nextPhase = 'phase2-beats';
          dispatch({ type: 'SET_PHASE', payload: 'phase2-beats' });
        }
      } else if (interview.phase === 'phase2-beats') {
        const incremented = interview.beatCursor.questionsAskedForBeat + 1;
        const beatNumber = interview.beatCursor.beatNumber as BeatNumber;
        const missingAfter = getMissingFieldsForBeat(beatNumber, freshBible);
        if (missingAfter.length === 0 || incremented >= 3) {
          nextCursor = { beatNumber: interview.beatCursor.beatNumber + 1, questionsAskedForBeat: 0 };
          dispatch({ type: 'ADVANCE_BEAT_CURSOR', payload: nextCursor });
        } else {
          nextCursor = { beatNumber: interview.beatCursor.beatNumber, questionsAskedForBeat: incremented };
          dispatch({ type: 'INCREMENT_BEAT_QUESTIONS' });
        }
      }

      // 6. Fetch next question with fresh data.
      await fetchNextQuestion(freshBible, freshHistory, nextPhase, nextPhase1Index, nextCursor);
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
        beatNumber:
          interview.phase === 'phase2-beats'
            ? (interview.beatCursor.beatNumber as BeatNumber)
            : undefined,
      };
      const freshHistory = [...state.questionHistory, skipEntry];
      dispatch({ type: 'ADD_QUESTION_HISTORY', payload: skipEntry });

      let nextPhase: InterviewPhase = interview.phase;
      let nextPhase1Index = interview.phase1Index;
      let nextCursor: BeatCursor = interview.beatCursor;

      if (interview.phase === 'phase1-pillars') {
        nextPhase1Index = interview.phase1Index + 1;
        dispatch({ type: 'ADVANCE_PHASE1' });
        if (nextPhase1Index >= PILLAR_ORDER.length) {
          nextPhase = 'phase2-beats';
          dispatch({ type: 'SET_PHASE', payload: 'phase2-beats' });
        }
      } else if (interview.phase === 'phase2-beats') {
        nextCursor = { beatNumber: interview.beatCursor.beatNumber + 1, questionsAskedForBeat: 0 };
        dispatch({ type: 'ADVANCE_BEAT_CURSOR', payload: nextCursor });
      }

      setCustomAnswer('');
      setAiOptions([]);
      await fetchNextQuestion(undefined, freshHistory, nextPhase, nextPhase1Index, nextCursor);
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

  async function handleSkipToTimeline() {
    if (!state.currentProject) return;
    dispatch({ type: 'SET_PHASE', payload: 'complete' });
    await finishInterview(state.currentProject.storyBible, state.questionHistory);
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
  const isPhase1 = interview.phase === 'phase1-pillars';
  const totalPhase2ForCursor = interview.beatCursor.questionsAskedForBeat;

  return (
    <Container maxWidth="lg">
      <Header
        title="Let's build your story foundation"
        subtitle={
          isPhase1
            ? `Question ${Math.min(interview.phase1Index + 1, PILLAR_ORDER.length)} of 7 — broad strokes`
            : `Beat ${Math.min(interview.beatCursor.beatNumber, 12)} of 12 — adding details`
        }
      />

      {/* Progress indicator */}
      <div className="mb-4 p-4 bg-slate-800/40 border border-white/10 rounded-lg">
        {isPhase1 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-cosmic-400">
                Phase 1 · The Classic Story Pillars
              </h4>
              <span className="text-xs text-slate-400">
                {interview.phase1Index + 1} / {PILLAR_ORDER.length}
              </span>
            </div>
            <div className="flex gap-2">
              {PILLAR_ORDER.map((pillar, idx) => {
                const done = idx < interview.phase1Index;
                const current = idx === interview.phase1Index;
                return (
                  <div
                    key={pillar}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      done
                        ? 'bg-cosmic-400'
                        : current
                          ? 'bg-cosmic-500/60'
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
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-cosmic-400">
                Phase 2 · Filling in the Beats
              </h4>
              <span className="text-xs text-slate-400">
                Beat {interview.beatCursor.beatNumber} of 12
                {totalPhase2ForCursor > 0 ? ` · Q${totalPhase2ForCursor + 1}/3 for this beat` : ''}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 12 }).map((_, idx) => {
                const beatNum = idx + 1;
                const done = beatNum < interview.beatCursor.beatNumber;
                const current = beatNum === interview.beatCursor.beatNumber;
                return (
                  <div
                    key={beatNum}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      done ? 'bg-cosmic-400' : current ? 'bg-cosmic-500/60' : 'bg-slate-700'
                    }`}
                    title={`Beat ${beatNum}: ${BEAT_CONTRACTS[beatNum as BeatNumber].title}`}
                  />
                );
              })}
            </div>
            {interview.beatCursor.beatNumber <= 12 && (
              <p className="mt-2 text-xs text-slate-400">
                {BEAT_CONTRACTS[interview.beatCursor.beatNumber as BeatNumber].title}
              </p>
            )}
          </>
        )}
      </div>

      <Card>
        <h3 className="text-xl font-semibold mb-6">{question.text}</h3>

        {/* Suggestion card (Phase 1 only, when we extracted something) */}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCustomAnswer(suggestion)}
                disabled={loading}
              >
                Edit it
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCustomAnswer('')}
                disabled={loading}
              >
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
                <Button
                  onClick={() => handleAnswer(customAnswer)}
                  disabled={loading}
                  fullWidth
                >
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
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'initial-input' })}
            disabled={loading}
          >
            ← Back
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{state.questionHistory.length} answered</span>
            <Button variant="ghost" size="sm" onClick={handleSkipToTimeline} disabled={loading}>
              Skip to timeline →
            </Button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
