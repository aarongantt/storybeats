import React from 'react';

interface TokenUsage {
  timestamp: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface TokenPanelProps {
  usage: TokenUsage[];
}

// GPT-4o pricing (as of 2024)
const PRICING = {
  promptTokensPer1M: 2.50,  // $2.50 per 1M input tokens
  completionTokensPer1M: 10.00,  // $10.00 per 1M output tokens
};

function calculateCost(promptTokens: number, completionTokens: number): number {
  const promptCost = (promptTokens / 1_000_000) * PRICING.promptTokensPer1M;
  const completionCost = (completionTokens / 1_000_000) * PRICING.completionTokensPer1M;
  return promptCost + completionCost;
}

export function TokenPanel({ usage }: TokenPanelProps) {
  const totalPromptTokens = usage.reduce((sum, u) => sum + u.promptTokens, 0);
  const totalCompletionTokens = usage.reduce((sum, u) => sum + u.completionTokens, 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
  const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-slate-900/95 border-l border-white/10 overflow-y-auto p-4 text-xs font-mono">
      <h2 className="text-sm font-bold text-cosmic-400 mb-4 sticky top-0 bg-slate-900 pb-2">
        💰 Token Usage
      </h2>

      {/* Summary */}
      <div className="border border-white/10 rounded p-3 bg-slate-800/50 mb-4">
        <div className="text-yellow-400 font-bold mb-2">SESSION TOTAL</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Prompt:</span>
            <span className="text-blue-400">{totalPromptTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Completion:</span>
            <span className="text-green-400">{totalCompletionTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span className="text-slate-300">Total:</span>
            <span className="text-white">{totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold pt-2 border-t border-white/10 mt-2">
            <span className="text-yellow-400">Cost:</span>
            <span className="text-yellow-400">${totalCost.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Individual calls */}
      <div className="space-y-2">
        <div className="text-slate-400 font-bold mb-2">API CALLS ({usage.length})</div>
        {usage.slice().reverse().map((u, idx) => (
          <div key={idx} className="border border-white/10 rounded p-2 bg-slate-800/30">
            <div className="text-cosmic-300 font-bold mb-1 truncate" title={u.operation}>
              {u.operation}
            </div>
            <div className="text-slate-500 text-[10px] mb-1">
              {new Date(u.timestamp).toLocaleTimeString()}
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div>
                <span className="text-slate-400">In:</span>{' '}
                <span className="text-blue-400">{u.promptTokens}</span>
              </div>
              <div>
                <span className="text-slate-400">Out:</span>{' '}
                <span className="text-green-400">{u.completionTokens}</span>
              </div>
              <div>
                <span className="text-slate-400">Total:</span>{' '}
                <span className="text-white">{u.totalTokens}</span>
              </div>
              <div>
                <span className="text-slate-400">Cost:</span>{' '}
                <span className="text-yellow-400">${u.cost.toFixed(4)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { calculateCost };
export type { TokenUsage };
