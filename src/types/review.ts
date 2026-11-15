export type SubmissionStatus = 'location_verified' | 'face_verified';

export const BLUEPRINT_LIMITS = {
  reviewerNameMin: 2,
  reviewerNameMax: 100,
  emailMin: 5,
  emailMax: 160,
  phoneMin: 7,
  phoneMax: 20,
  projectTitleMin: 2,
  projectTitleMax: 140,
  reviewNotesMax: 2000,
} as const;

export const BLUEPRINT_PATTERNS = {
  id: /^[a-zA-Z0-9_-]+$/,
  email: /^[^ @]+@[^ @]+\.[^ @]+$/,
  phone: /^\+?[0-9 ()+-]{7,20}$/,
} as const;

export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtIso: string;
}

export interface FaceVerificationPayload {
  passed: boolean;
  method: string;
  livenessScore: number;
  summary: string;
  verifiedAtIso: string;
}

export interface DriveFilePayload {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId: string;
  uploadedAtIso: string;
}

export interface ReviewSubmissionRecord {
  id: string;
  ownerUid: string;
  reviewerName: string;
  email: string;
  phone: string;
  projectTitle: string;
  rating: number;
  reviewNotes: string;
  status: SubmissionStatus;
  location: LocationPayload;
  faceVerification?: FaceVerificationPayload;
  driveFile?: DriveFilePayload;
  driveStatus?: 'uploaded' | 'local_only';
  hasLocalPhoto?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PublicReviewSummary {
  id: string;
  reviewerName: string;
  projectTitle: string;
  rating: number;
  reviewNotes: string;
  status: SubmissionStatus;
  hasPhoto: boolean;
  driveWebViewLink?: string;
  createdAtMs: number;
}
