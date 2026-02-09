-- Allow multiple credentials per provider per organization
ALTER TABLE "integration_credentials"
  DROP CONSTRAINT IF EXISTS "integration_credentials_organizationId_provider_key";

CREATE UNIQUE INDEX IF NOT EXISTS "integration_credentials_org_provider_name_key"
  ON "integration_credentials" ("organizationId", "provider", "name");
