import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function WelcomeScreen() {
  const { dispatch } = useProject();

  const handleStart = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'initial-input' });
  };

  return (
    <Container maxWidth="md">
      <Header showLogo={true} />

      <Card className="text-center">
        <h2 className="text-3xl font-bold mb-4">
          Turn your story idea into a complete outline
        </h2>
        <p className="text-slate-300 text-lg mb-8">
          StoryBeats helps you develop your story through AI-guided questions and a 12-beat structure.
          Whether you have a detailed concept or just a spark of an idea, we'll help you build it out.
        </p>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cosmic-600/30 flex items-center justify-center text-cosmic-300 font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white">Quick AI Interview</h3>
              <p className="text-sm text-slate-400">
                Confirm your format and tone, then answer up to 12 smart questions across two phases —
                story foundation and key dramatic moments. We skip anything we can already infer from your idea.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cosmic-600/30 flex items-center justify-center text-cosmic-300 font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white">Build Your Timeline</h3>
              <p className="text-sm text-slate-400">Create your story beat-by-beat with AI suggestions or write your own</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cosmic-600/30 flex items-center justify-center text-cosmic-300 font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white">Generate Your Pitch</h3>
              <p className="text-sm text-slate-400">Export loglines, synopses, and outlines ready to share</p>
            </div>
          </div>
        </div>

        <Button onClick={handleStart} size="lg" fullWidth>
          Start Your Story
        </Button>
      </Card>

      <p className="text-center text-slate-500 text-sm mt-8">
        Your story data is saved locally in your browser
      </p>
    </Container>
  );
}
