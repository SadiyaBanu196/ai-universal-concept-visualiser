import React from 'react';
import { Sparkles, History, PlusCircle, Compass } from 'lucide-react';

interface Props {
  onNewConcept: () => void;
  onToggleHistory: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const TopBar: React.FC<Props> = ({
  onNewConcept,
  onToggleHistory,
  activeTab = 'explore',
  onSelectTab,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xs border-b border-smoke-200 px-4 lg:px-8 py-3.5 flex items-center justify-between">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onNewConcept();
        }}
        className="text-lg font-bold tracking-tight text-smoke-900 font-display flex items-center gap-2 hover:opacity-90 transition-opacity"
      >
        <span className="w-6 h-6 rounded-lg bg-smoke-500 flex items-center justify-center text-white text-xs font-mono font-bold">
          V
        </span>
        <span>AI Universal Concept Visualiser</span>
      </a>

      {/* Zone 2: 4-6 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-smoke-600">
        <button
          onClick={() => onSelectTab?.('physics')}
          className="hover:text-smoke-900 transition-colors cursor-pointer"
        >
          Physics
        </button>
        <button
          onClick={() => onSelectTab?.('math')}
          className="hover:text-smoke-900 transition-colors cursor-pointer"
        >
          Mathematics
        </button>
        <button
          onClick={() => onSelectTab?.('cs')}
          className="hover:text-smoke-900 transition-colors cursor-pointer"
        >
          Computer Science
        </button>
        <button
          onClick={() => onSelectTab?.('ml')}
          className="hover:text-smoke-900 transition-colors cursor-pointer"
        >
          Machine Learning
        </button>
        <button
          onClick={() => onSelectTab?.('systems')}
          className="hover:text-smoke-900 transition-colors cursor-pointer"
        >
          Systems & Protocols
        </button>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-smoke-700 bg-smoke-100 hover:bg-smoke-200 rounded-lg transition-colors cursor-pointer"
          title="View Saved Sessions"
        >
          <History className="w-3.5 h-3.5 text-smoke-600" />
          <span className="hidden sm:inline">History</span>
        </button>

        <button
          onClick={onNewConcept}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-smoke-800 hover:bg-smoke-900 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Concept</span>
        </button>
      </div>
    </header>
  );
};
