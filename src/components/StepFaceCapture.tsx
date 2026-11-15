import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import type {
  FaceVerificationPayload,
  ReviewSubmissionRecord,
} from '../types/review';
import {
  analyzeCapturedSelfie,
  type FaceAnalysisResult,
} from '../lib/faceVerification';

interface StepFaceCaptureProps {
  submission: ReviewSubmissionRecord;
  onCompleteVerification: (
    submissionId: string,
    faceVerification: FaceVerificationPayload,
    imageBlob: Blob,
    capturedPreviewUrl: string
  ) => Promise<void>;
  onBack?: () => void;
}

export const StepFaceCapture: React.FC<StepFaceCaptureProps> = ({
  submission,
  onCompleteVerification,
  onBack,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<
    'starting' | 'ready' | 'error' | 'captured'
  >('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FaceAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraState('starting');
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('ready');
    } catch (err) {
      setCameraState('error');
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow selfie camera access in your browser settings and click Retry Camera.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No front-facing camera was found on this device.'
          : 'Unable to open the camera. Check if another app is using it and retry.';
      setCameraError(msg);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  const handleCaptureSelfie = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera stream is still warming up. Wait a moment and try again.');
      return;
    }

    setAnalyzing(true);
    setUploadError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not initialize capture canvas.');
      }

      // Mirror horizontally to match the natural preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to encode image.'));
          },
          'image/jpeg',
          0.9
        );
      });

      const result = await analyzeCapturedSelfie(canvas);
      const previewUrl = URL.createObjectURL(blob);

      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }

      setCapturedBlob(blob);
      setCapturedPreviewUrl(previewUrl);
      setAnalysis(result);
      setCameraState('captured');
      stopCamera();
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Failed to capture and analyze photo.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedBlob(null);
    setCapturedPreviewUrl(null);
    setAnalysis(null);
    setUploadError(null);
    void startCamera();
  };

  const handleUploadAndComplete = async () => {
    if (!capturedBlob || !capturedPreviewUrl || !analysis?.passed || !analysis.payload) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await onCompleteVerification(
        submission.id,
        analysis.payload,
        capturedBlob,
        capturedPreviewUrl
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Could not complete verification. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-100 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-stone-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Verified Customer Badge</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display text-balance">
            Customer Fit &amp; Photo Verification
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Take a quick verification photo to authenticate your review for{' '}
            <span className="font-semibold text-stone-900">{submission.projectTitle}</span>. Verified buyer photos help other shoppers gauge sizing and fit accuracy.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-stone-900 cursor-pointer shrink-0 self-start py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Edit Review Details</span>
          </button>
        )}
      </div>

      {/* Camera / Captured Preview Viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-950 border border-stone-300 flex items-center justify-center">
        {cameraState !== 'captured' ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover -scale-x-100 ${
                cameraState === 'ready' ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-200`}
            />

            {cameraState === 'ready' && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-48 h-64 sm:w-56 sm:h-72 rounded-[50%] border-2 border-dashed border-white/75 shadow-[0_0_0_9999px_rgba(28,25,23,0.4)]" />
                <span className="absolute bottom-4 px-3 py-1 rounded-full bg-stone-900/80 text-xs font-medium text-white tracking-wide">
                  Align face within guide
                </span>
              </div>
            )}

            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-200 p-6 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-stone-400" aria-hidden="true" />
                <p className="text-sm font-medium">Opening camera for fit check...</p>
              </div>
            )}

            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-stone-100 p-6 text-center max-w-md mx-auto">
                <div className="w-11 h-11 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-red-300" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Camera Access Needed</p>
                  <p className="text-xs text-stone-300 leading-relaxed">{cameraError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}
          </>
        ) : (
          capturedPreviewUrl && (
            <img
              src={capturedPreviewUrl}
              alt="Captured customer fit"
              className="w-full h-full object-cover"
            />
          )
        )}
      </div>

      {/* Camera Action Bar */}
      {cameraState !== 'captured' && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-stone-500">
            Verification analysis is processed securely in your browser.
          </p>
          <button
            type="button"
            onClick={() => void handleCaptureSelfie()}
            disabled={cameraState !== 'ready' || analyzing}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Verifying Fit Photo...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Capture Verification Photo</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Face Verification Result Panel */}
      {cameraState === 'captured' && analysis && (
        <div className="space-y-5">
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              analysis.passed
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-red-200 bg-red-50/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {analysis.passed ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    {analysis.passed
                      ? 'Verified Buyer Photo Check Passed'
                      : 'Photo Verification Incomplete — Retake Required'}
                  </h3>
                  <p className="text-xs text-stone-600">{analysis.summary}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-stone-800 shrink-0">
                {analysis.score}/100 Match
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-stone-200/70">
              {analysis.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="bg-white/90 border border-stone-200 rounded-lg p-2.5 space-y-0.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                    {metric.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
                    )}
                    <span>{metric.label}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
            >
              <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleRetake}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Retake Photo</span>
            </button>

            <button
              type="button"
              onClick={() => void handleUploadAndComplete()}
              disabled={!analysis.passed || uploading}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Publishing Review...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Publish Customer Review</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
