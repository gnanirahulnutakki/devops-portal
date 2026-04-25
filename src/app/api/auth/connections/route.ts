import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { githubTokens } from '@/lib/token-store';

const deleteSchema = z.object({
  provider: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: {
      provider: true,
      type: true,
      providerAccountId: true,
    },
  });

  return NextResponse.json({
    data: accounts,
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const parsed = deleteSchema.safeParse({
    provider: url.searchParams.get('provider'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid request' } },
      { status: 400 }
    );
  }

  const provider = parsed.data.provider;

  // Prevent unlinking the primary SSO provider in a way that would lock users out.
  if (provider === 'keycloak') {
    return NextResponse.json(
      { error: { message: 'Keycloak connection cannot be unlinked from the UI.' } },
      { status: 400 }
    );
  }

  await prisma.account.deleteMany({
    where: {
      userId: session.user.id,
      provider,
    },
  });

  if (provider === 'github') {
    // Remove encrypted GitHub token cache (if any)
    await githubTokens.delete(session.user.id);
  }

  return NextResponse.json({ ok: true });
}

