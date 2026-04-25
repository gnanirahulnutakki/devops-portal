-- AlterTable
ALTER TABLE "integration_credentials" ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "rotatedAt" TIMESTAMP(3),
ADD COLUMN "lastHealthCheckAt" TIMESTAMP(3),
ADD COLUMN "healthStatus" TEXT DEFAULT 'unknown';

-- CreateTable
CREATE TABLE "credential_health_checks" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credential_health_checks_credentialId_checkedAt_idx" ON "credential_health_checks"("credentialId", "checkedAt");

-- AddForeignKey
ALTER TABLE "credential_health_checks" ADD CONSTRAINT "credential_health_checks_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "integration_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
