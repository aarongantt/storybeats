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

  const handleResetApiKey = () => {
    storageService.clearApiKey();
    setApiKeyConfigured(false);
    setTokenUsage([]);
    dispatch({ type: 'SET_ERROR', payload: null });
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

      {/* Floating Settings Button - positioned at true viewport center top */}
      <button
        onClick={handleResetApiKey}
        className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-700/90 hover:bg-slate-600/90 text-white px-4 py-2 rounded-lg shadow-lg z-[100] transition-colors flex items-center gap-2"
        title="Change API Key"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">Settings</span>
      </button>

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
