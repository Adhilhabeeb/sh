import React from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Camera,
  MapPin,
  Plus,
  Table2,
  Sparkles,
} from 'lucide-react';
import type { ReviewSubmissionRecord } from '../types/review';

interface StepCompletionReceiptProps {
  submission: ReviewSubmissionRecord;
  previewUrl: string | null;
  onStartNewReview: () => void;
  onViewLedger: () => void;
}

export const StepCompletionReceipt: React.FC<StepCompletionReceiptProps> = ({
  submission,
  previewUrl,
  onStartNewReview,
  onViewLedger,
}) => {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="flex items-start gap-3.5 border-b border-stone-100 pb-5">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-emerald-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verified Buyer Review Published</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display text-balance">
            Thank You for Your Feedback
          </h2>
          <p className="text-sm text-stone-600">
            Your review for <span className="font-semibold text-stone-900">{submission.projectTitle}</span> has been authenticated and published to the customer community.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-5 space-y-3">
          <div className="aspect-[4/5] rounded-xl overflow-hidden border border-stone-200 bg-stone-100 flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Verified customer ${submission.reviewerName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4 space-y-1.5 text-stone-500">
                <Camera className="w-7 h-7 mx-auto text-stone-400" aria-hidden="true" />
                <p className="text-xs">Verified Fit Photo</p>
              </div>
            )}
          </div>

          {submission.driveFile?.webViewLink ? (
            <a
              href={submission.driveFile.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>View Photo in Google Drive</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : (
            submission.driveStatus === 'local_only' && (
              <p className="text-[11px] text-stone-500 text-center px-2">
                Saved to store verification archive (add server Drive credentials in .env to sync to Google Drive).
              </p>
            )
          )}
        </div>

        <dl className="md:col-span-7 divide-y divide-stone-100 border border-stone-200 rounded-xl bg-stone-50/60 text-sm">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <dt className="text-stone-500 text-xs">Review Reference</dt>
            <dd className="font-mono text-xs text-stone-900 truncate max-w-[220px]">
              {submission.id}
            </dd>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <dt className="text-stone-500 text-xs">Customer</dt>
            <dd className="font-medium text-stone-900 text-right">
              {submission.reviewerName}
            </dd>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <dt className="text-stone-500 text-xs">Contact</dt>
            <dd className="text-stone-800 text-right text-xs">
              <span>{submission.email}</span>
              <span className="mx-1.5 text-stone-300">·</span>
              <span className="font-mono">{submission.phone}</span>
            </dd>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <dt className="text-stone-500 text-xs">Garment &amp; Score</dt>
            <dd className="text-stone-900 font-semibold text-right">
              {submission.projectTitle} · <span className="text-amber-600 font-bold">{submission.rating}/5 ★</span>
            </dd>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <dt className="text-stone-500 text-xs inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
              <span>Verified Check-in</span>
            </dt>
            <dd className="font-mono text-xs tabular-nums text-stone-900">
              {submission.location.latitude.toFixed(4)},{' '}
              {submission.location.longitude.toFixed(4)}
            </dd>
          </div>
          {submission.faceVerification && (
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <dt className="text-stone-500 text-xs">Buyer Status</dt>
              <dd className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Buyer Photo</span>
              </dd>
            </div>
          )}
          {submission.reviewNotes && (
            <div className="px-4 py-3 space-y-1">
              <dt className="text-stone-500 text-xs">Customer Notes</dt>
              <dd className="text-xs text-stone-700 italic leading-relaxed">
                "{submission.reviewNotes}"
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100">
        <button
          type="button"
          onClick={onViewLedger}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <Table2 className="w-4 h-4" aria-hidden="true" />
          <span>Browse Community Reviews</span>
        </button>

        <button
          type="button"
          onClick={onStartNewReview}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Review Another Garment</span>
        </button>
      </div>
    </div>
  );
};
