'use client';

import { ArrowLeft, ShoppingCart } from 'lucide-react';
import ContourPattern from './ContourPattern';
import { useCart } from '@/components/cart/CartProvider';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
  onCtaClick?: () => void;
}

export default function Header({ showBackButton = false, onBack, onCtaClick }: HeaderProps) {
  const { count, setCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-50 relative border-b-2 border-ink bg-paper overflow-hidden">
      <ContourPattern />
      <div className="relative z-10 flex items-center justify-between gap-4 px-5 py-3 sm:px-8 sm:py-[18px]">
        <div className="flex items-center gap-4">
          {showBackButton && onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-2 min-h-[44px] px-2 text-[12px] tracking-[0.08em] uppercase text-muted hover:text-accent transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                New route
              </button>
              <div className="h-5 w-px bg-divider" />
            </>
          )}
          <span className="text-[17px] font-bold tracking-[-0.01em]">Contour Map Studio</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <a
            href="#examples"
            className="hidden md:inline text-[13px] tracking-[0.08em] uppercase text-muted hover:text-accent transition-colors"
          >
            Iconic routes
          </a>
          <a
            href="#how-it-works"
            className="hidden md:inline text-[13px] tracking-[0.08em] uppercase text-muted hover:text-accent transition-colors"
          >
            How it works
          </a>
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center text-ink hover:text-accent transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
          {onCtaClick && (
            <button
              onClick={onCtaClick}
              className="hidden sm:block px-[18px] py-3 min-h-[44px] bg-accent text-white text-[13px] font-semibold tracking-[0.04em] uppercase hover:bg-accent-700 transition-colors"
            >
              Create poster
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
