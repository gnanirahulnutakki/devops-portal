-- Add K8s execution metadata to security_scans

ALTER TABLE "security_scans"
  ADD COLUMN IF NOT EXISTS "k8sNamespace" TEXT,
  ADD COLUMN IF NOT EXISTS "k8sJobName" TEXT,
  ADD COLUMN IF NOT EXISTS "k8sPodName" TEXT;

