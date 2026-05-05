#!/usr/bin/env npx ts-node
/**
 * RLS (Row Level Security) Setup Script
 * 
 * This script applies PostgreSQL RLS policies for multi-tenant isolation.
 * Run after Prisma migrations to enable database-level tenant security.
 * 
 * Usage:
 *   npx ts-node scripts/setup-rls.ts
 *   npm run db:setup-rls
 * 
 * Prerequisites:
 *   - DATABASE_URL must be set
 *   - Prisma migrations must be applied first
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tables that require RLS.
// `clusters` uses @map("organization_id") in the Prisma schema, so its column
// is snake_case in Postgres. The rest don't @map and stay camelCase.
const RLS_TABLES = [
  { table: 'clusters', column: '"organization_id"' },
  { table: 'deployments', column: '"organizationId"' },
  { table: 'bulk_operations', column: '"organizationId"' },
  { table: 'audit_logs', column: '"organizationId"' },
  { table: 'alert_rules', column: '"organizationId"' },
  { table: 'integration_credentials', column: '"organizationId"' },
];

async function main() {
  console.log('🔐 Setting up Row Level Security (RLS)...\n');

  try {
    // Check if we can connect
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection established\n');

    // Step 1: Enable RLS on tables
    console.log('📋 Enabling RLS on tenant-scoped tables...');
    for (const { table } of RLS_TABLES) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`   ✓ ${table}`);
      } catch (e) {
        if ((e as Error).message.includes('already enabled')) {
          console.log(`   ○ ${table} (already enabled)`);
        } else {
          throw e;
        }
      }
    }
    console.log('');

    // Step 2: Create RLS policies
    console.log('🔒 Creating RLS policies...');
    for (const { table, column } of RLS_TABLES) {
      const policyName = `tenant_isolation_${table}`;
      
      // Drop existing policy if exists
      try {
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS ${policyName} ON ${table}`);
      } catch {
        // Ignore errors from non-existent policies
      }

      // Create new policy using the correct column name (quoted for camelCase)
      await prisma.$executeRawUnsafe(`
        CREATE POLICY ${policyName} ON ${table}
        USING (${column} = current_setting('app.organization_id', true)::text)
        WITH CHECK (${column} = current_setting('app.organization_id', true)::text)
      `);
      console.log(`   ✓ ${policyName}`);
    }
    console.log('');

    // Step 3: Create application role (if not exists)
    console.log('👤 Setting up application role...');
    try {
      await prisma.$executeRaw`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'devops_portal_app') THEN
            CREATE ROLE devops_portal_app WITH LOGIN;
          END IF;
        END
        $$
      `;
      console.log('   ✓ Role devops_portal_app exists');
    } catch (e) {
      console.log(`   ⚠ Could not create role: ${(e as Error).message}`);
    }

    // Step 4: Grant permissions to application role
    console.log('\n🔑 Granting permissions...');
    try {
      await prisma.$executeRaw`GRANT USAGE ON SCHEMA public TO devops_portal_app`;
      await prisma.$executeRaw`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devops_portal_app`;
      await prisma.$executeRaw`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO devops_portal_app`;
      console.log('   ✓ Permissions granted to devops_portal_app');
    } catch (e) {
      console.log(`   ⚠ Could not grant permissions: ${(e as Error).message}`);
    }

    // Step 5: Create indexes for efficient RLS filtering
    // Note: Prisma may have already created these indexes, but we ensure they exist
    console.log('\n📊 Creating performance indexes...');
    const indexes = [
      { table: 'clusters', column: '"organization_id"', name: 'idx_clusters_org_rls' },
      { table: 'deployments', column: '"organizationId"', name: 'idx_deployments_org_rls' },
      { table: 'bulk_operations', column: '"organizationId"', name: 'idx_bulk_operations_org_rls' },
      { table: 'audit_logs', column: '"organizationId"', name: 'idx_audit_logs_org_rls' },
      { table: 'alert_rules', column: '"organizationId"', name: 'idx_alert_rules_org_rls' },
      { table: 'integration_credentials', column: '"organizationId"', name: 'idx_integration_credentials_org_rls' },
    ];

    for (const idx of indexes) {
      try {
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`
        );
        console.log(`   ✓ ${idx.name}`);
      } catch {
        console.log(`   ○ ${idx.name} (may already exist)`);
      }
    }

    // Step 6: Verify setup
    console.log('\n🔍 Verifying RLS setup...');
    const rlsCheck = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = ANY(ARRAY['clusters', 'deployments', 'bulk_operations', 'audit_logs', 'alert_rules', 'integration_credentials'])
    `;
    
    const allEnabled = rlsCheck.every((t) => t.relrowsecurity);
    if (allEnabled) {
      console.log('   ✓ All tables have RLS enabled');
    } else {
      const disabled = rlsCheck.filter((t) => !t.relrowsecurity).map((t) => t.relname);
      console.log(`   ⚠ Tables without RLS: ${disabled.join(', ')}`);
    }

    console.log('\n✅ RLS setup complete!\n');
    console.log('📝 Notes:');
    console.log('   - Application must SET app.organization_id before queries');
    console.log('   - Use withRLSContext() for raw queries');
    console.log('   - For production, connect as devops_portal_app role');
    console.log('');

  } catch (error) {
    console.error('\n❌ RLS setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
