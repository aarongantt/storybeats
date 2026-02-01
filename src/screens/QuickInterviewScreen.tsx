import { useState, useEffect } from 'react';
import { useProject, deepMergeStoryBible } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ChipSelector } from '../components/ui/ChipSelector';
import { openaiService } from '../services/ai/openaiService';
import type { StoryBible, QuestionHistory } from '../types/story';

export default function QuickInterviewScreen() {
  const { state, dispatch } = useProject();
  const [loading, setLoading] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [selectedAiOption, setSelectedAiOption] = useState<string | null>(null);

  useEffect(() => {
    // Generate the first question when screen loads
    if (!state.currentQuestion && state.currentProject) {
      generateNextQuestion();
    }
  }, []);

  const validateStoryBible = () => {
    if (!state.currentProject) return false;
    const { storyBible } = state.currentProject;

    // Check for minimum required data
    const hasProtagonist = storyBible.protagonist?.name || storyBible.protagonist?.description;
    const hasConflict = storyBible.conflict?.mainConflict;
    const hasWorld = storyBible.world?.setting;

    return hasProtagonist && (hasConflict || hasWorld);
  };

  const generateNextQuestion = async (
    freshBible?: StoryBible,
    freshHistory?: QuestionHistory[]
  ) => {
    if (!state.currentProject) return;

    // Use provided fresh data, or fall back to state (for initial calls)
    const bibleToUse = freshBible || state.currentProject.storyBible;
    const historyToUse = freshHistory || state.questionHistory;

    setLoading(true);
    try {
      const question = await openaiService.generateSmartQuestion(
        bibleToUse,
        historyToUse
      );

      if (question) {
        dispatch({ type: 'SET_QUESTION', payload: question });
      } else {
        // No more questions needed - extract character hierarchy and validate Story Bible
        if (validateStoryBible()) {
          // Extract character hierarchy before moving to timeline
          try {
            const characters = await openaiService.extractCharacterHierarchy(
              state.currentProject.storyBible,
              state.questionHistory
            );

            if (characters.length > 0) {
              dispatch({
                type: 'UPDATE_STORY_BIBLE',
                payload: { characters }
              });
            }
          } catch (error) {
            console.error('Failed to extract character hierarchy:', error);
            // Continue anyway - not critical
          }

          dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' });
        } else {
          // Story Bible incomplete - generate one more question
          dispatch({
            type: 'SET_ERROR',
            payload: 'Need more information about your story. Please answer a few more questions.'
          });
          // Force generate another question by asking AI again
          setTimeout(() => {
            dispatch({ type: 'SET_ERROR', payload: null });
            generateNextQuestion();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error generating question:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to generate question' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!state.currentQuestion || !state.currentProject) return;

    setLoading(true);
    try {
      // Analyze the response and extract data
      const updates = await openaiService.analyzeResponse(
        state.currentQuestion,
        answer,
        state.currentProject.storyBible
      );

      // Compute fresh Bible BEFORE dispatch
      const freshBible = deepMergeStoryBible(
        state.currentProject.storyBible,
        updates
      );

      // Create new history entry
      const newHistoryEntry: QuestionHistory = {
        question: state.currentQuestion.text,
        answer,
        extractedData: updates,
        timestamp: new Date().toISOString(),
      };

      // Compute fresh history BEFORE dispatch
      const freshHistory = [...state.questionHistory, newHistoryEntry];

      // Dispatch updates (async)
      dispatch({
        type: 'ADD_QUESTION_HISTORY',
        payload: newHistoryEntry,
      });

      dispatch({ type: 'INCREMENT_QUESTION_COUNT' });

      dispatch({
        type: 'UPDATE_STORY_BIBLE',
        payload: updates,
      });

      // Reset input
      setCustomAnswer('');
      setSelectedChips([]);

      // Generate next question WITH FRESH DATA
      await generateNextQuestion(freshBible, freshHistory);
    } catch (error) {
      console.error('Error processing answer:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to process answer' });
    } finally {
      setLoading(false);
    }
  };

  const handleSurpriseMe = async () => {
    if (!state.currentQuestion || !state.currentProject) return;

    setLoading(true);
    try {
      const options = await openaiService.generateAIAnswerOptions(
        state.currentQuestion,
        state.currentProject.storyBible
      );
      setAiOptions(options);
      setLoading(false);
    } catch (error) {
      console.error('Error generating AI answer:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to generate AI answer' });
      setLoading(false);
    }
  };

  const handleSelectAiOption = async (option: string) => {
    setSelectedAiOption(option);
    await handleAnswer(option);
    setAiOptions([]);
    setSelectedAiOption(null);
  };

  const handleChipAnswer = async () => {
    if (selectedChips.length === 0) return;
    await handleAnswer(selectedChips.join(', '));
  };

  const handleCustomAnswer = async () => {
    if (!customAnswer.trim()) return;
    await handleAnswer(customAnswer);
  };

  const handleSkip = async () => {
    if (!state.currentQuestion || !state.currentProject) return;

    // Create skip history entry
    const skipEntry: QuestionHistory = {
      question: state.currentQuestion.text,
      answer: '[Skipped]',
      extractedData: {},
      timestamp: new Date().toISOString(),
    };

    // Compute fresh history BEFORE dispatch
    const freshHistory = [...state.questionHistory, skipEntry];

    // Dispatch updates
    dispatch({
      type: 'ADD_QUESTION_HISTORY',
      payload: skipEntry,
    });

    dispatch({ type: 'INCREMENT_QUESTION_COUNT' });

    // Generate next question WITH FRESH HISTORY
    // Bible unchanged, but pass fresh history
    await generateNextQuestion(
      state.currentProject.storyBible,
      freshHistory
    );
  };

  if (loading && !state.currentQuestion) {
    return (
      <Container maxWidth="lg">
        <Header title="Building your story foundation..." />
        <Card className="text-center py-12">
          <div className="animate-pulse text-cosmic-400 text-lg">
            Preparing your questions...
          </div>
        </Card>
      </Container>
    );
  }

  if (!state.currentQuestion) {
    return null;
  }

  const question = state.currentQuestion;
  const showChips = question.presentationMode === 'chips' && question.chipOptions;

  return (
    <Container maxWidth="lg">
      <Header
        title="Let's build your story foundation"
        subtitle={`Question ${state.questionCount + 1} of ~7`}
      />

      <Card>
        <h3 className="text-xl font-semibold mb-6">{question.text}</h3>

        {showChips && question.chipOptions && (
          <div className="mb-6">
            <ChipSelector
              options={question.chipOptions}
              selected={selectedChips}
              onChange={setSelectedChips}
              multiSelect={false}
            />
            {selectedChips.length > 0 && (
              <Button
                onClick={handleChipAnswer}
                className="mt-4"
                disabled={loading}
                fullWidth
              >
                Continue
              </Button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {aiOptions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300 mb-3">Choose an option or type your own:</p>
              {aiOptions.map((option, index) => {
                const labels = ['Neutral', 'Negative', 'Positive', 'Wild Card'];
                const colors = ['bg-slate-600', 'bg-red-600', 'bg-green-600', 'bg-purple-600'];
                const label = labels[index] || `Option ${index + 1}`;
                const colorClass = colors[index] || 'bg-cosmic-600';

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAiOption(option)}
                    disabled={loading}
                    className="w-full text-left p-4 bg-slate-800/40 hover:bg-slate-700/60 border border-white/10 hover:border-cosmic-500/50 rounded-lg transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`${colorClass} text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0`}>
                        {label}
                      </span>
                      <p className="text-white flex-1">{option}</p>
                    </div>
                  </button>
                );
              })}
              <Button
                variant="ghost"
                onClick={() => setAiOptions([])}
                disabled={loading}
                fullWidth
              >
                ← Show other options
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Input
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  placeholder="Type your own answer..."
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customAnswer.trim()) {
                      handleCustomAnswer();
                    }
                  }}
                />
                {customAnswer.trim() && (
                  <Button
                    onClick={handleCustomAnswer}
                    className="mt-2"
                    disabled={loading}
                    fullWidth
                  >
                    Submit Answer
                  </Button>
                )}
              </div>

              {question.allowSurpriseMe && (
                <Button
                  variant="outline"
                  onClick={handleSurpriseMe}
                  disabled={loading}
                  fullWidth
                >
                  ✨ Give me an idea! (AI will answer)
                </Button>
              )}
            </>
          )}

          {question.allowSkip && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={loading}
              fullWidth
            >
              ⏭ Skip for now
            </Button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'format-confirmation' })}
              disabled={loading}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">{state.questionHistory.length} questions answered</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' })}
                disabled={loading}
              >
                Skip to timeline →
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Container>
  );
}
