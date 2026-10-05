'use client';

import React from 'react';
import Link from 'next/link';
import { BUSINESS, formatBusinessAddress } from '@/config/business';

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-paper px-6 py-5 sm:px-8">
      <div className="max-w-[1180px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-[13px] text-faint text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} {BUSINESS.tradingName}</p>
          <p className="text-[11px] mt-0.5">
            {BUSINESS.legalName}, {formatBusinessAddress()}
            {BUSINESS.vatNumber && <> &middot; VAT {BUSINESS.vatNumber}</>}
          </p>
        </div>
        <nav className="flex gap-6">
          <Link href="/privacy" className="text-[13px] tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors min-h-[44px] inline-flex items-center">Privacy</Link>
          <Link href="/terms" className="text-[13px] tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors min-h-[44px] inline-flex items-center">Terms</Link>
          <Link href="/returns" className="text-[13px] tracking-[0.06em] uppercase text-muted hover:text-accent transition-colors min-h-[44px] inline-flex items-center">Returns</Link>
        </nav>
      </div>
    </footer>
  );
}
