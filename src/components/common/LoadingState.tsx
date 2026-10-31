import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { RetryProgress } from '../../services/api';

interface Props {
  promptText?: string;
  retryProgress?: RetryProgress | null;
}

const LOADING_PHRASES = [
  'Parsing concept primitives & semantics...',
  'Extracting mathematical equations & parameters...',
  'Identifying system components & dynamic relationships...',
  'Synthesizing declarative visualization plan...',
  'Configuring interactive controls & parameters...',
  'Calibrating coordinate systems & stage layout...',
];

export const LoadingState: React.FC<Props> = ({ promptText, retryProgress }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const isRetrying = retryProgress?.isRetrying;

  return (
    <div className="w-full max-w-lg mx-auto py-24 px-4 flex flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xs transition-colors duration-300 ${
            isRetrying ? 'bg-amber-50 border-amber-300' : 'bg-smoke-100 border-smoke-200'
          }`}
        >
          {isRetrying ? (
            <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
          ) : (
            <Loader2 className="w-7 h-7 text-smoke-600 animate-spin" />
          )}
        </div>
      </div>

      <h3 className="text-base font-semibold text-smoke-900 font-display mb-1.5">
        {isRetrying ? 'AI service is temporarily busy. Retrying...' : 'Designing Interactive Visualization'}
      </h3>

      {isRetrying ? (
        <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Retrying… {retryProgress.attempt}/{retryProgress.maxAttempts}</span>
        </div>
      ) : (
        <p className="text-xs font-mono text-smoke-500 h-6 transition-all duration-300">
          {LOADING_PHRASES[phraseIndex]}
        </p>
      )}

      {promptText && (
        <div className="mt-4 px-4 py-2 rounded-xl bg-white border border-smoke-200 text-xs text-smoke-600 max-w-sm truncate shadow-2xs font-mono">
          "{promptText}"
        </div>
      )}
    </div>
  );
};

