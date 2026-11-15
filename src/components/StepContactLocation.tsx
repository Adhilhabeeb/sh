import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Star,
  ArrowRight,
  Loader2,
  Tag,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  type LocationPayload,
} from '../types/review';
import { validateContactAndReview } from '../lib/submissions';

export interface Step1FormState {
  reviewerName: string;
  email: string;
  phone: string;
  projectTitle: string;
  rating: number;
  reviewNotes: string;
}

interface StepContactLocationProps {
  isSubmitting: boolean;
  submitError: string | null;
  selectedGarment?: string;
  onSubmitStep1: (form: Step1FormState, location: LocationPayload) => Promise<void>;
  onLocationChange?: (location: LocationPayload | null) => void;
  onFormValidityChange?: (isValid: boolean) => void;
}

const POPULAR_GARMENTS = [
  'Oversized Heavyweight Hoodie',
  'Pleated Linen Camp Collar Shirt',
  'Tailored Straight-Leg Trousers',
  'Structured Denim Trucker Jacket',
  'Minimalist Boxy Heavy Tee',
  'Relaxed Wool Trench Overcoat',
];

const RATING_DESCRIPTIONS = [
  '',
  '1/5 · Poor Fit & Quality',
  '2/5 · Below Expectations',
  '3/5 · Standard Quality',
  '4/5 · Great Style & Comfort',
  '5/5 · Exceptional Fit & Luxury Feel',
];

export const StepContactLocation: React.FC<StepContactLocationProps> = ({
  isSubmitting,
  submitError,
  selectedGarment,
  onSubmitStep1,
  onLocationChange,
  onFormValidityChange,
}) => {
  const [form, setForm] = useState<Step1FormState>({
    reviewerName: '',
    email: '',
    phone: '',
    projectTitle: selectedGarment || '',
    rating: 5,
    reviewNotes: '',
  });

  const [location, setLocation] = useState<LocationPayload | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locPermissionState, setLocPermissionState] = useState<
    'idle' | 'granted' | 'denied'
  >('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update garment if selected from catalog
  useEffect(() => {
    if (selectedGarment) {
      setForm((prev) => ({
        ...prev,
        projectTitle: selectedGarment,
      }));
    }
  }, [selectedGarment]);

  // Check if browser already granted geolocation permission earlier
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state === 'denied') {
            setLocPermissionState('denied');
          }
        })
        .catch(() => {
          // Ignore browsers without permissions.query support
        });
    }
  }, []);

  useEffect(() => {
    const err = validateContactAndReview(form);
    onFormValidityChange?.(err === null);
  }, [form, onFormValidityChange]);

  const handleRequestLocation = () => {
    setLocError(null);
    if (!('geolocation' in navigator)) {
      setLocError('Geolocation is not supported by your browser.');
      setLocPermissionState('denied');
      return;
    }

    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: LocationPayload = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(position.coords.accuracy || 0),
          capturedAtIso: new Date(position.timestamp || Date.now()).toISOString(),
        };
        setLocation(nextLocation);
        setLocPermissionState('granted');
        setLocLoading(false);
        onLocationChange?.(nextLocation);
      },
      (err) => {
        setLocLoading(false);
        setLocation(null);
        onLocationChange?.(null);
        if (err.code === err.PERMISSION_DENIED) {
          setLocPermissionState('denied');
          setLocError(
            'Location access was denied. Please allow location access in your browser settings and click Retry.'
          );
        } else if (err.code === err.TIMEOUT) {
          setLocError('Location check timed out. Please retry.');
        } else {
          setLocError('Unable to determine location. Please check device GPS and retry.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const err = validateContactAndReview(form);
    if (err) {
      setValidationError(err);
      return;
    }

    if (!location) {
      setValidationError(
        'Store or delivery location verification is required before your review can be submitted.'
      );
      return;
    }

    await onSubmitStep1(form, location);
  };

  const activeError = validationError || submitError;

  return (
    <form
      onSubmit={handleFormSubmit}
      className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm"
      noValidate
    >
      <div className="space-y-1.5 border-b border-stone-100 pb-5">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-500">
          Client Fitting &amp; Experience
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display text-balance">
          Write a Verified Customer Review
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          Share your experience regarding garment fit, textile hand-feel, and craftsmanship. Verified location check-in confirms authentic client feedback.
        </p>
      </div>

      {/* Garment Selection & Rating */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="projectTitle"
            className="block text-sm font-semibold text-stone-800 mb-1.5"
          >
            Garment / Apparel Item Reviewed <span className="text-red-600">*</span>
          </label>
          <input
            id="projectTitle"
            type="text"
            required
            maxLength={BLUEPRINT_LIMITS.projectTitleMax}
            value={form.projectTitle}
            onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
            placeholder="e.g., Oversized Heavyweight Hoodie - Oatmeal"
            className="w-full h-11 px-3.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors"
          />

          {/* Quick Garment Pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-stone-400 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Quick Select:
            </span>
            {POPULAR_GARMENTS.map((garment) => (
              <button
                key={garment}
                type="button"
                onClick={() => setForm({ ...form, projectTitle: garment })}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  form.projectTitle === garment
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {garment}
              </button>
            ))}
          </div>
        </div>

        {/* Rating & Fit Quality */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-sm font-semibold text-stone-800">
              Garment Score &amp; Fit Quality <span className="text-red-600">*</span>
            </span>
            <span className="text-xs font-medium text-amber-700">
              {RATING_DESCRIPTIONS[form.rating]}
            </span>
          </div>

          <div
            className="h-12 px-4 rounded-lg border border-stone-300 bg-stone-50 flex items-center justify-between"
            role="group"
            aria-label="Garment Rating out of 5"
          >
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm({ ...form, rating: star })}
                  aria-label={`Rate ${star} out of 5 stars`}
                  className="p-1 rounded focus-visible:outline-2 focus-visible:outline-stone-900 cursor-pointer transition-transform hover:scale-115"
                >
                  <Star
                    className={`w-5 h-5 ${
                      star <= form.rating
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-stone-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-stone-800">
              {form.rating} / 5
            </span>
          </div>
        </div>

        {/* Review Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="reviewNotes"
              className="block text-sm font-semibold text-stone-800"
            >
              Fit &amp; Material Review Notes
            </label>
            <span className="text-xs font-mono tabular-nums text-stone-400">
              {form.reviewNotes.length}/{BLUEPRINT_LIMITS.reviewNotesMax}
            </span>
          </div>
          <textarea
            id="reviewNotes"
            rows={3}
            maxLength={BLUEPRINT_LIMITS.reviewNotesMax}
            value={form.reviewNotes}
            onChange={(e) => setForm({ ...form, reviewNotes: e.target.value })}
            placeholder="Describe the silhouette (true to size, oversized, fitted), fabric weight, texture, drape, and everyday comfort..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors resize-y"
          />
        </div>
      </div>

      {/* Reviewer Details Grid */}
      <div className="pt-2 border-t border-stone-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Customer Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="reviewerName"
              className="block text-xs font-medium text-stone-700 mb-1"
            >
              Customer Full Name <span className="text-red-600">*</span>
            </label>
            <input
              id="reviewerName"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.reviewerNameMax}
              value={form.reviewerName}
              onChange={(e) => setForm({ ...form, reviewerName: e.target.value })}
              placeholder="e.g., Julian Vance"
              className="w-full h-10 px-3.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="reviewerEmail"
              className="block text-xs font-medium text-stone-700 mb-1"
            >
              Email Address <span className="text-red-600">*</span>
            </label>
            <input
              id="reviewerEmail"
              type="email"
              required
              maxLength={BLUEPRINT_LIMITS.emailMax}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="customer@email.com"
              className="w-full h-10 px-3.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="reviewerPhone"
              className="block text-xs font-medium text-stone-700 mb-1"
            >
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              id="reviewerPhone"
              type="tel"
              required
              maxLength={BLUEPRINT_LIMITS.phoneMax}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 234-5678"
              className="w-full h-10 px-3.5 rounded-lg border border-stone-300 bg-white text-sm font-mono text-stone-900 placeholder:text-stone-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Store / Delivery Location Check-in */}
      <div className="pt-2 border-t border-stone-100">
        <div
          className={`rounded-xl border p-4 sm:p-5 transition-colors ${
            location
              ? 'border-emerald-300 bg-emerald-50/40'
              : locError
              ? 'border-red-200 bg-red-50/40'
              : 'border-stone-200 bg-stone-50'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                  location
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : locError
                    ? 'bg-red-100 border-red-200 text-red-700'
                    : 'bg-white border-stone-200 text-stone-700'
                }`}
              >
                {location ? (
                  <CheckCircle2 className="w-4.5 h-4.5" aria-hidden="true" />
                ) : (
                  <MapPin className="w-4.5 h-4.5" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-stone-900">
                  {location
                    ? 'Verified Purchase Check-in Confirmed'
                    : 'Store / Delivery Check-in Verification'}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {location
                    ? 'Location coordinates confirmed for your authentic customer review.'
                    : 'Confirm your location coordinates to authenticate genuine customer feedback.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestLocation}
              disabled={locLoading}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                location
                  ? 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                  : 'bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60'
              }`}
            >
              {locLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Checking Location...</span>
                </>
              ) : (
                <>
                  <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {location
                      ? 'Refresh Check-in'
                      : locPermissionState === 'denied'
                      ? 'Retry Location'
                      : 'Verify Check-in Location'}
                  </span>
                </>
              )}
            </button>
          </div>

          {location && (
            <div className="mt-3 pt-3 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-stone-500">Latitude</span>
                <span className="font-mono tabular-nums font-medium text-stone-900">
                  {location.latitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span className="block text-stone-500">Longitude</span>
                <span className="font-mono tabular-nums font-medium text-stone-900">
                  {location.longitude.toFixed(6)}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="block text-stone-500">Check-in Accuracy</span>
                <span className="font-mono tabular-nums font-medium text-stone-900">
                  ±{location.accuracyMeters} m
                </span>
              </div>
            </div>
          )}

          {locError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{locError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Validation / Submission Error */}
      {activeError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
        >
          <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Primary Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-stone-500">
          Next: take a quick verification photo — no Google sign-in required.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || !location}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Submitting Review...</span>
            </>
          ) : (
            <>
              <span>Continue to Photo Verification</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
