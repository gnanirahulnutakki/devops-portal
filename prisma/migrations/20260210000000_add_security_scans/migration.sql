-- Create security scans table for storing vulnerability scan reports

CREATE TYPE "SecurityScanType" AS ENUM ('TRIVY_IMAGE', 'TRIVY_CLUSTER', 'DOCKER_SCOUT_IMAGE');
CREATE TYPE "SecurityScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS "security_scans" (
  "id" TEXT NOT NULL,
  "type" "SecurityScanType" NOT NULL,
  "status" "SecurityScanStatus" NOT NULL DEFAULT 'PENDING',
  "target" TEXT NOT NULL,
  "tool" TEXT,
  "toolVersion" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "summary" JSONB,
  "reportJson" JSONB,
  "reportText" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_scans_organizationId_createdAt_idx"
  ON "security_scans" ("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "security_scans_organizationId_status_idx"
  ON "security_scans" ("organizationId", "status");

ALTER TABLE "security_scans"
  ADD CONSTRAINT "security_scans_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_scans"
  ADD CONSTRAINT "security_scans_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

