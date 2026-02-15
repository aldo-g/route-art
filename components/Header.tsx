'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ContourPattern from './ContourPattern';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
  onCtaClick?: () => void;
}

export default function Header({ showBackButton = false, onBack, onCtaClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 relative p-4 border-b border-neutral-200 bg-white overflow-hidden">
      <ContourPattern />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {showBackButton && onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 transition-colors text-sm bg-white/80 backdrop-blur-sm px-2 py-1 rounded"
              >
                <ArrowLeft className="w-4 h-4" />
                New Route
              </button>
              <div className="h-4 w-px bg-neutral-200" />
            </>
          )}
          <h1 className="text-lg font-bold tracking-tight bg-white/80 backdrop-blur-sm px-3 py-1 rounded">Contour Maps Studio</h1>
        </div>
        {onCtaClick && (
          <button
            onClick={onCtaClick}
            className="hidden sm:block px-5 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Create poster
          </button>
        )}
      </div>
    </header>
  );
}
