import {
  BLUEPRINT_LIMITS,
  BLUEPRINT_PATTERNS,
  type FaceVerificationPayload,
  type LocationPayload,
  type PublicReviewSummary,
  type ReviewSubmissionRecord,
} from '../types/review';

// In-memory receipt tokens for guest submissions made in the current browser session
const guestReceiptTokens = new Map<string, string>();

export interface CreateSubmissionInput {
  reviewerName: string;
  email: string;
  phone: string;
  projectTitle: string;
  rating: number;
  reviewNotes: string;
  location: LocationPayload;
}

export function validateContactAndReview(
  input: Omit<CreateSubmissionInput, 'location'>
): string | null {
  const name = input.reviewerName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const title = input.projectTitle.trim();
  const notes = input.reviewNotes.trim();

  if (
    name.length < BLUEPRINT_LIMITS.reviewerNameMin ||
    name.length > BLUEPRINT_LIMITS.reviewerNameMax
  ) {
    return `Reviewer name must be between ${BLUEPRINT_LIMITS.reviewerNameMin} and ${BLUEPRINT_LIMITS.reviewerNameMax} characters.`;
  }
  if (
    email.length < BLUEPRINT_LIMITS.emailMin ||
    email.length > BLUEPRINT_LIMITS.emailMax ||
    !BLUEPRINT_PATTERNS.email.test(email)
  ) {
    return 'Please enter a valid email address.';
  }
  if (
    phone.length < BLUEPRINT_LIMITS.phoneMin ||
    phone.length > BLUEPRINT_LIMITS.phoneMax ||
    !BLUEPRINT_PATTERNS.phone.test(phone)
  ) {
    return 'Please enter a valid phone number (7 to 20 digits/characters).';
  }
  if (
    title.length < BLUEPRINT_LIMITS.projectTitleMin ||
    title.length > BLUEPRINT_LIMITS.projectTitleMax
  ) {
    return `Project title must be between ${BLUEPRINT_LIMITS.projectTitleMin} and ${BLUEPRINT_LIMITS.projectTitleMax} characters.`;
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return 'Project rating must be a whole number from 1 to 5.';
  }
  if (notes.length > BLUEPRINT_LIMITS.reviewNotesMax) {
    return `Review notes must be at most ${BLUEPRINT_LIMITS.reviewNotesMax} characters.`;
  }
  return null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode captured image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read captured image.'));
    reader.readAsDataURL(blob);
  });
}

// Step 1: submit contact, review, and check-in location to backend without login
export async function createGuestLocationSubmission(
  input: CreateSubmissionInput
): Promise<ReviewSubmissionRecord> {
  const validationError = validateContactAndReview(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as {
    submission?: ReviewSubmissionRecord;
    receiptToken?: string;
    error?: string;
  };

  if (!res.ok || !data.submission) {
    throw new Error(data.error || `Could not submit review (${res.status}).`);
  }

  if (data.receiptToken) {
    guestReceiptTokens.set(data.submission.id, data.receiptToken);
  }

  return data.submission;
}

// Step 2: upload verification selfie to backend (and Drive if configured) without login
export async function completeGuestFaceVerification(
  submissionId: string,
  faceVerification: FaceVerificationPayload,
  imageBlob: Blob
): Promise<ReviewSubmissionRecord> {
  const imageBase64 = await blobToBase64(imageBlob);
  const receiptToken = guestReceiptTokens.get(submissionId);

  const res = await fetch(`/api/reviews/${encodeURIComponent(submissionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiptToken,
      imageBase64,
      faceVerification,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    submission?: ReviewSubmissionRecord;
    error?: string;
  };

  if (!res.ok || !data.submission) {
    throw new Error(data.error || `Could not complete photo verification (${res.status}).`);
  }

  return data.submission;
}

export async function fetchPublicReviews(): Promise<PublicReviewSummary[]> {
  const res = await fetch('/api/reviews/public');
  if (!res.ok) {
    throw new Error(`Unable to load community reviews (${res.status}).`);
  }
  const data = (await res.json()) as { reviews?: PublicReviewSummary[] };
  return data.reviews || [];
}
