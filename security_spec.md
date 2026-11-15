# Security Specification: VeriEval Competition Review Portal

## 1. Data Invariants
1. **Identity Integrity**: Every document in `/submissions/{submissionId}` must have `ownerUid == request.auth.uid` on creation, and `ownerUid` is immutable after creation.
2. **Verified Email Mandate**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Isolation**: `/submissions/{submissionId}` stores sensitive PII (`email`, `phone`, GPS `location`). Both `get` and `list` are strictly restricted to `resource.data.ownerUid == request.auth.uid || isAdmin()`. No blanket `isSignedIn()` reads exist.
4. **State Machine Integrity**: A submission MUST be created in status `location_verified` (only after location coordinates are supplied). It cannot skip directly to `face_verified` on creation. Transition to `face_verified` requires valid `faceVerification` and `driveFile` objects. Once `face_verified`, the submission is locked against further non-admin edits.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update and `updatedAt` must equal `request.time`.
6. **Strict Keys & Volumetric Guards**: Every string has `.size()` bounds and regex checks matching `firebase-blueprint.json`. Unknown/ghost fields are rejected via `keys().hasAll(...)` and `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Create**: Create `/submissions/sub_001` with `request.auth == null`.
2. **Unverified Email Admin Spoof**: Read `/submissions` with `token.email == 'adhilhabeeb960571@gmail.com'` and `token.email_verified == false`.
3. **Identity Spoofing on Create**: Create `/submissions/sub_002` with `ownerUid: "victim_uid"` while authenticated as `"attacker_uid"`.
4. **State Shortcutting on Create**: Create `/submissions/sub_003` with `status: "face_verified"` directly on creation.
5. **Ghost Field / Shadow Write**: Create `/submissions/sub_004` including extra field `isAdminApproved: true`.
6. **Cross-User PII Read (`get`)**: User B attempts `get(/submissions/userA_sub)`.
7. **Blanket List Query Scraping**: User B attempts `list(/submissions)` without filtering `where('ownerUid', '==', userB.uid)`.
8. **1MB Resource Poisoning ID**: Create `/submissions/<2000-char-invalid-id>` with special characters or oversized ID.
9. **Rating Out-of-Bounds / Type Poisoning**: Create `/submissions/sub_005` with `rating: 99` or `rating: "five"`.
10. **Terminal State Mutation**: Owner attempts to update a submission whose `status` is already `'face_verified'`.
11. **Immortal Field Tampering**: Owner attempts to modify `ownerUid` or `createdAt` during an update.
12. **Client Timestamp Forgery**: Create `/submissions/sub_006` with a backdated `createdAt` timestamp instead of `request.time`.
