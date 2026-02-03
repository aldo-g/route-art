'use client';

import React from 'react';
import { Github, Coffee } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="py-4 px-6 border-t border-neutral-200 bg-white">
      <div className="flex items-center justify-center gap-6 text-sm text-neutral-500">
        <a
          href="https://github.com/aldo-g/route-art"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-neutral-800 transition-colors"
        >
          <Github className="w-4 h-4" />
          GitHub
        </a>
        <a
          href="https://ko-fi.com/aligrant"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-neutral-800 transition-colors"
        >
          <Coffee className="w-4 h-4" />
          Buy me a coffee
        </a>
      </div>
    </footer>
  );
}
