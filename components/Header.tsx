'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ContourPattern from './ContourPattern';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function Header({ showBackButton = false, onBack }: HeaderProps) {
  return (
    <header className="relative p-4 border-b border-neutral-200 bg-white overflow-hidden">
      <ContourPattern />
      <div className="relative z-10 flex items-center gap-4">
        {showBackButton && onBack && (
          <>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              New Route
            </button>
            <div className="h-4 w-px bg-neutral-200" />
          </>
        )}
        <h1 className="text-lg font-bold tracking-tight">Contour Maps Studio</h1>
      </div>
    </header>
  );
}
