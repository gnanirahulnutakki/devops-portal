'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  KeyRound,
  Github,
  Link2,
  Shield,
  Bell,
  Palette,
} from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={session?.user?.image ?? undefined} />
                <AvatarFallback className="text-2xl">
                  {session?.user?.name?.charAt(0) ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div>
                  <p className="text-lg font-semibold">{session?.user?.name ?? 'User'}</p>
                  <p className="text-gray-600 dark:text-gray-400">{session?.user?.email ?? '-'}</p>
                </div>
                <Badge variant="secondary">
                  ID: {session?.user?.id ?? '-'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connections
            </CardTitle>
            <CardDescription>Linked accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <KeyRound className="h-5 w-5 text-rl-navy" />
                </div>
                <div>
                  <p className="font-medium">Keycloak SSO</p>
                  <p className="text-sm text-gray-500">Primary login</p>
                </div>
              </div>
              <Badge variant="default">Connected</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Github className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">GitHub</p>
                  <p className="text-sm text-gray-500">Repository access</p>
                </div>
              </div>
              {session?.user?.hasGitHubConnection ? (
                <Badge variant="default">Connected</Badge>
              ) : (
                <Button size="sm" variant="outline">Connect</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* More Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Security preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Two-factor authentication</span>
                <Badge variant="outline">Via SSO</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Session timeout</span>
                <span className="text-sm text-gray-500">24 hours</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Alert preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Sync failures</span>
                <Badge variant="default">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Health alerts</span>
                <Badge variant="default">Enabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Display preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <Badge variant="outline">System</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Compact mode</span>
                <Badge variant="outline">Off</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
