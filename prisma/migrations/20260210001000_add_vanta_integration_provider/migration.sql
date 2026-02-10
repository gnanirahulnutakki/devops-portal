-- Add VANTA as an integration provider

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'IntegrationProvider' AND e.enumlabel = 'VANTA'
  ) THEN
    ALTER TYPE "IntegrationProvider" ADD VALUE 'VANTA';
  END IF;
END $$;

