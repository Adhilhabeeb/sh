import type { FaceVerificationPayload } from '../types/review';

export interface FaceCheckMetric {
  label: string;
  passed: boolean;
  detail: string;
}

export interface FaceAnalysisResult {
  passed: boolean;
  score: number;
  method: string;
  summary: string;
  metrics: FaceCheckMetric[];
  payload?: FaceVerificationPayload;
}

interface NativeDetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: Array<{ type: string; locations: Array<{ x: number; y: number }> }>;
}

interface NativeFaceDetector {
  detect(image: ImageBitmapSource): Promise<NativeDetectedFace[]>;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: {
      fastMode?: boolean;
      maxDetectedFaces?: number;
    }) => NativeFaceDetector;
  }
}

export async function analyzeCapturedSelfie(
  canvas: HTMLCanvasElement
): Promise<FaceAnalysisResult> {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx || width === 0 || height === 0) {
    return {
      passed: false,
      score: 0,
      method: 'Canvas Inspection',
      summary: 'Camera frame buffer was empty. Please capture again.',
      metrics: [
        { label: 'Frame Buffer', passed: false, detail: 'No pixel data captured' },
      ],
    };
  }

  // Downsample to a fast 160x120 analysis buffer for deterministic pixel metrics
  const sampleW = 160;
  const sampleH = 120;
  const offscreen = document.createElement('canvas');
  offscreen.width = sampleW;
  offscreen.height = sampleH;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!offCtx) {
    throw new Error('Unable to initialize 2D analysis canvas.');
  }
  offCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const { data } = offCtx.getImageData(0, 0, sampleW, sampleH);

  let lumaSum = 0;
  let centerSkinPixels = 0;
  let centerPixels = 0;
  let centerEdgeEnergy = 0;
  let borderLumaSum = 0;
  let borderPixels = 0;
  let centerLumaSum = 0;

  const cx = sampleW / 2;
  const cy = sampleH * 0.48;
  const rx = sampleW * 0.24;
  const ry = sampleH * 0.34;

  const getLuma = (idx: number) =>
    0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = getLuma(idx);
      lumaSum += luma;

      const normDist = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (normDist <= 1) {
        centerPixels++;
        centerLumaSum += luma;

        // Broad YCbCr skin chrominance locus covering diverse skin tones
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        if (cb >= 75 && cb <= 132 && cr >= 131 && cr <= 178 && luma > 25) {
          centerSkinPixels++;
        }

        // Local gradient magnitude (detects eyes, brows, nose bridge, mouth detail)
        const rightLuma = getLuma(idx + 4);
        const downLuma = getLuma(idx + sampleW * 4);
        const grad = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma);
        if (grad > 14) {
          centerEdgeEnergy++;
        }
      } else {
        borderPixels++;
        borderLumaSum += luma;
      }
    }
  }

  const totalPixels = (sampleW - 2) * (sampleH - 2);
  const meanLuma = lumaSum / totalPixels;
  const centerSkinRatio = centerPixels > 0 ? centerSkinPixels / centerPixels : 0;
  const centerEdgeRatio = centerPixels > 0 ? centerEdgeEnergy / centerPixels : 0;
  const centerMeanLuma = centerPixels > 0 ? centerLumaSum / centerPixels : meanLuma;
  const borderMeanLuma = borderPixels > 0 ? borderLumaSum / borderPixels : meanLuma;
  const subjectSeparation = Math.abs(centerMeanLuma - borderMeanLuma);

  // Try native browser FaceDetector if available
  let nativeFaceDetected: boolean | null = null;
  let nativeFaceDetail = 'Browser FaceDetector unavailable; using portrait framing analyzer';

  if (typeof window !== 'undefined' && typeof window.FaceDetector === 'function') {
    try {
      const detector = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 3,
      });
      const faces = await detector.detect(canvas);
      if (faces.length === 1) {
        const box = faces[0].boundingBox;
        const areaRatio = (box.width * box.height) / (width * height);
        nativeFaceDetected = areaRatio >= 0.04;
        nativeFaceDetail = nativeFaceDetected
          ? `1 face detected (${Math.round(areaRatio * 100)}% of frame)`
          : 'Face appears too far from camera — move closer';
      } else if (faces.length > 1) {
        nativeFaceDetected = false;
        nativeFaceDetail = `${faces.length} faces detected — only the single reviewer should appear`;
      } else {
        nativeFaceDetected = false;
        nativeFaceDetail = 'No face bounding box detected in frame';
      }
    } catch {
      nativeFaceDetected = null;
    }
  }

  const exposurePassed = meanLuma >= 30 && meanLuma <= 238;
  const framingPassed =
    nativeFaceDetected !== null
      ? nativeFaceDetected
      : centerSkinRatio >= 0.16 && (centerEdgeRatio >= 0.08 || subjectSeparation >= 6);
  const detailPassed = centerEdgeRatio >= 0.06;

  const metrics: FaceCheckMetric[] = [
    {
      label: 'Lighting & Exposure',
      passed: exposurePassed,
      detail: exposurePassed
        ? `Balanced frame luminance (${Math.round(meanLuma)}/255)`
        : meanLuma < 30
        ? 'Frame too dark or lens covered'
        : 'Frame overexposed — reduce direct glare',
    },
    {
      label: 'Face Detection & Framing',
      passed: framingPassed,
      detail:
        nativeFaceDetected !== null
          ? nativeFaceDetail
          : framingPassed
          ? `Subject centered in guide (${Math.round(centerSkinRatio * 100)}% facial zone match)`
          : 'Center your face clearly inside the oval guide',
    },
    {
      label: 'Feature Clarity',
      passed: detailPassed,
      detail: detailPassed
        ? `Clear facial contrast (${Math.round(centerEdgeRatio * 100)}% detail density)`
        : 'Image lacks facial detail or is obstructed',
    },
  ];

  // Compute deterministic verification confidence score (0 - 100)
  let rawScore = 0;
  if (exposurePassed) rawScore += 30;
  if (detailPassed) rawScore += Math.min(30, Math.round(centerEdgeRatio * 180));
  if (nativeFaceDetected === true) {
    rawScore += 40;
  } else if (nativeFaceDetected === null && framingPassed) {
    rawScore += Math.min(40, Math.round(centerSkinRatio * 90) + 15);
  }
  const score = Math.max(0, Math.min(99, rawScore));

  const passed =
    exposurePassed &&
    framingPassed &&
    detailPassed &&
    score >= 65;

  const method =
    nativeFaceDetected !== null
      ? 'Native FaceDetector + Luminance Audit'
      : 'Portrait Framing & Contrast Audit';

  const summary = passed
    ? `Selfie verified (${score}% confidence) via ${method}.`
    : metrics.find((m) => !m.passed)?.detail ||
      'Unable to confirm a clear centered face. Adjust lighting and retake.';

  return {
    passed,
    score,
    method,
    summary,
    metrics,
    payload: passed
      ? {
          passed: true,
          method: method.slice(0, 60),
          livenessScore: score,
          summary: summary.slice(0, 300),
          verifiedAtIso: new Date().toISOString(),
        }
      : undefined,
  };
}
