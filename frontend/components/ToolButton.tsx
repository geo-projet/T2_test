"use client";

import React from 'react';

type ToolMode = 'navigate' | 'select' | 'draw';

interface ToolButtonProps {
  mode: ToolMode;
  currentMode: ToolMode;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  mode,
  currentMode,
  onClick,
  title,
  ariaLabel,
  icon
}) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={mode === currentMode}
    title={title}
    className={`p-2 rounded hover:bg-gray-100 transition-colors ${
      mode === currentMode
        ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500'
        : 'text-gray-700'
    }`}
  >
    {icon}
  </button>
);

export default ToolButton;
