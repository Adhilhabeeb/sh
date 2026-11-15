import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  Star,
} from 'lucide-react';
import type { PublicReviewSummary } from '../types/review';

interface SubmissionsLedgerProps {
  publicReviews: PublicReviewSummary[];
  loading: boolean;
  error: string | null;
  onStartNewReview: () => void;
}

type StatusFilter = 'all' | 'face_verified' | 'location_verified';

export const SubmissionsLedger: React.FC<SubmissionsLedgerProps> = ({
  publicReviews,
  loading,
  error,
  onStartNewReview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredPublic = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publicReviews.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.reviewerName.toLowerCase().includes(q) ||
        item.projectTitle.toLowerCase().includes(q) ||
        item.reviewNotes.toLowerCase().includes(q)
      );
    });
  }, [publicReviews, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    const total = publicReviews.length;
    const verified = publicReviews.filter((s) => s.status === 'face_verified').length;
    const pending = total - verified;
    return { total, verified, pending };
  }, [publicReviews]);

  return (
    <div className="space-y-6">
      {/* Header + Summary Metrics */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-500">
              Community &amp; Verified Feedback
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
              Customer Reviews &amp; Ratings
            </h2>
            <p className="text-sm text-stone-600">
              Authentic garment reviews from Atelier Veri customers.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartNewReview}
            className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            Write a Review
          </button>
        </div>

        {/* Flat 3-column summary metrics separated by hairline dividers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-stone-200 border border-stone-200 rounded-xl bg-stone-50/60">
          <div className="p-4">
            <span className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
              Total Reviews
            </span>
            <span className="mt-1 block text-2xl font-bold text-stone-900 font-mono tabular-nums">
              {counts.total}
            </span>
          </div>
          <div className="p-4">
            <span className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
              Verified Buyer Reviews
            </span>
            <span className="mt-1 block text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {counts.verified}
            </span>
          </div>
          <div className="p-4">
            <span className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
              Pending Photo Verification
            </span>
            <span className="mt-1 block text-2xl font-bold text-amber-700 font-mono tabular-nums">
              {counts.pending}
            </span>
          </div>
        </div>

        {/* Search + Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search garment, customer, or fit notes..."
              aria-label="Search reviews"
              className="w-full h-10 pl-10 pr-3.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900"
            />
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 bg-stone-100 rounded-lg self-start"
            role="tablist"
            aria-label="Filter reviews by verification status"
          >
            {(
              [
                { key: 'all', label: 'All Reviews' },
                { key: 'face_verified', label: 'Verified Buyers' },
                { key: 'location_verified', label: 'Pending Photo' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* Public Community Reviews Feed */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3" aria-busy="true">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-16 bg-stone-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filteredPublic.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-stone-800">
              {publicReviews.length === 0
                ? 'No customer reviews published yet.'
                : 'No reviews match your current search or filter.'}
            </p>
            <p className="text-xs text-stone-500">
              {publicReviews.length === 0
                ? 'Be the first to review a garment above — no account sign-in needed.'
                : 'Clear the search query or switch the filter to All Reviews.'}
            </p>
            {publicReviews.length === 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onStartNewReview}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Write First Review
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredPublic.map((item) => (
              <article
                key={item.id}
                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-stone-50/50 transition-colors"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-stone-900 text-sm">
                      {item.reviewerName}
                    </span>
                    <span className="text-stone-300" aria-hidden="true">·</span>
                    <span className="text-xs font-medium text-stone-700">
                      {item.projectTitle}
                    </span>
                    <span className="text-stone-300" aria-hidden="true">·</span>
                    <span className="font-mono text-[11px] text-stone-400">
                      {new Date(item.createdAtMs).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < item.rating
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 text-xs font-mono font-semibold text-stone-700">
                      {item.rating}/5
                    </span>
                  </div>

                  {item.reviewNotes && (
                    <p className="text-sm text-stone-600 leading-relaxed pt-1">
                      "{item.reviewNotes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start">
                  {item.status === 'face_verified' ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Verified Buyer</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Pending Photo</span>
                    </div>
                  )}

                  {item.driveWebViewLink && (
                    <a
                      href={item.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors"
                    >
                      <span>Drive Photo</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
