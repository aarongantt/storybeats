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

  const handleResetApiKey = () => {
    // Clear all localStorage data (API key, projects, preferences)
    storageService.clearAll();
    // Reset React state
    setApiKeyConfigured(false);
    setTokenUsage([]);
    // Clear any errors
    dispatch({ type: 'SET_ERROR', payload: null });
    // Reload the page to reset all app state
    window.location.reload();
  };

  const handleStartNewStory = () => {
    if (!window.confirm('Start a new story? Your current project will be saved.')) {
      return;
    }

    // Save current project first
    if (state.currentProject) {
      storageService.saveProject(state.currentProject);
    }

    // Create new project
    dispatch({ type: 'CREATE_PROJECT', payload: {} });
    dispatch({ type: 'SET_SCREEN', payload: 'welcome' });
  };

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

      {/* Reset Button - clears all data and restarts app */}
      <button
        onClick={handleResetApiKey}
        className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 hover:bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg z-[100] transition-colors flex items-center gap-2"
        title="Clear all data and start fresh"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">Reset</span>
      </button>

      {/* Start New Story button - top right */}
      {apiKeyConfigured && state.currentProject && (
        <button
          onClick={handleStartNewStory}
          className="fixed top-4 right-4 bg-cosmic-600/90 hover:bg-cosmic-500/90 text-white px-4 py-2 rounded-lg shadow-lg z-[100] transition-colors text-sm font-medium"
        >
          + Start New Story
        </button>
      )}

      {/* Main Content - adjusted for debug panels */}
      <div className="pl-80 pr-80">
        {state.error && (
          <div className="fixed top-4 right-96 bg-red-500/90 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{state.error}</p>
                {state.error.toLowerCase().includes('api key') && (
                  <button
                    onClick={handleResetApiKey}
                    className="mt-3 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
                  >
                    Reset API Key
                  </button>
                )}
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
