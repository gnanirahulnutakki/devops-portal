'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Github, KeyRound, Loader2, Mail, AlertCircle } from 'lucide-react';

function LoginContent() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider);
    setError(null);
    try {
      await signIn(provider, { callbackUrl });
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An error occurred during sign in');
    } finally {
      setIsLoading(null);
    }
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading('credentials');
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(null);
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Credentials sign in error:', err);
      setError('An error occurred during sign in');
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rl-navy via-rl-navy-light to-rl-navy-dark">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <Card className="w-full max-w-md mx-4 relative">
        <CardHeader className="space-y-1 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-rl shadow-lg">
              <span className="text-2xl font-bold text-white">R</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">DevOps Portal</CardTitle>
          <CardDescription>
            Sign in to manage your deployments and infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Credentials form */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading !== null}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading !== null}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-rl-orange hover:bg-rl-orange/90"
              disabled={isLoading !== null}
            >
              {isLoading === 'credentials' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Sign in with Email
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="text-center text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>Demo:</strong> admin@example.com / admin123
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* SSO Options */}
          <div className="grid grid-cols-2 gap-3">
            {/* Keycloak SSO */}
            <Button
              variant="outline"
              onClick={() => handleSignIn('keycloak')}
              disabled={isLoading !== null}
            >
              {isLoading === 'keycloak' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              SSO
            </Button>

            {/* GitHub OAuth */}
            <Button
              variant="outline"
              onClick={() => handleSignIn('github')}
              disabled={isLoading !== null}
            >
              {isLoading === 'github' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              GitHub
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our{' '}
            <a href="/terms" className="underline hover:text-primary">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-primary">
              Privacy Policy
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rl-navy via-rl-navy-light to-rl-navy-dark">
      <Card className="w-full max-w-md mx-4 relative">
        <CardHeader className="space-y-1 text-center">
          <Skeleton className="h-14 w-14 mx-auto rounded-xl" />
          <Skeleton className="h-8 w-48 mx-auto mt-4" />
          <Skeleton className="h-4 w-64 mx-auto mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
