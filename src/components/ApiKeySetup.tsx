import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Container } from './layout/Container';
import { Header } from './layout/Header';
import { storageService } from '../services/storage/localStorageService';
import { openaiService } from '../services/ai/openaiService';

interface ApiKeySetupProps {
  onComplete: () => void;
}

export function ApiKeySetup({ onComplete }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [existingKey, setExistingKey] = useState(false);

  useEffect(() => {
    const saved = storageService.getApiKey();
    if (saved) {
      setExistingKey(true);
      openaiService.initialize(saved);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setError('OpenAI API keys should start with "sk-"');
      return;
    }

    storageService.saveApiKey(apiKey);
    openaiService.initialize(apiKey);
    onComplete();
  };

  const handleSkip = () => {
    if (existingKey) {
      onComplete();
    }
  };

  if (existingKey) {
    return (
      <Container maxWidth="md">
        <Header showLogo />
        <Card className="text-center">
          <h3 className="text-xl font-semibold mb-4">API Key Already Set</h3>
          <p className="text-slate-300 mb-6">
            You've already configured your OpenAI API key. You can start using StoryBeats!
          </p>
          <div className="space-y-3">
            <Button onClick={onComplete} fullWidth size="lg">
              Continue to App
            </Button>
            <Button
              variant="ghost"
              onClick={() => setExistingKey(false)}
              fullWidth
            >
              Update API Key
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Header showLogo />
      <Card>
        <h2 className="text-2xl font-bold mb-4">Welcome to StoryBeats</h2>
        <p className="text-slate-300 mb-6">
          StoryBeats uses OpenAI's API to help you develop your story. You'll need an API key to get started.
        </p>

        <div className="bg-cosmic-900/30 rounded-lg p-4 mb-6 text-sm">
          <h3 className="font-semibold mb-2">How to get your API key:</h3>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cosmic-400 hover:underline">platform.openai.com/api-keys</a></li>
            <li>Sign in or create an account</li>
            <li>Click "Create new secret key"</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>

        <Input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError('');
          }}
          placeholder="sk-..."
          label="OpenAI API Key"
          error={error}
        />

        <div className="mt-6 space-y-3">
          <Button onClick={handleSave} fullWidth size="lg">
            Save and Continue
          </Button>

          <p className="text-xs text-slate-500 text-center">
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>
      </Card>
    </Container>
  );
}
