-- =============================================================================
-- Module 7 — HR Document & Video Vault
-- ASKworX Platform
--
-- Run this ONCE against the shared PostgreSQL database.
-- Prisma migrations will handle subsequent changes from the main app.
-- =============================================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE document_category AS ENUM (
    'POLICY', 'CONTRACT', 'HANDBOOK', 'FORM', 'SOP', 'COMPLIANCE', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'ACTIVE', 'ARCHIVED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vault_access_level AS ENUM (
    'ALL', 'MANAGER_ONLY', 'HR_ONLY', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_category AS ENUM (
    'ONBOARDING', 'TRAINING', 'SAFETY', 'COMPLIANCE', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_status AS ENUM (
    'PROCESSING', 'READY', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- TABLE: hr_documents
-- =============================================================================

CREATE TABLE IF NOT EXISTS "HrDocument" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title           VARCHAR(255)      NOT NULL,
  description     TEXT,
  category        document_category NOT NULL DEFAULT 'OTHER',

  -- Storage
  "fileUrl"       TEXT              NOT NULL,
  "fileKey"       TEXT              NOT NULL,
  "fileType"      VARCHAR(100)      NOT NULL,     -- MIME type e.g. application/pdf
  "fileSize"      INTEGER           NOT NULL,     -- bytes

  -- Versioning
  version         INTEGER           NOT NULL DEFAULT 1,
  "parentId"      UUID              REFERENCES "HrDocument"(id) ON DELETE SET NULL,
  "isLatest"      BOOLEAN           NOT NULL DEFAULT true,

  -- Access control
  "accessLevel"   vault_access_level NOT NULL DEFAULT 'ALL',
  "allowedRoles"  TEXT[]            NOT NULL DEFAULT '{}',
  "allowedStaff"  TEXT[]            NOT NULL DEFAULT '{}',

  -- Metadata
  tags            TEXT[]            NOT NULL DEFAULT '{}',
  metadata        JSONB             NOT NULL DEFAULT '{}',
  "requiresAck"   BOOLEAN           NOT NULL DEFAULT false,
  "expiresAt"     TIMESTAMPTZ,
  status          document_status   NOT NULL DEFAULT 'ACTIVE',

  "uploadedBy"    TEXT              NOT NULL,     -- Staff ID (FK to "Staff".id)

  -- Expiry tracking (computed by cron job daily)
  "warningLevel"  TEXT              NOT NULL DEFAULT 'none', -- none | low | medium | high

  -- Soft delete
  "isDeleted"     BOOLEAN           NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrdoc_parent_id    ON "HrDocument"("parentId");
CREATE INDEX IF NOT EXISTS idx_hrdoc_category     ON "HrDocument"(category);
CREATE INDEX IF NOT EXISTS idx_hrdoc_status       ON "HrDocument"(status);
CREATE INDEX IF NOT EXISTS idx_hrdoc_access_level ON "HrDocument"("accessLevel");
CREATE INDEX IF NOT EXISTS idx_hrdoc_expires_at   ON "HrDocument"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_hrdoc_is_latest    ON "HrDocument"("isLatest");
CREATE INDEX IF NOT EXISTS idx_hrdoc_uploaded_by  ON "HrDocument"("uploadedBy");
CREATE INDEX IF NOT EXISTS idx_hrdoc_is_deleted    ON "HrDocument"("isDeleted");
CREATE INDEX IF NOT EXISTS idx_hrdoc_warning_level ON "HrDocument"("warningLevel");
CREATE INDEX IF NOT EXISTS idx_hrdoc_tags         ON "HrDocument" USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_hrdoc_metadata     ON "HrDocument" USING GIN(metadata);

-- =============================================================================
-- TABLE: doc_acknowledgements
-- =============================================================================

CREATE TABLE IF NOT EXISTS "DocAcknowledgement" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId"     UUID         NOT NULL REFERENCES "HrDocument"(id) ON DELETE CASCADE,
  "staffId"        TEXT         NOT NULL,   -- FK to "Staff".id

  "acknowledgedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "ipAddress"      VARCHAR(45),
  "userAgent"      TEXT,
  signature        TEXT,
  notes            TEXT,

  "isDeleted"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE("documentId", "staffId")
);

CREATE INDEX IF NOT EXISTS idx_docack_document_id ON "DocAcknowledgement"("documentId");
CREATE INDEX IF NOT EXISTS idx_docack_staff_id    ON "DocAcknowledgement"("staffId");

-- =============================================================================
-- TABLE: hr_videos
-- =============================================================================

CREATE TABLE IF NOT EXISTS "HrVideo" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title           VARCHAR(255)      NOT NULL,
  description     TEXT,
  category        video_category    NOT NULL DEFAULT 'GENERAL',

  -- Storage
  "originalUrl"   TEXT              NOT NULL,
  "processedUrl"  TEXT,                              -- set after ffmpeg processing
  "thumbnailUrl"  TEXT,
  "fileKey"       TEXT              NOT NULL,
  "fileSize"      BIGINT            NOT NULL,        -- bytes
  duration        INTEGER,                           -- seconds

  -- Processing
  status          video_status      NOT NULL DEFAULT 'PROCESSING',

  -- Access control
  "accessLevel"   vault_access_level NOT NULL DEFAULT 'ALL',
  "allowedRoles"  TEXT[]            NOT NULL DEFAULT '{}',
  "allowedStaff"  TEXT[]            NOT NULL DEFAULT '{}',

  -- Metadata
  tags            TEXT[]            NOT NULL DEFAULT '{}',
  metadata        JSONB             NOT NULL DEFAULT '{}',  -- resolution, codec, bitrate
  "isRequired"    BOOLEAN           NOT NULL DEFAULT false,
  "expiresAt"     TIMESTAMPTZ,

  "uploadedBy"    TEXT              NOT NULL,

  -- Soft delete
  "isDeleted"     BOOLEAN           NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrvideo_category     ON "HrVideo"(category);
CREATE INDEX IF NOT EXISTS idx_hrvideo_status       ON "HrVideo"(status);
CREATE INDEX IF NOT EXISTS idx_hrvideo_access_level ON "HrVideo"("accessLevel");
CREATE INDEX IF NOT EXISTS idx_hrvideo_is_required  ON "HrVideo"("isRequired");
CREATE INDEX IF NOT EXISTS idx_hrvideo_expires_at   ON "HrVideo"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_hrvideo_uploaded_by  ON "HrVideo"("uploadedBy");
CREATE INDEX IF NOT EXISTS idx_hrvideo_is_deleted   ON "HrVideo"("isDeleted");
CREATE INDEX IF NOT EXISTS idx_hrvideo_tags         ON "HrVideo" USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_hrvideo_metadata     ON "HrVideo" USING GIN(metadata);

-- =============================================================================
-- TABLE: video_watch_log
-- =============================================================================

CREATE TABLE IF NOT EXISTS "VideoWatchLog" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "videoId"        UUID         NOT NULL REFERENCES "HrVideo"(id) ON DELETE CASCADE,
  "staffId"        TEXT         NOT NULL,

  "watchedSeconds" INTEGER      NOT NULL DEFAULT 0,
  "totalSeconds"   INTEGER      NOT NULL DEFAULT 0,
  percentage       NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0.00–100.00
  completed        BOOLEAN      NOT NULL DEFAULT false,
  "lastPosition"   INTEGER      NOT NULL DEFAULT 0,   -- resume point (seconds)
  "sessionData"    JSONB        NOT NULL DEFAULT '{}', -- device, ip, userAgent

  "isDeleted"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE("videoId", "staffId")
);

CREATE INDEX IF NOT EXISTS idx_watchlog_video_id  ON "VideoWatchLog"("videoId");
CREATE INDEX IF NOT EXISTS idx_watchlog_staff_id  ON "VideoWatchLog"("staffId");
CREATE INDEX IF NOT EXISTS idx_watchlog_completed ON "VideoWatchLog"(completed);

-- =============================================================================
-- TRIGGER: auto-update updatedAt on all vault tables
-- =============================================================================

CREATE OR REPLACE FUNCTION vault_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_hrdoc_updated_at
    BEFORE UPDATE ON "HrDocument"
    FOR EACH ROW EXECUTE FUNCTION vault_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_docack_updated_at
    BEFORE UPDATE ON "DocAcknowledgement"
    FOR EACH ROW EXECUTE FUNCTION vault_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_hrvideo_updated_at
    BEFORE UPDATE ON "HrVideo"
    FOR EACH ROW EXECUTE FUNCTION vault_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_watchlog_updated_at
    BEFORE UPDATE ON "VideoWatchLog"
    FOR EACH ROW EXECUTE FUNCTION vault_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- HELPER VIEW: expired documents (for scheduler / cron)
-- =============================================================================

CREATE OR REPLACE VIEW vault_expired_documents AS
  SELECT id, title, "expiresAt", status
  FROM   "HrDocument"
  WHERE  "isDeleted" = false
    AND  status      = 'ACTIVE'
    AND  "expiresAt" IS NOT NULL
    AND  "expiresAt" < NOW();

CREATE OR REPLACE VIEW vault_expired_videos AS
  SELECT id, title, "expiresAt", status
  FROM   "HrVideo"
  WHERE  "isDeleted" = false
    AND  "expiresAt" IS NOT NULL
    AND  "expiresAt" < NOW();
