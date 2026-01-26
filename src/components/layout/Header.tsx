import React from 'react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function Header({ title, subtitle, showLogo = true }: HeaderProps) {
  return (
    <header className="text-center mb-8">
      {showLogo && (
        <div className="mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cosmic-400 to-purple-400 bg-clip-text text-transparent">
            StoryBeats
          </h1>
        </div>
      )}
      {title && (
        <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
      )}
      {subtitle && (
        <p className="text-slate-400 text-lg">{subtitle}</p>
      )}
    </header>
  );
}
