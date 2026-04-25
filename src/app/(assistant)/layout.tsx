import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="h-screen bg-background">
      <main className="h-full">{children}</main>
    </div>
  );
}
