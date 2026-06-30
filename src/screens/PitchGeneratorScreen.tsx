import { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { StoryHeartbeat } from '../components/StoryHeartbeat';
import { StoryHealthPanel } from '../components/StoryHealthPanel';
import { openaiService } from '../services/ai/openaiService';
import { toFriendlyError, type FriendlyError } from '../services/ai/errorMapping';
import { calculateStoryHealth } from '../utils/storyHealth';
import type { PitchPackage } from '../types/story';

export default function PitchGeneratorScreen() {
  const { state, dispatch } = useProject();
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchPackage | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'logline' | 'short' | 'onepage' | 'outline'>('logline');
  const [aiError, setAiError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    if (state.currentProject?.pitch) {
      setPitch(state.currentProject.pitch);
    }
  }, [state.currentProject]);

  const handleGenerate = async () => {
    if (!state.currentProject) return;

    setLoading(true);
    setAiError(null);
    try {
      const generatedPitch = await openaiService.generatePitch(
        state.currentProject.storyBible,
        state.currentProject.timeline.beats,
        state.currentProject.format,
        state.currentProject.timeline.storySpine,
        {
          format: state.currentProject.format,
          genres: state.currentProject.genres,
          tones: state.currentProject.tones,
        },
      );

      setPitch(generatedPitch);

      dispatch({
        type: 'UPDATE_PROJECT',
        payload: { pitch: generatedPitch },
      });
    } catch (error) {
      console.error('Error generating pitch:', error);
      setAiError(toFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const handleBack = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'what-next' });
  };

  // Calculate story health for display
  const storyHealth = state.currentProject
    ? calculateStoryHealth(state.currentProject.timeline.beats)
    : null;

  const renderContent = () => {
    if (!pitch) return null;

    switch (selectedFormat) {
      case 'logline':
        return pitch.logline;
      case 'short':
        return pitch.shortSynopsis;
      case 'onepage':
        return pitch.onePageSynopsis;
      case 'outline':
        return pitch.numberedOutline;
      default:
        return '';
    }
  };

  return (
    <Container maxWidth="2xl">
      <Header
        title="Your Story Pitch"
        subtitle="Export your story in professional formats"
      />

      {aiError && (
        <div className="mb-4">
          <ErrorBanner
            error={aiError}
            onRetry={() => {
              setAiError(null);
              handleGenerate();
            }}
            onDismiss={() => setAiError(null)}
          />
        </div>
      )}
      {!pitch ? (
        <Card className="text-center py-12">
          <h3 className="text-xl font-semibold mb-4">Ready to generate your pitch?</h3>
          <p className="text-slate-300 mb-8 max-w-md mx-auto">
            We'll create a logline, synopsis, and outline based on your completed timeline.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="lg"
          >
            {loading ? 'Generating...' : '✨ Generate Pitch Package'}
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedFormat === 'logline' ? 'primary' : 'ghost'}
              onClick={() => setSelectedFormat('logline')}
            >
              Logline
            </Button>
            <Button
              variant={selectedFormat === 'short' ? 'primary' : 'ghost'}
              onClick={() => setSelectedFormat('short')}
            >
              Short Synopsis
            </Button>
            <Button
              variant={selectedFormat === 'onepage' ? 'primary' : 'ghost'}
              onClick={() => setSelectedFormat('onepage')}
            >
              One-Page
            </Button>
            <Button
              variant={selectedFormat === 'outline' ? 'primary' : 'ghost'}
              onClick={() => setSelectedFormat('outline')}
            >
              Outline
            </Button>
          </div>

          <Card>
            <div className="mb-4 flex justify-between items-center">
              <h3 className="font-semibold text-lg capitalize">
                {selectedFormat === 'onepage' ? 'One-Page Synopsis' : selectedFormat}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(renderContent() || '')}
              >
                📋 Copy
              </Button>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">
                {renderContent()}
              </p>
            </div>
          </Card>

          {/* Story Heartbeat and Health */}
          {storyHealth && (
            <div className="space-y-6 mt-8">
              <StoryHeartbeat
                beats={state.currentProject!.timeline.beats}
                onBeatClick={() => {}} // No navigation on pitch screen
                className="mb-6"
              />
              <StoryHealthPanel health={storyHealth} />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleBack}>
              ← Back
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (
                  !pitch ||
                  window.confirm(
                    'Regenerate pitch? Your current logline, synopsis, and outline will be replaced.',
                  )
                ) {
                  handleGenerate();
                }
              }}
              disabled={loading}
            >
              🔄 Regenerate
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
