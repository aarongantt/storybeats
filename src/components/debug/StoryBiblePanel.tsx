import React from 'react';
import { useProject } from '../../context/ProjectContext';

export function StoryBiblePanel() {
  const { state } = useProject();

  if (!state.currentProject) return null;

  const { storyBible } = state.currentProject;

  const renderValue = (value: any, depth = 0): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-500 italic">empty</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-slate-500 italic">[]</span>;
      }
      return (
        <div className="ml-4">
          {value.map((item, idx) => (
            <div key={idx} className="border-l border-slate-600 pl-2 my-1">
              {typeof item === 'object' ? renderValue(item, depth + 1) : (
                <span className="text-green-400">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="ml-4">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="my-1">
              <span className="text-blue-400 font-mono">{key}:</span>{' '}
              {renderValue(val, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-green-400">{String(value)}</span>;
  };

  return (
    <div className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900/95 border-r border-white/10 overflow-y-auto p-4 text-xs font-mono">
      <h2 className="text-sm font-bold text-cosmic-400 mb-4 sticky top-0 bg-slate-900 pb-2">
        📖 Story Bible
      </h2>

      <div className="space-y-2">
        {Object.entries(storyBible).map(([key, value]) => (
          <div key={key} className="border border-white/10 rounded p-2 bg-slate-800/50">
            <div className="text-yellow-400 font-bold mb-1">{key}</div>
            {renderValue(value)}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-slate-400 text-xs">
          Questions answered: {state.questionHistory.length}
        </div>
      </div>
    </div>
  );
}
