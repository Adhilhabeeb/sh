import { useCallback, useEffect, useState } from 'react';
import {
  completeGuestFaceVerification,
  createGuestLocationSubmission,
  fetchPublicReviews,
} from './lib/submissions';
import type {
  FaceVerificationPayload,
  LocationPayload,
  PublicReviewSummary,
  ReviewSubmissionRecord,
} from './types/review';
import { TopBar, type NavSection } from './components/TopBar';
import { ClothingCatalog } from './components/ClothingCatalog';
import {
  StepContactLocation,
  type Step1FormState,
} from './components/StepContactLocation';
import { StepFaceCapture } from './components/StepFaceCapture';
import { StepCompletionReceipt } from './components/StepCompletionReceipt';
import { SubmissionsLedger } from './components/SubmissionsLedger';
import { Check, ShieldCheck, Sparkles, Truck } from 'lucide-react';

export default function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedGarment, setSelectedGarment] = useState<string>('');

  // Step 1 tracking
  const [, setIsStep1Valid] = useState(false);
  const [, setStep1Location] = useState<LocationPayload | null>(null);
  const [step1Submitting, setStep1Submitting] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Active submission being verified
  const [activeSubmission, setActiveSubmission] =
    useState<ReviewSubmissionRecord | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Public community reviews (no sign-in required)
  const [publicReviews, setPublicReviews] = useState<PublicReviewSummary[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  const loadPublicReviews = useCallback(async () => {
    try {
      setPublicError(null);
      const items = await fetchPublicReviews();
      setPublicReviews(items);
    } catch (err) {
      setPublicError(
        err instanceof Error ? err.message : 'Unable to load customer reviews.'
      );
    } finally {
      setPublicLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicReviews();
  }, [loadPublicReviews]);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const handleNavigate = useCallback((section: NavSection) => {
    const target = document.getElementById(section);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleSelectGarmentForReview = useCallback((garmentName: string) => {
    setSelectedGarment(garmentName);
    setCurrentStep(1);
    handleNavigate('submit');
  }, [handleNavigate]);

  const handleSubmitStep1 = async (
    form: Step1FormState,
    location: LocationPayload
  ) => {
    setStep1Submitting(true);
    setStep1Error(null);

    try {
      const created = await createGuestLocationSubmission({
        reviewerName: form.reviewerName,
        email: form.email,
        phone: form.phone,
        projectTitle: form.projectTitle,
        rating: form.rating,
        reviewNotes: form.reviewNotes,
        location,
      });

      setActiveSubmission(created);
      setCurrentStep(2);
      void loadPublicReviews();
      handleNavigate('submit');
    } catch (err) {
      setStep1Error(
        err instanceof Error
          ? err.message
          : 'Could not record your review. Please retry.'
      );
    } finally {
      setStep1Submitting(false);
    }
  };

  const handleCompleteVerification = async (
    submissionId: string,
    faceVerification: FaceVerificationPayload,
    imageBlob: Blob,
    capturedPreviewUrl: string
  ) => {
    const updated = await completeGuestFaceVerification(
      submissionId,
      faceVerification,
      imageBlob
    );

    try {
      const resp = await fetch(capturedPreviewUrl);
      const blob = await resp.blob();
      const clonedUrl = URL.createObjectURL(blob);
      setReceiptPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return clonedUrl;
      });
    } catch {
      // Non-fatal
    }

    setActiveSubmission(updated);
    setCurrentStep(3);
    void loadPublicReviews();
    handleNavigate('submit');
  };

  const handleStartNewReview = () => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptPreviewUrl(null);
    }
    setActiveSubmission(null);
    setStep1Location(null);
    setStep1Error(null);
    setSelectedGarment('');
    setCurrentStep(1);
    handleNavigate('submit');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-sans selection:bg-stone-900 selection:text-white">
      <TopBar onNavigate={handleNavigate} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-16">
        {/* Editorial Fashion Hero Banner */}
        <section className="relative rounded-3xl overflow-hidden bg-stone-900 text-white p-8 sm:p-14 lg:p-20 shadow-xl">
          {/* Subtle Ambient Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-900/90 to-stone-800/70" />
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80)',
            }}
          />

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wider uppercase text-stone-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Autumn / Winter 2026 Ready-to-Wear</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display leading-[1.1] text-balance">
              Refined Cuts. Heavyweight Textiles. Timeless Fit.
            </h1>

            <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-xl">
              Explore mindful garments crafted with organic materials. Every customer review is verified with authentic purchase check-in and style fit verification.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => handleNavigate('collection')}
                className="px-6 py-3 rounded-xl bg-white text-stone-950 text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-colors cursor-pointer shadow-md"
              >
                Explore Collection
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('submit')}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-colors cursor-pointer"
              >
                Write Customer Review
              </button>
            </div>

            {/* Fashion Perks Bar */}
            <div className="pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-300">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-stone-400 shrink-0" />
                <span>Express Worldwide Shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
                <span>Verified Buyer Reviews</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-stone-400 shrink-0" />
                <span>100% Organic Fibers</span>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Clothing Catalog */}
        <ClothingCatalog onSelectGarmentForReview={handleSelectGarmentForReview} />

        {/* Hairline Divider */}
        <div className="border-t border-stone-200" />

        {/* Review & Fitting Section */}
        <section id="submit" className="scroll-mt-24 max-w-3xl mx-auto w-full space-y-4">
          <div className="text-center space-y-2 mb-6">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-500">
              Customer Feedback &amp; Fit Check
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 font-display">
              Review Your Garment
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
              Selected a piece? Tell fellow clients about the drape, sizing, and material quality.
            </p>
          </div>

          {currentStep === 1 && (
            <StepContactLocation
              isSubmitting={step1Submitting}
              submitError={step1Error}
              selectedGarment={selectedGarment}
              onSubmitStep1={handleSubmitStep1}
              onLocationChange={setStep1Location}
              onFormValidityChange={setIsStep1Valid}
            />
          )}

          {currentStep === 2 && activeSubmission && (
            <StepFaceCapture
              submission={activeSubmission}
              onCompleteVerification={handleCompleteVerification}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && activeSubmission && (
            <StepCompletionReceipt
              submission={activeSubmission}
              previewUrl={receiptPreviewUrl}
              onStartNewReview={handleStartNewReview}
              onViewLedger={() => handleNavigate('records')}
            />
          )}
        </section>

        {/* Hairline Divider */}
        <div className="border-t border-stone-200" />

        {/* Customer Reviews & Community Feedback */}
        <section id="records" className="scroll-mt-24 space-y-6">
          <SubmissionsLedger
            publicReviews={publicReviews}
            loading={publicLoading}
            error={publicError}
            onStartNewReview={handleStartNewReview}
          />
        </section>
      </main>

      {/* Boutique Clothing Store Footer */}
      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-stone-600">
            <div className="space-y-2">
              <span className="text-sm font-bold tracking-widest uppercase text-stone-900 font-display">
                Atelier Veri
              </span>
              <p className="text-stone-500 leading-relaxed">
                Contemporary ready-to-wear engineered with organic textiles and architectural tailoring.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-semibold uppercase tracking-wider text-stone-900">
                Shop Location
              </span>
              <p className="text-stone-600 leading-relaxed">
                Near Varkala Beach, PPJJ+MJQ,
                <br />
                Varkala, Kerala 695141
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-semibold uppercase tracking-wider text-stone-900">
                Contact &amp; Care
              </span>
              <div className="space-y-1 text-stone-600">
                <p>
                  Email:{' '}
                  <a
                    href="mailto:alterveri@gmail.com"
                    className="font-medium text-stone-900 underline hover:text-stone-600 transition-colors"
                  >
                    alterveri@gmail.com
                  </a>
                </p>
                <p className="text-stone-500">Complimentary Shipping &amp; Returns</p>
                <p className="text-stone-500">Garment Sizing &amp; Fitting Guide</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold uppercase tracking-wider text-stone-900">
                Verified Reviews
              </span>
              <p className="text-stone-500 leading-relaxed">
                All client reviews are authenticated with verified location check-in and style photo confirmation.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-stone-400">
            <span>&copy; 2026 ATELIER VERI. All rights reserved.</span>
            <span>Single-Page Fashion Store &amp; Verified Review Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
