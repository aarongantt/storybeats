import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function WhatNextScreen() {
  const { dispatch } = useProject();

  const handleGeneratePitch = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'pitch' });
  };

  const handleBackToTimeline = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'timeline-builder' });
  };

  return (
    <Container maxWidth="lg">
      <Header
        title="What's Next?"
        subtitle="Your timeline is looking great! What would you like to do?"
      />

      <div className="space-y-4">
        <Card hover onClick={handleGeneratePitch} className="cursor-pointer">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-3xl">📝</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Generate Your Pitch</h3>
              <p className="text-slate-300">
                Create loglines, synopses, and outlines from your timeline
              </p>
            </div>
            <div className="text-cosmic-400 text-xl">→</div>
          </div>
        </Card>

        <Card hover onClick={handleBackToTimeline} className="cursor-pointer border-cosmic-500/30">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-3xl">📖</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Keep Building</h3>
              <p className="text-slate-300">
                Return to your timeline to refine and complete more beats
              </p>
            </div>
            <div className="text-cosmic-400 text-xl">→</div>
          </div>
        </Card>
      </div>
    </Container>
  );
}
