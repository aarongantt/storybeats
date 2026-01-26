import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function ExpandStoryScreen() {
  const { dispatch } = useProject();

  const handleSkip = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' });
  };

  return (
    <Container maxWidth="lg">
      <Header
        title="Expand Your Story (Optional)"
        subtitle="Answer deeper questions to enrich your Story Bible and improve AI suggestions"
      />

      <Card className="text-center py-12">
        <p className="text-lg text-slate-300 mb-6">
          This feature is coming soon! You can skip this and return to your timeline.
        </p>

        <div className="space-y-3 max-w-md mx-auto">
          <div className="text-sm text-left text-slate-400">
            <p>• Deep dive into protagonist's want vs. need</p>
            <p>• Explore world rules and constraints</p>
            <p>• Develop secondary characters</p>
            <p>• Clarify thematic elements</p>
          </div>
        </div>

        <Button
          onClick={handleSkip}
          size="lg"
          className="mt-8"
        >
          ← Back to Timeline
        </Button>
      </Card>
    </Container>
  );
}
