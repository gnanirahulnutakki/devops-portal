/**
 * Database Seed Script
 * 
 * Creates default admin user and organization for development/testing.
 * 
 * Usage:
 *   npm run db:seed
 * 
 * Default credentials:
 *   Email: admin@example.com
 *   Password: admin123
 */

import { PrismaClient, Role } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Simple password hashing (matches auth.ts)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // Default admin credentials
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.SEED_ADMIN_NAME || 'Admin User';

  // Default organization
  const orgName = process.env.SEED_ORG_NAME || 'Default Organization';
  const orgSlug = process.env.SEED_ORG_SLUG || 'default';

  // Create or update organization
  console.log('📦 Creating organization...');
  const organization = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: { name: orgName },
    create: {
      name: orgName,
      slug: orgSlug,
      description: 'Default organization for development',
      settings: {
        features: {
          bulkOperations: true,
          costInsights: false,
          aiSearch: false,
        },
      },
    },
  });
  console.log(`   ✓ Organization: ${organization.name} (${organization.id})\n`);

  // Create or update admin user
  console.log('👤 Creating admin user...');
  const passwordHash = hashPassword(adminPassword);
  
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      name: adminName,
      passwordHash,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Admin user: ${adminUser.email} (${adminUser.id})\n`);

  // Create membership (admin role)
  console.log('🔗 Creating admin membership...');
  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: organization.id,
      },
    },
    update: { role: Role.ADMIN },
    create: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: Role.ADMIN,
    },
  });
  console.log(`   ✓ Membership: ${adminUser.email} → ${organization.slug} (${membership.role})\n`);

  // Create a sample cluster (optional)
  console.log('☸️  Creating sample cluster...');
  const cluster = await prisma.cluster.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'dev-cluster',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Development Cluster',
      slug: 'dev-cluster',
      provider: 'AWS',
      region: 'us-west-2',
      environment: 'development',
      status: 'HEALTHY',
    },
  });
  console.log(`   ✓ Cluster: ${cluster.name} (${cluster.id})\n`);

  // Create a guest user (optional)
  console.log('👥 Creating guest user...');
  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      name: 'Guest User',
      passwordHash: hashPassword('guest123'),
      emailVerified: new Date(),
    },
  });
  
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: guestUser.id,
        organizationId: organization.id,
      },
    },
    update: { role: Role.USER },
    create: {
      userId: guestUser.id,
      organizationId: organization.id,
      role: Role.USER,
    },
  });
  console.log(`   ✓ Guest user: guest@example.com (read-only)\n`);

  console.log('✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Admin:  ${adminEmail} / ${adminPassword}`);
  console.log('   Guest:  guest@example.com / guest123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
