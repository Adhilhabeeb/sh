import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'adhilhabeeb960571@gmail.com';
const DRIVE_FOLDER_NAME = 'Atelier Veri Verified Selfies';
const DATA_DIR = path.join(__dirname, '.data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

const firebaseConfig: FirebaseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
);

interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtIso: string;
}

interface FaceVerificationPayload {
  passed: boolean;
  method: string;
  livenessScore: number;
  summary: string;
  verifiedAtIso: string;
}

interface DriveFilePayload {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId: string;
  uploadedAtIso: string;
}

interface StoredReviewRecord {
  id: string;
  ownerUid: string;
  receiptTokenHash: string;
  reviewerName: string;
  email: string;
  phone: string;
  projectTitle: string;
  rating: number;
  reviewNotes: string;
  status: 'location_verified' | 'face_verified';
  location: LocationPayload;
  faceVerification?: FaceVerificationPayload;
  driveFile?: DriveFilePayload;
  driveStatus?: 'uploaded' | 'local_only';
  hasLocalPhoto?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  project_id?: string;
}

const LIMITS = {
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

const PATTERNS = {
  id: /^[a-zA-Z0-9_-]+$/,
  email: /^[^ @]+@[^ @]+\.[^ @]+$/,
  phone: /^\+?[0-9 ()+-]{7,20}$/,
} as const;

// Simple serialized write queue to prevent concurrent JSON file corruption
let writeQueue: Promise<void> = Promise.resolve();

async function ensureStorageDirs(): Promise<void> {
  await fsp.mkdir(PHOTOS_DIR, { recursive: true });
}

async function readStoredReviews(): Promise<StoredReviewRecord[]> {
  await ensureStorageDirs();
  try {
    const raw = await fsp.readFile(REVIEWS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredReviewRecord[]) : [];
  } catch {
    return [];
  }
}

async function mutateStoredReviews<T>(
  mutator: (items: StoredReviewRecord[]) => Promise<{ items: StoredReviewRecord[]; result: T }> | { items: StoredReviewRecord[]; result: T }
): Promise<T> {
  const run = async (): Promise<T> => {
    const current = await readStoredReviews();
    const { items, result } = await mutator(current);
    const tmpFile = `${REVIEWS_FILE}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(tmpFile, JSON.stringify(items, null, 2), 'utf8');
    await fsp.rename(tmpFile, REVIEWS_FILE);
    return result;
  };

  const next = writeQueue.then(run, run);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toClientRecord(rec: StoredReviewRecord) {
  const { receiptTokenHash: _hidden, ...publicFields } = rec;
  return publicFields;
}

// ---------------------------------------------------------------------------
// Rate Limiting (protects guest submission endpoints)
// ---------------------------------------------------------------------------
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxPerWindow: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || 'unknown';
    const now = Date.now();
    const entry = rateLimitBuckets.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitBuckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxPerWindow) {
      res.status(429).json({
        error: 'Too many review submissions from this network. Please wait a few minutes and try again.',
      });
      return;
    }

    entry.count += 1;
    next();
  };
}

// ---------------------------------------------------------------------------
// Google OAuth2 / Service Account Token Helpers (No extra dependencies)
// ---------------------------------------------------------------------------
function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getServiceAccountAccessToken(
  creds: ServiceAccountCreds,
  scopes: string[]
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(creds.private_key));
  const jwt = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Service account token exchange failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google OAuth token endpoint returned no access_token.');
  }
  return data.access_token;
}

function parseServiceAccountJson(raw: string | undefined): ServiceAccountCreds | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountCreds>;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
        project_id: parsed.project_id,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function getStoreDriveAccessToken(): Promise<string | null> {
  // Option A: Store owner OAuth Refresh Token (works with personal @gmail.com Drive)
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

  if (clientId && clientSecret && refreshToken) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Drive refresh token error (${resp.status}): ${text}`);
    }
    const data = (await resp.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new Error('Google OAuth did not return an access token.');
    }
    return data.access_token;
  }

  // Option B: Service Account JSON (works with Google Workspace Shared Drives)
  const sa = parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (sa) {
    return getServiceAccountAccessToken(sa, ['https://www.googleapis.com/auth/drive']);
  }

  // Option C: Direct short-lived access token in env (useful for quick local testing)
  const directToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  return null;
}

async function ensureStoreDriveFolder(accessToken: string): Promise<string> {
  const configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (configuredFolderId) {
    return configuredFolderId;
  }

  const query = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Google Drive folder lookup failed (${searchRes.status}): ${errText}`);
  }
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Could not create Google Drive folder (${createRes.status}): ${errText}`);
  }
  const folder = (await createRes.json()) as { id: string };
  return folder.id;
}

async function uploadPhotoToStoreDrive(
  accessToken: string,
  imageBuffer: Buffer,
  params: {
    submissionId: string;
    reviewerName: string;
    email: string;
    projectTitle: string;
  }
): Promise<DriveFilePayload> {
  const folderId = await ensureStoreDriveFolder(accessToken);
  const safeName =
    params.reviewerName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'customer';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `selfie_${safeName}_${params.submissionId.slice(-6)}_${timestamp}.jpg`;

  const metadata = {
    name: fileName,
    mimeType: 'image/jpeg',
    parents: [folderId],
    description: `Verified Atelier Veri customer selfie | Customer: ${params.reviewerName} (${params.email}) | Garment: ${params.projectTitle} | Submission: ${params.submissionId}`,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' }), fileName);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploaded = (await uploadRes.json()) as {
    id?: string;
    name?: string;
    webViewLink?: string;
  };
  if (!uploaded.id) {
    throw new Error('Google Drive upload returned no file ID.');
  }

  return {
    fileId: uploaded.id,
    fileName: uploaded.name || fileName,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    folderId,
    uploadedAtIso: new Date().toISOString(),
  };
}

async function uploadPhotoViaAppsScript(
  webhookUrl: string,
  imageBuffer: Buffer,
  params: {
    submissionId: string;
    reviewerName: string;
    email: string;
    projectTitle: string;
  }
): Promise<DriveFilePayload> {
  const safeName =
    params.reviewerName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'customer';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `selfie_${safeName}_${params.submissionId.slice(-6)}_${timestamp}.jpg`;

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
    body: JSON.stringify({
      secret: process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() || '',
      fileName,
      mimeType: 'image/jpeg',
      folderName: DRIVE_FOLDER_NAME,
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || '',
      imageBase64: imageBuffer.toString('base64'),
      metadata: {
        submissionId: params.submissionId,
        reviewerName: params.reviewerName,
        email: params.email,
        projectTitle: params.projectTitle,
      },
    }),
  });

  const rawText = await resp.text();
  if (!resp.ok) {
    if (rawText.includes('<!DOCTYPE html') || rawText.includes('You need access')) {
      throw new Error(
        `Apps Script denied access (HTTP ${resp.status}). In script.google.com, click Deploy -> Manage deployments -> Edit, choose "New version", set "Who has access" to "Anyone" (NOT "Only myself" or "Anyone with Google account"), and click Deploy.`
      );
    }
    throw new Error(`Apps Script Drive upload failed (${resp.status}): ${rawText.slice(0, 240)}`);
  }

  let data: {
    ok?: boolean;
    error?: string;
    fileId?: string;
    fileName?: string;
    webViewLink?: string;
    folderId?: string;
  };
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      'Apps Script Drive endpoint returned HTML instead of JSON. In Google Apps Script, click Deploy -> Manage deployments -> Edit, set "Who has access" to "Anyone", and redeploy.'
    );
  }

  if (data.ok === false || !data.fileId) {
    throw new Error(data.error || 'Apps Script Drive upload returned no fileId.');
  }

  return {
    fileId: data.fileId,
    fileName: data.fileName || fileName,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.fileId}/view`,
    folderId: data.folderId || 'root',
    uploadedAtIso: new Date().toISOString(),
  };
}

async function deleteDriveFileIfConfigured(fileId: string): Promise<void> {
  const token = await getStoreDriveAccessToken();
  if (!token) return;
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// ---------------------------------------------------------------------------
// Optional Firestore Server Sync (when FIREBASE_SERVICE_ACCOUNT_JSON is set)
// ---------------------------------------------------------------------------
function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function syncSubmissionToFirestore(rec: StoredReviewRecord): Promise<void> {
  const rawSa =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sa = parseServiceAccountJson(rawSa);
  if (!sa) return;
  if (sa.project_id && sa.project_id !== firebaseConfig.projectId) return;

  try {
    const token = await getServiceAccountAccessToken(sa, [
      'https://www.googleapis.com/auth/datastore',
    ]);
    const fields: Record<string, unknown> = {
      ownerUid: { stringValue: rec.ownerUid },
      reviewerName: { stringValue: rec.reviewerName },
      email: { stringValue: rec.email },
      phone: { stringValue: rec.phone },
      projectTitle: { stringValue: rec.projectTitle },
      rating: { integerValue: String(rec.rating) },
      reviewNotes: { stringValue: rec.reviewNotes },
      status: { stringValue: rec.status },
      location: toFirestoreValue(rec.location),
      createdAt: { timestampValue: new Date(rec.createdAtMs).toISOString() },
      updatedAt: { timestampValue: new Date(rec.updatedAtMs).toISOString() },
    };
    if (rec.faceVerification) {
      fields.faceVerification = toFirestoreValue(rec.faceVerification);
    }
    if (rec.driveFile) {
      fields.driveFile = toFirestoreValue(rec.driveFile);
    }

    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/submissions/${rec.id}`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn('Firestore server sync skipped:', err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Firebase Admin ID Token Verification (via Google Identity Toolkit)
// ---------------------------------------------------------------------------
async function verifyAdminBearerToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return false;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return false;
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const account = data.users?.[0];
    return Boolean(account && account.emailVerified && account.email === ADMIN_EMAIL);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------
function validateCreateBody(body: Record<string, unknown>): string | null {
  const reviewerName = typeof body.reviewerName === 'string' ? body.reviewerName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const projectTitle = typeof body.projectTitle === 'string' ? body.projectTitle.trim() : '';
  const reviewNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes.trim() : '';
  const rating = typeof body.rating === 'number' ? body.rating : Number(body.rating);
  const location = body.location as Partial<LocationPayload> | undefined;

  if (
    reviewerName.length < LIMITS.reviewerNameMin ||
    reviewerName.length > LIMITS.reviewerNameMax
  ) {
    return `Reviewer name must be between ${LIMITS.reviewerNameMin} and ${LIMITS.reviewerNameMax} characters.`;
  }
  if (
    email.length < LIMITS.emailMin ||
    email.length > LIMITS.emailMax ||
    !PATTERNS.email.test(email)
  ) {
    return 'Please enter a valid email address.';
  }
  if (
    phone.length < LIMITS.phoneMin ||
    phone.length > LIMITS.phoneMax ||
    !PATTERNS.phone.test(phone)
  ) {
    return 'Please enter a valid phone number.';
  }
  if (
    projectTitle.length < LIMITS.projectTitleMin ||
    projectTitle.length > LIMITS.projectTitleMax
  ) {
    return `Garment title must be between ${LIMITS.projectTitleMin} and ${LIMITS.projectTitleMax} characters.`;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Rating must be an integer between 1 and 5.';
  }
  if (reviewNotes.length > LIMITS.reviewNotesMax) {
    return `Review notes must be at most ${LIMITS.reviewNotesMax} characters.`;
  }
  if (
    !location ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    return 'Valid check-in location coordinates are required.';
  }
  return null;
}

async function startServer() {
  await ensureStorageDirs();
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Step 1: Create guest review (NO Google Sign-In required)
  app.post('/api/reviews', rateLimit(30, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const err = validateCreateBody(body);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }

      const loc = body.location as LocationPayload;
      const nowMs = Date.now();
      const submissionId = `sub_${nowMs}_${crypto.randomBytes(6).toString('hex')}`;
      const receiptToken = crypto.randomBytes(24).toString('hex');

      const record: StoredReviewRecord = {
        id: submissionId,
        ownerUid: 'guest',
        receiptTokenHash: hashToken(receiptToken),
        reviewerName: String(body.reviewerName).trim().slice(0, LIMITS.reviewerNameMax),
        email: String(body.email).trim().slice(0, LIMITS.emailMax),
        phone: String(body.phone).trim().slice(0, LIMITS.phoneMax),
        projectTitle: String(body.projectTitle).trim().slice(0, LIMITS.projectTitleMax),
        rating: Math.round(Number(body.rating)),
        reviewNotes: String(body.reviewNotes || '').trim().slice(0, LIMITS.reviewNotesMax),
        status: 'location_verified',
        location: {
          latitude: Number(loc.latitude.toFixed(6)),
          longitude: Number(loc.longitude.toFixed(6)),
          accuracyMeters: Math.max(0, Math.min(100000, Math.round(loc.accuracyMeters || 0))),
          capturedAtIso: String(loc.capturedAtIso || new Date(nowMs).toISOString()).slice(0, 40),
        },
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };

      await mutateStoredReviews((items) => ({
        items: [record, ...items],
        result: undefined,
      }));

      void syncSubmissionToFirestore(record);

      res.status(201).json({
        submission: toClientRecord(record),
        receiptToken,
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Unable to record your review. Please try again.' });
    }
  });

  // Step 2: Complete photo verification & upload image to store Google Drive (NO user login required)
  app.post(
    '/api/reviews/:id/complete',
    rateLimit(30, 15 * 60 * 1000),
    async (req: Request, res: Response) => {
      try {
        const submissionId = String(req.params.id || '');
        if (!PATTERNS.id.test(submissionId)) {
          res.status(400).json({ error: 'Invalid submission reference.' });
          return;
        }

        const body = (req.body || {}) as {
          receiptToken?: string;
          imageBase64?: string;
          faceVerification?: FaceVerificationPayload;
        };

        if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
          res.status(400).json({ error: 'Verification photo data is missing.' });
          return;
        }

        const fv = body.faceVerification;
        if (!fv || fv.passed !== true || typeof fv.livenessScore !== 'number') {
          res.status(400).json({ error: 'Photo verification check did not pass.' });
          return;
        }

        const base64Clean = body.imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Clean, 'base64');
        if (imageBuffer.length < 100 || imageBuffer.length > 4 * 1024 * 1024) {
          res.status(400).json({ error: 'Photo size must be between 100 bytes and 4 MB.' });
          return;
        }
        // Verify JPEG magic bytes (FF D8 FF)
        if (imageBuffer[0] !== 0xff || imageBuffer[1] !== 0xd8 || imageBuffer[2] !== 0xff) {
          res.status(400).json({ error: 'Invalid photo format. Expected JPEG image.' });
          return;
        }

        const reviews = await readStoredReviews();
        const existing = reviews.find((r) => r.id === submissionId);
        if (!existing) {
          res.status(404).json({ error: 'Review submission not found.' });
          return;
        }

        const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
        const tokenMatches =
          typeof body.receiptToken === 'string' &&
          hashToken(body.receiptToken) === existing.receiptTokenHash;

        if (!isAdmin && !tokenMatches) {
          res.status(403).json({ error: 'Invalid review session token.' });
          return;
        }

        // Persist photo locally on the server
        await ensureStorageDirs();
        const photoPath = path.join(PHOTOS_DIR, `${submissionId}.jpg`);
        await fsp.writeFile(photoPath, imageBuffer);

        // Upload to the store owner's Google Drive if server Drive credentials are configured
        let driveFile: DriveFilePayload | undefined;
        let driveStatus: 'uploaded' | 'local_only' = 'local_only';

        const appsScriptUrl = "https://script.google.com/macros/s/AKfycbzDGNTzF34Dy3fPEfhsJqaV0PpFbgMWIF4m2LVPV_JnT5F1e48VN581CPT6qXnwOC7oeA/exec".trim();
        if (appsScriptUrl) {
          driveFile = await uploadPhotoViaAppsScript(appsScriptUrl, imageBuffer, {
            submissionId,
            reviewerName: existing.reviewerName,
            email: existing.email,
            projectTitle: existing.projectTitle,
          });
          driveStatus = 'uploaded';
        } else {
          const driveToken = await getStoreDriveAccessToken();
          if (driveToken) {
            driveFile = await uploadPhotoToStoreDrive(driveToken, imageBuffer, {
              submissionId,
              reviewerName: existing.reviewerName,
              email: existing.email,
              projectTitle: existing.projectTitle,
            });
            driveStatus = 'uploaded';
          }
        }

        const sanitizedFace: FaceVerificationPayload = {
          passed: true,
          method: String(fv.method || 'Portrait Framing Audit').slice(0, 60),
          livenessScore: Math.max(0, Math.min(100, Math.round(fv.livenessScore))),
          summary: String(fv.summary || 'Selfie verified').slice(0, 300),
          verifiedAtIso: String(fv.verifiedAtIso || new Date().toISOString()).slice(0, 40),
        };

        const updatedRecord = await mutateStoredReviews((items) => {
          const idx = items.findIndex((item) => item.id === submissionId);
          if (idx === -1) {
            throw new Error('Review submission disappeared during update.');
          }
          const updated: StoredReviewRecord = {
            ...items[idx],
            status: 'face_verified',
            faceVerification: sanitizedFace,
            driveFile: driveFile ?? items[idx].driveFile,
            driveStatus,
            hasLocalPhoto: true,
            updatedAtMs: Date.now(),
          };
          const nextItems = [...items];
          nextItems[idx] = updated;
          return { items: nextItems, result: updated };
        });

        void syncSubmissionToFirestore(updatedRecord);

        res.json({
          submission: toClientRecord(updatedRecord),
          driveStatus,
        });
      } catch (error) {
        console.error('Complete verification error:', error);
        res.status(502).json({
          error:
            error instanceof Error
              ? error.message
              : 'Could not upload verification photo.',
        });
      }
    }
  );

  // Public non-PII customer reviews feed (no login required, zero PII exposed)
  app.get('/api/reviews/public', async (_req: Request, res: Response) => {
    try {
      const reviews = await readStoredReviews();
      const publicList = reviews
        .map((r) => ({
          id: r.id,
          reviewerName: r.reviewerName,
          projectTitle: r.projectTitle,
          rating: r.rating,
          reviewNotes: r.reviewNotes,
          status: r.status,
          hasPhoto: Boolean(r.hasLocalPhoto || r.driveFile),
          driveWebViewLink: r.driveFile?.webViewLink,
          createdAtMs: r.createdAtMs,
        }))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      res.json({ reviews: publicList });
    } catch (error) {
      console.error('Public reviews error:', error);
      res.status(500).json({ error: 'Unable to load customer reviews.' });
    }
  });

  // Photo preview endpoint (requires receiptToken from submitter OR verified Admin token)
  app.get('/api/reviews/:id/photo', async (req: Request, res: Response) => {
    const submissionId = String(req.params.id || '');
    if (!PATTERNS.id.test(submissionId)) {
      res.status(400).json({ error: 'Invalid submission reference.' });
      return;
    }

    const reviews = await readStoredReviews();
    const record = reviews.find((r) => r.id === submissionId);
    if (!record) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
    const tokenParam =
      typeof req.query.token === 'string'
        ? req.query.token
        : typeof req.headers['x-receipt-token'] === 'string'
        ? req.headers['x-receipt-token']
        : '';
    const tokenMatches = Boolean(tokenParam && hashToken(tokenParam) === record.receiptTokenHash);

    if (!isAdmin && !tokenMatches) {
      res.status(403).json({ error: 'Authorization required to view this photo.' });
      return;
    }

    const photoPath = path.join(PHOTOS_DIR, `${submissionId}.jpg`);
    if (!fs.existsSync(photoPath)) {
      res.status(404).json({ error: 'Photo file not found on server.' });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(photoPath).pipe(res);
  });

  // Admin ledger endpoint (requires verified Google Sign-In as store admin)
  app.get('/api/admin/reviews', async (req: Request, res: Response) => {
    const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
    if (!isAdmin) {
      res.status(403).json({ error: 'Store administrator authorization required.' });
      return;
    }

    const reviews = await readStoredReviews();
    const sorted = reviews
      .map(toClientRecord)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({ reviews: sorted });
  });

  // Admin delete endpoint
  app.delete('/api/admin/reviews/:id', async (req: Request, res: Response) => {
    const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
    if (!isAdmin) {
      res.status(403).json({ error: 'Store administrator authorization required.' });
      return;
    }

    const submissionId = String(req.params.id || '');
    if (!PATTERNS.id.test(submissionId)) {
      res.status(400).json({ error: 'Invalid submission reference.' });
      return;
    }

    const deleted = await mutateStoredReviews((items) => {
      const target = items.find((r) => r.id === submissionId) || null;
      return {
        items: items.filter((r) => r.id !== submissionId),
        result: target,
      };
    });

    if (!deleted) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const photoPath = path.join(PHOTOS_DIR, `${submissionId}.jpg`);
    await fsp.unlink(photoPath).catch(() => undefined);

    if (req.query.deleteDrive === 'true' && deleted.driveFile?.fileId) {
      await deleteDriveFileIfConfigured(deleted.driveFile.fileId).catch((err) => {
        console.warn('Drive file delete warning:', err);
      });
    }

    res.json({ ok: true });
  });

  // Mount Vite dev middleware or serve built static bundle
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
