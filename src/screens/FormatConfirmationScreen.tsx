import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Container } from '../components/layout/Container';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChipSelector } from '../components/ui/ChipSelector';
import { Input, TextArea } from '../components/ui/Input';
import type { StoryFormat } from '../types/story';

const FORMAT_OPTIONS = [
  { label: 'Film', value: 'Film' },
  { label: 'TV Series', value: 'TV' },
  { label: 'Book', value: 'Book' },
  { label: 'Comic/Graphic Novel', value: 'Comic' },
  { label: 'Stage Play', value: 'Play' },
  { label: 'Short Story', value: 'Short' },
  { label: 'Vertical Video', value: 'Vertical' },
];

const GENRE_OPTIONS = [
  { label: 'Drama', value: 'Drama' },
  { label: 'Comedy', value: 'Comedy' },
  { label: 'Thriller', value: 'Thriller' },
  { label: 'Horror', value: 'Horror' },
  { label: 'Sci-Fi', value: 'Sci-Fi' },
  { label: 'Fantasy', value: 'Fantasy' },
  { label: 'Romance', value: 'Romance' },
  { label: 'Mystery', value: 'Mystery' },
  { label: 'Action', value: 'Action' },
  { label: 'Adventure', value: 'Adventure' },
];

const TONE_OPTIONS = [
  { label: 'Humorous', value: 'Humorous' },
  { label: 'Dark', value: 'Dark' },
  { label: 'Hopeful', value: 'Hopeful' },
  { label: 'Gothic', value: 'Gothic' },
  { label: 'Romantic', value: 'Romantic' },
  { label: 'Gritty', value: 'Gritty' },
  { label: 'Whimsical', value: 'Whimsical' },
  { label: 'Suspenseful', value: 'Suspenseful' },
];

export default function FormatConfirmationScreen() {
  const { state, dispatch } = useProject();
  const [selectedFormat, setSelectedFormat] = useState<string[]>(
    state.currentProject?.format ? [state.currentProject.format] : []
  );
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    state.currentProject?.genres || []
  );
  const [selectedTones, setSelectedTones] = useState<string[]>(
    state.currentProject?.tones || []
  );
  const [theme, setTheme] = useState<string>(
    state.currentProject?.storyBible.theme || ''
  );
  const [worldSetting, setWorldSetting] = useState<string>(
    state.currentProject?.storyBible.world?.setting || ''
  );
  const [worldDescription, setWorldDescription] = useState<string>(
    state.currentProject?.storyBible.world?.description || ''
  );

  const handleContinue = () => {
    if (selectedFormat.length === 0 || !state.currentProject) return;

    // Update project format, genre, tones
    dispatch({
      type: 'UPDATE_PROJECT',
      payload: {
        format: selectedFormat[0] as StoryFormat,
        genres: selectedGenres,
        tones: selectedTones,
      },
    });

    // Update Story Bible with theme and world
    const currentWorld = state.currentProject.storyBible.world || {};
    dispatch({
      type: 'UPDATE_STORY_BIBLE',
      payload: {
        theme: theme || undefined,
        world: {
          ...currentWorld,
          setting: worldSetting || undefined,
          description: worldDescription || undefined,
        },
      },
    });

    // Move to adaptive interview with this foundation
    dispatch({ type: 'SET_SCREEN', payload: 'quick-interview' });
  };

  const handleAddCustomGenre = (genre: string) => {
    setSelectedGenres([...selectedGenres, genre]);
  };

  const handleAddCustomTone = (tone: string) => {
    setSelectedTones([...selectedTones, tone]);
  };

  return (
    <Container maxWidth="xl">
      <Header
        title="Let's start with the foundations"
        subtitle="These details will help us ask smarter follow-up questions."
      />

      <div className="space-y-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Format</h3>
          <ChipSelector
            options={FORMAT_OPTIONS}
            selected={selectedFormat}
            onChange={setSelectedFormat}
            multiSelect={false}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Genre (select up to 3)</h3>
          <ChipSelector
            options={GENRE_OPTIONS}
            selected={selectedGenres}
            onChange={(selected) => setSelectedGenres(selected.slice(0, 3))}
            multiSelect={true}
            allowCustom={true}
            customPlaceholder="Add a custom genre..."
            onCustomAdd={handleAddCustomGenre}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Tone (select up to 3)</h3>
          <ChipSelector
            options={TONE_OPTIONS}
            selected={selectedTones}
            onChange={(selected) => setSelectedTones(selected.slice(0, 3))}
            multiSelect={true}
            allowCustom={true}
            customPlaceholder="Add a custom tone..."
            onCustomAdd={handleAddCustomTone}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Theme (optional)</h3>
          <p className="text-sm text-slate-400 mb-3">What is your story really about? (e.g., "redemption", "the cost of ambition", "finding home")</p>
          <Input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g., redemption, love vs. duty, the cost of power..."
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">World</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Where does your story take place?</label>
              <Input
                value={worldSetting}
                onChange={(e) => setWorldSetting(e.target.value)}
                placeholder="e.g., 1920s Chicago, a distant planet, modern-day Tokyo..."
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">What is unique about this place? (optional)</label>
              <TextArea
                value={worldDescription}
                onChange={(e) => setWorldDescription(e.target.value)}
                placeholder="e.g., Magic is illegal. Technology has failed. Everyone can read minds..."
                rows={3}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'initial-input' })}
          >
            ← Back
          </Button>

          <Button
            onClick={handleContinue}
            disabled={selectedFormat.length === 0}
            size="lg"
          >
            Continue to Questions →
          </Button>
        </div>
      </div>
    </Container>
  );
}
