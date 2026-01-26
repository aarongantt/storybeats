import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  const hoverStyles = hover ? 'hover:bg-slate-800/60 hover:shadow-xl cursor-pointer' : '';

  return (
    <div
      className={`bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/10 transition-all duration-200 ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
