-- =============================================================================
-- Row Level Security (RLS) Policies for Multi-Tenancy
-- Run this after Prisma migrations
-- =============================================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

-- Create policy for clusters
CREATE POLICY tenant_isolation_clusters ON clusters
  USING (organization_id = current_setting('app.organization_id', true)::text)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::text);

-- Create policy for deployments
CREATE POLICY tenant_isolation_deployments ON deployments
  USING (organization_id = current_setting('app.organization_id', true)::text)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::text);

-- Create policy for bulk_operations
CREATE POLICY tenant_isolation_bulk_operations ON bulk_operations
  USING (organization_id = current_setting('app.organization_id', true)::text)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::text);

-- Create policy for audit_logs
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (organization_id = current_setting('app.organization_id', true)::text)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::text);

-- Create policy for alert_rules
CREATE POLICY tenant_isolation_alert_rules ON alert_rules
  USING (organization_id = current_setting('app.organization_id', true)::text)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::text);

-- =============================================================================
-- Application Role for RLS
-- The application should connect as this role, not superuser
-- =============================================================================

-- Create application role if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'devops_portal_app') THEN
    CREATE ROLE devops_portal_app WITH LOGIN;
  END IF;
END
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO devops_portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devops_portal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO devops_portal_app;

-- Future tables should also be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO devops_portal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO devops_portal_app;

-- =============================================================================
-- Indexes for Performance with RLS
-- =============================================================================

-- Ensure organizationId indexes exist for efficient RLS filtering
CREATE INDEX IF NOT EXISTS idx_clusters_org ON clusters(organization_id);
CREATE INDEX IF NOT EXISTS idx_deployments_org ON deployments(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_org ON bulk_operations(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(organization_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deployments_org_cluster ON deployments(organization_id, cluster_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_user ON audit_logs(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- =============================================================================
-- PgBouncer Compatibility Note
-- =============================================================================
-- When using PgBouncer in transaction mode, SET commands are transaction-scoped.
-- This is actually what we want for RLS - each transaction sets its own context.
-- 
-- Connection string example for PgBouncer:
-- postgresql://devops_portal_app:password@pgbouncer:6432/devops_portal?pgbouncer=true
--
-- The Prisma client should use:
-- - Transaction mode (not session mode) in PgBouncer
-- - SET LOCAL app.organization_id = '...' at the start of each transaction
