/**
 * AI Universal Concept Visualiser
 * Main Application Orchestrator
 */

import React, { useState, useEffect } from 'react';
import { TopBar } from './components/common/TopBar';
import { LandingHero } from './components/home/LandingHero';
import { VisualizationWorkspace } from './components/workspace/VisualizationWorkspace';
import { LoadingState } from './components/common/LoadingState';
import { HistoryDrawer } from './components/common/HistoryDrawer';
import { VisualizationPlan, VisualizationSession } from './types/visualization';
import { generateVisualizationPlan, fetchHistory, deleteSession, checkServerHealth, RetryProgress } from './services/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentPlan, setCurrentPlan] = useState<VisualizationPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPrompt, setLoadingPrompt] = useState<string>('');
  const [retryProgress, setRetryProgress] = useState<RetryProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preserve last submitted inputs for seamless retry
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string>('');
  const [lastSubmittedImage, setLastSubmittedImage] = useState<string | undefined>(undefined);

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historySessions, setHistorySessions] = useState<VisualizationSession[]>([]);

  // Server health state
  const [serverHealth, setServerHealth] = useState<{ status: string; hasApiKey: boolean }>({
    status: 'checking',
    hasApiKey: true,
  });

  // Load history on mount
  useEffect(() => {
    loadSessions();
    checkServerHealth().then(setServerHealth);
  }, []);

  const loadSessions = async () => {
    const list = await fetchHistory();
    setHistorySessions(list);
  };

  const handleVisualize = async (prompt: string, imageBase64?: string) => {
    setIsLoading(true);
    setRetryProgress(null);
    setLoadingPrompt(prompt || 'Analyzing image diagram...');
    setErrorMessage(null);
    setLastSubmittedPrompt(prompt);
    setLastSubmittedImage(imageBase64);

    const { plan, error } = await generateVisualizationPlan(
      prompt,
      imageBase64,
      (progress) => {
        setRetryProgress(progress);
      }
    );

    setIsLoading(false);
    setRetryProgress(null);

    if (error || !plan) {
      setErrorMessage(error || 'The AI service is temporarily unavailable. Please try again.');
      return;
    }

    setCurrentPlan(plan);
    loadSessions();
  };

  const handleRetryLast = () => {
    if (lastSubmittedPrompt || lastSubmittedImage) {
      handleVisualize(lastSubmittedPrompt, lastSubmittedImage);
    }
  };

  const handleSelectHistorySession = (session: VisualizationSession) => {
    if (session.plan) {
      setCurrentPlan(session.plan);
      setErrorMessage(null);
    }
  };

  const handleDeleteHistorySession = async (id: string) => {
    await deleteSession(id);
    loadSessions();
  };

  const handleNewConcept = () => {
    setCurrentPlan(null);
    setErrorMessage(null);
    setRetryProgress(null);
  };

  const handleCategorySelect = (category: string) => {
    const categoryPrompts: Record<string, string> = {
      physics: 'Visualize projectile motion and launch trajectory with velocity and angle controls',
      math: 'Visualize Fourier harmonic wave decomposition with amplitude and frequency controls',
      cs: 'Explain binary search algorithm with search bounds and mid pointers over an array',
      ml: 'Show how gradient descent minimizes a loss function curve with learning rate',
      systems: 'Explain the TCP three-way handshake connection sequence with SYN and ACK message flows',
    };
    if (categoryPrompts[category]) {
      handleVisualize(categoryPrompts[category]);
    }
  };

  return (
    <div className="min-h-screen bg-smoke-50 text-smoke-950 flex flex-col font-sans selection:bg-smoke-200">
      {/* Top Bar Contract (1 row, 3 zones) */}
      <TopBar
        onNewConcept={handleNewConcept}
        onToggleHistory={() => setIsHistoryOpen(true)}
        onSelectTab={handleCategorySelect}
      />

      {/* API Key Missing Notification Banner (if applicable) */}
      {!serverHealth.hasApiKey && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            GEMINI_API_KEY is not detected in your server environment. AI requests may fail until configured in your environment secrets.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {errorMessage && (
          <div className="max-w-2xl mx-auto my-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Visualization Generation Error</p>
                <p className="text-rose-700 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={handleRetryLast}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-800 text-white hover:bg-rose-900 text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {isLoading ? (
          <LoadingState promptText={loadingPrompt} retryProgress={retryProgress} />
        ) : currentPlan ? (
          <VisualizationWorkspace
            plan={currentPlan}
            onBack={handleNewConcept}
          />
        ) : (
          <LandingHero
            onVisualize={handleVisualize}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={historySessions}
        onSelectSession={handleSelectHistorySession}
        onDeleteSession={handleDeleteHistorySession}
      />

      {/* Clean Footer */}
      <footer className="border-t border-smoke-200 py-6 px-4 text-center text-xs text-smoke-500 font-mono">
        <p>AI Universal Concept Visualiser · Generic Declarative Visualization Architecture</p>
      </footer>
    </div>
  );
}
