import React from 'react';
import { VisualizationSession } from '../../types/visualization';
import { X, Trash2, Clock, ArrowRight, BookOpen } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessions: VisualizationSession[];
  onSelectSession: (session: VisualizationSession) => void;
  onDeleteSession: (id: string) => void;
}

export const HistoryDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onDeleteSession,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-smoke-200">
        {/* Header */}
        <div className="p-4 border-b border-smoke-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-smoke-600" />
            <h2 className="text-sm font-semibold text-smoke-900 font-display">
              Saved Visualization History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-smoke-400 hover:text-smoke-900 hover:bg-smoke-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-smoke-500 space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-smoke-400" />
              <p className="text-xs">No saved concept visualizations yet.</p>
              <p className="text-[11px] text-smoke-400">
                Visualizations you generate will automatically be saved here.
              </p>
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3.5 rounded-xl bg-smoke-50/80 hover:bg-smoke-100/80 border border-smoke-200/80 transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-smoke-950 line-clamp-1">
                    {sess.plan?.title || sess.user_query}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(sess.id);
                    }}
                    className="text-smoke-400 hover:text-rose-600 p-1 transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-smoke-600 line-clamp-2">
                  {sess.plan?.summary || sess.user_query}
                </p>

                <div className="flex items-center justify-between pt-1 text-[10px] text-smoke-400 font-mono">
                  <span>{new Date(sess.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => {
                      onSelectSession(sess);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-smoke-700 hover:text-smoke-950 font-semibold cursor-pointer"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
