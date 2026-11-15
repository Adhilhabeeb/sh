import React from 'react';
import { ShoppingBag } from 'lucide-react';

export type NavSection = 'collection' | 'submit' | 'records';

interface TopBarProps {
  onNavigate: (section: NavSection) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onNavigate }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
      {/* Top Announcement Bar */}
      <div className="bg-stone-900 text-stone-200 text-[11px] py-1.5 px-4 text-center font-medium tracking-wider uppercase">
        <span>Complimentary worldwide express delivery on orders over $150 · Verified Customer Reviews</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('collection')}
          className="flex items-center gap-2 group cursor-pointer focus-visible:outline-2 focus-visible:outline-stone-900 rounded"
        >
          <ShoppingBag className="w-5 h-5 text-stone-900 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <span className="text-lg sm:text-xl font-bold tracking-[0.2em] uppercase text-stone-900 font-display">
              Atelier Veri
            </span>
          </div>
        </button>

        {/* Single-page Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wider uppercase" aria-label="Page Navigation">
          <button
            type="button"
            onClick={() => onNavigate('collection')}
            className="py-1.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            Collection
          </button>
          <button
            type="button"
            onClick={() => onNavigate('submit')}
            className="py-1.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            Write Review
          </button>
          <button
            type="button"
            onClick={() => onNavigate('records')}
            className="py-1.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            Customer Reviews
          </button>
        </nav>

        {/* Direct Review Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('submit')}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            Write Review
          </button>
        </div>
      </div>
    </header>
  );
};
