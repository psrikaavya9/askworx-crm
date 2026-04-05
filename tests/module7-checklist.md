# Module 7 — HR Vault + Video + Quiz + Expiry
## QA Test Case Checklist

> **Seed first:** `node scripts/seedModule7.js`
> **Vault server:** `cd vault-server && npm run dev` (port 4001)
> **App:** `npm run dev` (port 3000)
> **Auth header:** `Authorization: Bearer <token>` — tokens below use staff IDs from seed

---

## Legend
- [ ] = not tested
- [x] = PASS
- [F] = FAIL (note reason)
- [S] = SKIP (not applicable)

---

## 1. Document Flow

### 1.1 Upload
- [ ] **DOC-U-01** Upload a PDF — form submits, doc appears in vault list
- [ ] **DOC-U-02** Upload with `requiresAck = true` — ack banner appears in My Documents
- [ ] **DOC-U-03** Upload with expiry date 5 days from now — `warningLevel` shows `high`
- [ ] **DOC-U-04** Upload with `accessLevel = MANAGER_ONLY` — employee sees doc omitted from their list
- [ ] **DOC-U-05** Upload with `accessLevel = HR_ONLY` — only HR/admin staff can fetch it
- [ ] **DOC-U-06** Upload > 50 MB file — server rejects with appropriate error
- [ ] **DOC-U-07** Upload with no title — validation error returned (400)
- [ ] **DOC-U-08** Upload same file twice — second upload creates new doc entry (no dedup)

### 1.2 List & Search
- [ ] **DOC-L-01** `/documents` returns paginated list (12 per page)
- [ ] **DOC-L-02** `?search=policy` returns only docs with "policy" in title/description/tags
- [ ] **DOC-L-03** `?category=POLICY` filters correctly
- [ ] **DOC-L-04** `?status=ACTIVE` excludes ARCHIVED and EXPIRED docs
- [ ] **DOC-L-05** `?status=EXPIRED` returns only expired docs
- [ ] **DOC-L-06** `?warningLevel=high` returns only docs with warningLevel = high
- [ ] **DOC-L-07** `?warningLevel=medium` returns medium docs only
- [ ] **DOC-L-08** Combined filters `?status=ACTIVE&warningLevel=high` work together
- [ ] **DOC-L-09** `?page=2&limit=5` returns correct slice
- [ ] **DOC-L-10** Response `meta` includes `total`, `page`, `totalPages`

### 1.3 View & Download
- [ ] **DOC-V-01** `GET /documents/:id` returns full document object including `warningLevel`
- [ ] **DOC-V-02** `GET /documents/:id` for soft-deleted doc returns 404
- [ ] **DOC-V-03** Download link (`fileUrl`) is accessible / signed URL resolves
- [ ] **DOC-V-04** Admin can view MANAGER_ONLY documents
- [ ] **DOC-V-05** Employee cannot view HR_ONLY documents (403)

### 1.4 Archive / Delete
- [ ] **DOC-A-01** `PATCH /documents/:id` with `status: ARCHIVED` — doc status updates, disappears from ACTIVE filter
- [ ] **DOC-A-02** Archived doc still returned by `?status=ARCHIVED`
- [ ] **DOC-A-03** Admin can archive; employee gets 403
- [ ] **DOC-A-04** `DELETE /documents/:id` — soft-deletes (`isDeleted = true`), not returned in list
- [ ] **DOC-A-05** Hard delete attempt by non-admin returns 403

---

## 2. Acknowledgement Flow

### 2.1 Acknowledge
- [ ] **ACK-01** `POST /documents/:id/acknowledge` — creates ack record for staff
- [ ] **ACK-02** Double-ack returns 409 or upsert (no duplicate row in DB)
- [ ] **ACK-03** Ack with `signature` field stored correctly
- [ ] **ACK-04** `acknowledged: true` appears in doc list for that staff member
- [ ] **ACK-05** Non-required doc can still be acknowledged

### 2.2 Status Tracking
- [ ] **ACK-06** My Documents page shows "Pending Ack" count correctly
- [ ] **ACK-07** "Pending Ack" count updates immediately after acknowledging
- [ ] **ACK-08** Ack alert banner disappears after all pending docs are acknowledged
- [ ] **ACK-09** `GET /documents/:id/acknowledgements` (admin) lists all ack records
- [ ] **ACK-10** `GET /documents/:id/acknowledgements` by employee returns 403

---

## 3. Expiry Tracking System

### 3.1 Warning Levels (DB)
- [ ] **EXP-01** Doc expiring in ≤7 days has `warningLevel = high`
- [ ] **EXP-02** Doc expiring in 8–30 days has `warningLevel = medium`
- [ ] **EXP-03** Doc expiring in 31–90 days has `warningLevel = low`
- [ ] **EXP-04** Doc expiring in >90 days has `warningLevel = none`
- [ ] **EXP-05** Doc with no `expiresAt` has `warningLevel = none`
- [ ] **EXP-06** Doc past expiry date has `status = EXPIRED`
- [ ] **EXP-07** Run `runExpiryJob()` manually — expired docs update status, warning levels recalculate

### 3.2 Alert API
- [ ] **EXP-08** `GET /documents/alerts` returns `{ critical, expiringSoon, expired }` groups
- [ ] **EXP-09** `critical` count matches docs with `warningLevel IN ('high', 'medium')` and `status = ACTIVE`
- [ ] **EXP-10** `expiringSoon` count matches docs with `warningLevel = low` and `status = ACTIVE`
- [ ] **EXP-11** `expired` count matches docs with `status = EXPIRED` and `isDeleted = false`
- [ ] **EXP-12** Alerts endpoint requires manager role (employee gets 403)

### 3.3 UI — DocumentCard
- [ ] **EXP-13** Critical doc card shows red expiry badge with `animate-pulse`
- [ ] **EXP-14** Medium doc shows orange expiry badge (no pulse)
- [ ] **EXP-15** Low doc shows amber expiry badge
- [ ] **EXP-16** Safe/no-expiry doc shows green badge or no expiry indicator
- [ ] **EXP-17** Expired doc shows red "EXPIRED" status badge
- [ ] **EXP-18** Critical doc card has subtle red ring border

### 3.4 AlertWidget
- [ ] **EXP-19** AlertWidget renders on `/vault` page (admin view)
- [ ] **EXP-20** AlertWidget shows correct counts from seed data (3 critical, 2 soon, 2 expired)
- [ ] **EXP-21** Clicking "View Critical" sets `warningLevel=high` filter
- [ ] **EXP-22** Clicking "View Expiring Soon" sets `warningLevel=low` and `status=ACTIVE`
- [ ] **EXP-23** Clicking "View Expired" sets `status=EXPIRED`
- [ ] **EXP-24** AlertWidget hidden when all counts are zero
- [ ] **EXP-25** Toast appears on vault page load when critical docs exist (once per session)
- [ ] **EXP-26** Toast does NOT re-appear after navigating away and returning in same session

### 3.5 FilterBar — Warning Level
- [ ] **EXP-27** Expiry dropdown shows: All Expiry / Critical / Due Soon / Expiring / Safe
- [ ] **EXP-28** Selecting "Critical" tints dropdown border red
- [ ] **EXP-29** Selecting "Due Soon" tints dropdown border orange
- [ ] **EXP-30** Selecting "Expiring" tints dropdown border amber
- [ ] **EXP-31** Clear Filters button resets warningLevel to empty

---

## 4. Video Flow

### 4.1 Upload & Status
- [ ] **VID-U-01** Upload video — appears with `status = PROCESSING`
- [ ] **VID-U-02** After ffmpeg processing, `status` updates to `READY`, `processedUrl` is set
- [ ] **VID-U-03** Failed processing → `status = FAILED`
- [ ] **VID-U-04** `GET /videos` lists only non-deleted videos
- [ ] **VID-U-05** `?category=ONBOARDING` filters correctly
- [ ] **VID-U-06** `?status=READY` returns only READY videos

### 4.2 Playback
- [ ] **VID-P-01** Video player page loads at `/vault/videos/:id`
- [ ] **VID-P-02** Progress resumes from `lastPosition` on revisit (localStorage)
- [ ] **VID-P-03** Progress saved to server at 90% threshold
- [ ] **VID-P-04** `POST /videos/:id/progress` updates `watchedSeconds`, `percentage`, `completed`
- [ ] **VID-P-05** Second visit to completed video shows "Completed" badge on card
- [ ] **VID-P-06** `completed = false` until 90% watched (server side)

### 4.3 Progress Tracking
- [ ] **VID-T-01** VideoCard shows progress bar for partially watched videos
- [ ] **VID-T-02** VideoCard shows green "Completed" badge for 100% completion
- [ ] **VID-T-03** `GET /videos/:id/progress` returns correct percentage for seeded staff
- [ ] **VID-T-04** Seeded staff `seed-emp-001` has correct progress for Fire Safety video (100%)
- [ ] **VID-T-05** Watch log count correctly increments per video

---

## 5. Quiz Flow

### 5.1 Fetch Quiz
- [ ] **QUIZ-F-01** `GET /api/vault/videos/:id/quiz` returns quiz with questions (no correct answers in payload)
- [ ] **QUIZ-F-02** Returns 404 if video has no quiz
- [ ] **QUIZ-F-03** Returns 404 for non-existent video

### 5.2 Quiz Gating
- [ ] **QUIZ-G-01** Video with quiz pauses at 90% and shows quiz modal
- [ ] **QUIZ-G-02** Video WITHOUT quiz marks complete at 90% (no modal)
- [ ] **QUIZ-G-03** "Take Quiz to Complete" overlay button visible after 90% for quiz video
- [ ] **QUIZ-G-04** After quiz passed — video progress saved as completed, badge shows "Completed"
- [ ] **QUIZ-G-05** After quiz failed — video does NOT mark as completed, can retry quiz
- [ ] **QUIZ-G-06** Closing quiz modal (X) without passing does not mark video complete
- [ ] **QUIZ-G-07** Refreshing page with `quizPending=true` in localStorage re-shows quiz prompt

### 5.3 Quiz Submission
- [ ] **QUIZ-S-01** `POST /api/vault/videos/:id/quiz/submit` with all correct answers → `passed: true`
- [ ] **QUIZ-S-02** Submission with wrong answers → `passed: false`, score returned
- [ ] **QUIZ-S-03** Submission with partial correct answers → correct pass/fail threshold applied (default 70%)
- [ ] **QUIZ-S-04** Quiz attempt saved to DB (check `VideoQuizAttempt` table)
- [ ] **QUIZ-S-05** Multiple attempts allowed — each creates new attempt record
- [ ] **QUIZ-S-06** `QuizModal` shows per-question feedback after submit (correct/incorrect indicators)
- [ ] **QUIZ-S-07** Score percentage displayed in QuizModal result view
- [ ] **QUIZ-S-08** "Try Again" button resets quiz state

### 5.4 VideoCard — Quiz Badge
- [ ] **QUIZ-C-01** VideoCard shows amber "Quiz Required" badge if quiz is pending (localStorage)
- [ ] **QUIZ-C-02** Badge disappears after quiz is passed and video marked complete

---

## 6. RBAC Tests

### 6.1 Access Levels
- [ ] **RBAC-01** `accessLevel = ALL` — employee can access doc
- [ ] **RBAC-02** `accessLevel = MANAGER_ONLY` — employee gets 403; manager gets 200
- [ ] **RBAC-03** `accessLevel = HR_ONLY` — employee gets 403; manager gets 403; HR/admin gets 200
- [ ] **RBAC-04** `accessLevel = CUSTOM`, `allowedStaff = ['seed-emp-001']` — only that staff can access
- [ ] **RBAC-05** Admin bypasses all access level restrictions

### 6.2 Endpoint Permissions
- [ ] **RBAC-06** Employee cannot `POST /documents` (403)
- [ ] **RBAC-07** Manager can `POST /documents` (201)
- [ ] **RBAC-08** Admin can `DELETE /documents/:id` (200)
- [ ] **RBAC-09** Employee cannot `GET /documents/alerts` (403)
- [ ] **RBAC-10** Manager can `GET /documents/alerts` (200)
- [ ] **RBAC-11** Employee cannot `POST /videos` (403)
- [ ] **RBAC-12** Manager can `POST /videos` (201)
- [ ] **RBAC-13** Any authenticated user can `POST /videos/:id/progress`
- [ ] **RBAC-14** Any authenticated user can `POST /api/vault/videos/:id/quiz/submit`

### 6.3 My Documents vs Vault
- [ ] **RBAC-15** `/vault` (admin page) shows all documents regardless of access level
- [ ] **RBAC-16** `/vault/my-documents` (employee page) shows only accessible docs
- [ ] **RBAC-17** MANAGER_ONLY doc visible in `/vault/my-documents` for managers

---

## 7. Edge Cases & Error Handling

- [ ] **EDGE-01** Vault server offline — vault page shows error state with Retry button
- [ ] **EDGE-02** Invalid document ID format returns 400 (not 500)
- [ ] **EDGE-03** Upload with unsupported file type (e.g., `.exe`) — server rejects
- [ ] **EDGE-04** `expiresAt` in the past on upload — accepted (immediate EXPIRED on next cron run)
- [ ] **EDGE-05** Quiz submit with missing `answers` field returns 400
- [ ] **EDGE-06** Video progress with `percentage > 100` returns 400 or clamps to 100
- [ ] **EDGE-07** Filter with invalid `warningLevel` value returns 400
- [ ] **EDGE-08** Pagination `page=0` or `page=-1` returns 400 or defaults to 1
- [ ] **EDGE-09** Search with SQL injection characters (e.g., `' OR 1=1`) — safe (parameterized queries)
- [ ] **EDGE-10** Cron job runs twice concurrently — idempotent (no duplicate updates)

---

## 8. Seed Data Verification

Run: `node scripts/seedModule7.js --verify`

Expected output:
```
Staff:           8  (1 admin, 2 managers, 5 employees)
HrDocuments:    16  (3 HIGH, 2 MEDIUM, 2 LOW, 7 SAFE, 2 EXPIRED)
Acknowledgements: varies (admin+mgr1 signed most, emp1 signed some)
HrVideos:        9  (8 READY, 1 PROCESSING)
VideoWatchLogs: varies (5 staff × multiple videos)
VideoQuiz:       3
VideoQuizQuestion: 11
VideoQuizAttempt: 7
```

- [ ] **SEED-01** `--verify` output matches expected counts
- [ ] **SEED-02** `--clean` removes only seed-tagged data (not real data)
- [ ] **SEED-03** Running seed twice (no `--clean`) does not duplicate records

---

## 9. UI / UX Smoke Tests

- [ ] **UI-01** `/vault` page loads without console errors
- [ ] **UI-02** `/vault/my-documents` page loads without console errors
- [ ] **UI-03** `/vault/videos` page loads without console errors
- [ ] **UI-04** `/vault/videos/:id` player page loads for READY video
- [ ] **UI-05** Skeleton cards show during loading, replaced by real cards
- [ ] **UI-06** Empty state shows when no docs match filters
- [ ] **UI-07** Pagination controls disabled correctly at first/last page
- [ ] **UI-08** Upload modal opens/closes without memory leak
- [ ] **UI-09** FilterBar "Clear" button resets all 4 filters at once
- [ ] **UI-10** StatPills in My Documents show 0 during loading (no NaN)
