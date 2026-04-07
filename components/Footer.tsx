'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="py-6 px-6 border-t border-neutral-200 bg-white">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Contour Map Studio
        </p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="text-xs text-neutral-400 hover:text-neutral-600 min-h-[44px] inline-flex items-center">Privacy</Link>
          <Link href="/terms" className="text-xs text-neutral-400 hover:text-neutral-600 min-h-[44px] inline-flex items-center">Terms</Link>
          <Link href="/returns" className="text-xs text-neutral-400 hover:text-neutral-600 min-h-[44px] inline-flex items-center">Returns</Link>
        </nav>
      </div>
    </footer>
  );
}
