import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextArea } from '../components/ui/Input';
import { openaiService, derivePillarSuggestion } from '../services/ai/openaiService';
import { PILLAR_ORDER } from '../constants/broadQuestions';
import type { PillarKey, SuggestedAnswer } from '../types/story';

const EXAMPLE_PROMPTS = [
  "A detective discovers their childhood friend is the killer they've been hunting...",
  "In a world where dreams are currency, a dreamless girl must steal to survive...",
  "Two rivals must work together when they accidentally swap bodies...",
  "A time traveler keeps trying to save someone, but each attempt makes things worse...",
];

export default function InitialInputScreen() {
  const { dispatch } = useProject();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentExample, setCurrentExample] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleContinue = async () => {
    if (!input.trim()) return;

    setLoading(true);
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Create a new project (this also resets interview state).
      dispatch({
        type: 'CREATE_PROJECT',
        payload: { title: input.slice(0, 50) },
      });

      // Extract initial Story Bible from user input.
      const storyBible = await openaiService.extractStoryBible(input);

      dispatch({
        type: 'UPDATE_STORY_BIBLE',
        payload: storyBible,
      });

      // Derive suggestion strings for each of the 7 pillars from the extraction.
      const suggestions: Partial<Record<PillarKey, SuggestedAnswer>> = {};
      for (const pillar of PILLAR_ORDER) {
        const suggestion = derivePillarSuggestion(storyBible, pillar);
        suggestions[pillar] = {
          pillar,
          suggestion: suggestion ?? '',
          source: suggestion ? 'extracted' : 'none',
        };
      }
      dispatch({ type: 'SET_SUGGESTED_ANSWERS', payload: suggestions });

      // Route directly into the 7-pillar interview.
      dispatch({ type: 'SET_PHASE', payload: 'phase1-pillars' });
      dispatch({ type: 'SET_SCREEN', payload: 'quick-interview' });
    } catch (error: any) {
      console.error('Error processing initial input:', error);
      const isAuth = error?.name === 'OpenAIAuthError';
      dispatch({
        type: 'SET_ERROR',
        payload: isAuth
          ? 'Invalid OpenAI API key. Please reset your key and try again.'
          : 'Failed to process your story idea. Please try again.',
      });
    } finally {
      setLoading(false);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <Container maxWidth="xl">
      <Header
        title="What's your story about?"
        subtitle="Share as much or as little as you want. We'll ask smart follow-up questions."
      />

      <Card>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={EXAMPLE_PROMPTS[currentExample]}
          rows={8}
          disabled={loading}
          className="text-lg"
        />

        <div className="mt-6 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'welcome' })}
            disabled={loading}
          >
            ← Back
          </Button>

          <Button
            onClick={handleContinue}
            disabled={!input.trim() || loading}
            size="lg"
          >
            {loading ? 'Processing...' : 'Continue →'}
          </Button>
        </div>
      </Card>

      <div className="mt-6 text-center text-sm text-slate-400">
        <p>💡 Tip: Include details about your protagonist, their goal, the world, or the conflict</p>
      </div>
    </Container>
  );
}
