import React, { useState, useEffect } from 'react';
import { useProject } from './context/ProjectContext';
import { ApiKeySetup } from './components/ApiKeySetup';
import { storageService } from './services/storage/localStorageService';
import { openaiService } from './services/ai/openaiService';
import { StoryBiblePanel } from './components/debug/StoryBiblePanel';
import { TokenPanel, calculateCost } from './components/debug/TokenPanel';
import type { TokenUsage } from './components/debug/TokenPanel';
import WelcomeScreen from './screens/WelcomeScreen';
import InitialInputScreen from './screens/InitialInputScreen';
import QuickInterviewScreen from './screens/QuickInterviewScreen';
import FormatConfirmationScreen from './screens/FormatConfirmationScreen';
import TimelineBuilderScreen from './screens/TimelineBuilderScreen';
import ExpandStoryScreen from './screens/ExpandStoryScreen';
import WhatNextScreen from './screens/WhatNextScreen';
import PitchGeneratorScreen from './screens/PitchGeneratorScreen';

function App() {
  const { state, dispatch } = useProject();
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);

  useEffect(() => {
    const apiKey = storageService.getApiKey();
    if (apiKey) {
      openaiService.initialize(apiKey);

      // Set up token usage tracking
      openaiService.setTokenCallback((operation, promptTokens, completionTokens) => {
        const totalTokens = promptTokens + completionTokens;
        const cost = calculateCost(promptTokens, completionTokens);

        setTokenUsage(prev => [...prev, {
          timestamp: new Date().toISOString(),
          operation,
          promptTokens,
          completionTokens,
          totalTokens,
          cost,
        }]);
      });

      setApiKeyConfigured(true);
    }
  }, []);

  if (!apiKeyConfigured) {
    return <ApiKeySetup onComplete={() => setApiKeyConfigured(true)} />;
  }

  // Render the current screen based on state
  const renderScreen = () => {
    switch (state.currentScreen) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'initial-input':
        return <InitialInputScreen />;
      case 'quick-interview':
        return <QuickInterviewScreen />;
      case 'format-confirmation':
        return <FormatConfirmationScreen />;
      case 'timeline-builder':
        return <TimelineBuilderScreen />;
      case 'expand-story':
        return <ExpandStoryScreen />;
      case 'what-next':
        return <WhatNextScreen />;
      case 'pitch':
        return <PitchGeneratorScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Debug Panels */}
      <StoryBiblePanel />
      <TokenPanel usage={tokenUsage} />

      {/* Main Content - adjusted for debug panels */}
      <div className="pl-80 pr-80">
        {state.error && (
          <div className="fixed top-4 right-96 bg-red-500/90 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{state.error}</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {renderScreen()}
      </div>
    </div>
  );
}

export default App;
