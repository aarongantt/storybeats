import React from 'react';

interface ChipOption {
  label: string;
  value: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiSelect?: boolean;
  allowCustom?: boolean;
  customPlaceholder?: string;
  onCustomAdd?: (value: string) => void;
}

export function ChipSelector({
  options,
  selected,
  onChange,
  multiSelect = false,
  allowCustom = false,
  customPlaceholder = 'Add your own...',
  onCustomAdd,
}: ChipSelectorProps) {
  const [customValue, setCustomValue] = React.useState('');
  const [showCustomInput, setShowCustomInput] = React.useState(false);

  const handleChipClick = (value: string) => {
    if (multiSelect) {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  const handleCustomSubmit = () => {
    if (customValue.trim() && onCustomAdd) {
      onCustomAdd(customValue.trim());
      setCustomValue('');
      setShowCustomInput(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => handleChipClick(option.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-cosmic-600 text-white shadow-lg scale-105'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}

        {allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 hover:text-white border-2 border-dashed border-slate-500 transition-all duration-200"
          >
            + Add your own
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit();
              if (e.key === 'Escape') setShowCustomInput(false);
            }}
            placeholder={customPlaceholder}
            className="flex-1 px-4 py-2 bg-slate-800/60 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cosmic-500"
            autoFocus
          />
          <button
            onClick={handleCustomSubmit}
            className="px-4 py-2 bg-cosmic-600 hover:bg-cosmic-700 text-white rounded-lg transition-all"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomValue('');
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
