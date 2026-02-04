
// components/LoadingOverlay.tsx
'use client';

import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  isVisible: boolean;
}

export default function LoadingOverlay({ message, isVisible }: LoadingOverlayProps) {
  if (!isVisible) return null;

  // Check if we have a detailed status (e.g., "LANDMARKS: Querying Overpass API...")
  const parts = message.split(': ');
  const title = parts.length > 1 ? parts[0] : message;
  const detail = parts.length > 1 ? parts[1] : 'Processing...';

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md transition-all animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        {/* Minimalist Animated Loading Dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-bounce"></div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-900 tracking-widest uppercase">
            {title}
          </h3>
          <div className="flex flex-col items-center">
            <p className="text-xs text-neutral-500 font-mono">
              {detail}
            </p>
            <p className="text-[10px] text-neutral-300 mt-2 italic">
              Generating your artwork
            </p>
          </div>
        </div>
      </div>

      {/* Decorative background pulse */}
      <div className="absolute inset-0 -z-10 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-neutral-200 rounded-full blur-3xl animate-pulse"></div>
      </div>
    </div>
  );
}
