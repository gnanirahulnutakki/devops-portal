'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAdmin, useOrganizationStore } from '@/store/organization-store';
import { toast } from 'sonner';
import {
  User,
  KeyRound,
  Github,
  Chrome,
  AppWindow,
  Link2,
  Shield,
  Bell,
  Palette,
  Building2,
  Plug,
  ShieldCheck,
  GitBranch,
  Users,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);
  const orgId = currentOrganization?.id;
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [savingGrafana, setSavingGrafana] = useState(false);
  const [connections, setConnections] = useState<Array<{ provider: string; type: string }>>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<Record<string, any> | null>(null);
  const [githubAccounts, setGithubAccounts] = useState<any[]>([]);
  const [grafanaAccounts, setGrafanaAccounts] = useState<any[]>([]);
  const [uptimeAccounts, setUptimeAccounts] = useState<any[]>([]);
  const [llmAccounts, setLlmAccounts] = useState<any[]>([]);
  const [githubForm, setGithubForm] = useState({ name: 'default', token: '', organization: '' });
  const [grafanaForm, setGrafanaForm] = useState({ name: 'default', url: '', apiKey: '' });
  const [uptimeForm, setUptimeForm] = useState({ name: 'default', url: '', apiKey: '' });
  const [argocdAccounts, setArgocdAccounts] = useState<any[]>([]);
  const [argocdForm, setArgocdForm] = useState({ name: 'default', url: '', token: '', insecure: false });
  const [llmForm, setLlmForm] = useState({
    name: 'default',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
  });

  // Team tab state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Organization tab state (placeholder — read usage TBD)
  const [_orgDetails, setOrgDetails] = useState<any>(null);

  const defaultTab = searchParams.get('tab') || 'profile';

  useEffect(() => {
    if (orgId) return;
    let cancelled = false;
    async function loadOrg() {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      if (cancelled || !res.ok || !data.data?.length) return;
      setOrganization(data.data[0]);
    }
    loadOrg();
    return () => {
      cancelled = true;
    };
  }, [orgId, setOrganization]);

  const loadSettings = async () => {
    if (!orgId) return;
    const res = await fetch('/api/organizations/settings', {
      headers: { 'x-organization-id': orgId },
    });
    const data = await res.json();
    if (res.ok) {
      setDraft(data.data || {});
    }
  };

  const loadAccounts = async () => {
    if (!orgId) return;
    const [githubRes, grafanaRes, uptimeRes, llmRes, argocdRes] = await Promise.all([
      fetch('/api/integrations/github/accounts', { headers: { 'x-organization-id': orgId } }),
      fetch('/api/integrations/grafana/accounts', { headers: { 'x-organization-id': orgId } }),
      fetch('/api/integrations/uptime-kuma/accounts', { headers: { 'x-organization-id': orgId } }),
      fetch('/api/integrations/llm/accounts', { headers: { 'x-organization-id': orgId } }),
      fetch('/api/integrations/argocd/accounts', { headers: { 'x-organization-id': orgId } }),
    ]);
    const [githubData, grafanaData, uptimeData, llmData, argocdData] = await Promise.all([
      githubRes.json(),
      grafanaRes.json(),
      uptimeRes.json(),
      llmRes.json(),
      argocdRes.json(),
    ]);
    if (githubRes.ok) setGithubAccounts(githubData.data || []);
    if (grafanaRes.ok) setGrafanaAccounts(grafanaData.data || []);
    if (uptimeRes.ok) setUptimeAccounts(uptimeData.data || []);
    if (llmRes.ok) setLlmAccounts(llmData.data || []);
    if (argocdRes.ok) setArgocdAccounts(argocdData.data || []);
  };

  useEffect(() => {
    loadSettings();
    loadAccounts();
  }, [orgId]);

  const loadConnections = async () => {
    setConnectionsLoading(true);
    try {
      const res = await fetch('/api/auth/connections');
      const data = await res.json();
      if (res.ok) {
        setConnections(data.data || []);
      }
    } finally {
      setConnectionsLoading(false);
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProviders() {
      try {
        const res = await fetch('/api/auth/providers');
        const data = await res.json();
        if (cancelled) return;
        setAvailableProviders(data || {});
      } catch {
        setAvailableProviders({});
      }
    }
    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load team members
  const loadTeam = async () => {
    if (!orgId) return;
    setTeamLoading(true);
    try {
      const res = await fetch('/api/organizations/members', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok) setTeamMembers(data.data || []);
    } finally {
      setTeamLoading(false);
    }
  };

  // Load org details
  const loadOrgDetails = async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}`);
      const data = await res.json();
      if (res.ok) setOrgDetails(data.data || null);
    } catch { /* ignore */ }
  };

  const isConnected = (provider: string) => connections.some((a) => a.provider === provider);
  const isProviderEnabled = (provider: string) => (availableProviders ? !!availableProviders[provider] : true);

  const disconnect = async (provider: string) => {
    await fetch(`/api/auth/connections?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
    await loadConnections();
  };

  const updateSettings = async (payload: any) => {
    if (!orgId) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to update organization settings.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/organizations/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to update settings (HTTP ${res.status})`);
      setSaving(false);
      return;
    }
    toast.success('Settings saved.');
    setDraft(data.data || {});
    setSaving(false);
  };

  const saveGithubAccount = async () => {
    if (!orgId || !githubForm.name || !githubForm.token) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to add GitHub accounts for this organization.');
      return;
    }
    const res = await fetch('/api/integrations/github/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify({
        name: githubForm.name,
        token: githubForm.token,
        organization: githubForm.organization || undefined,
      }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to save GitHub account (HTTP ${res.status})`);
      return;
    }
    toast.success('GitHub account saved.');
    setGithubForm((prev) => ({ ...prev, token: '' }));
    await loadAccounts();
  };

  const saveGrafanaAccount = async () => {
    if (!orgId || !grafanaForm.name || !grafanaForm.url || !grafanaForm.apiKey) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to add Grafana accounts for this organization.');
      return;
    }
    setSavingGrafana(true);
    const res = await fetch('/api/integrations/grafana/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify(grafanaForm),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to save Grafana account (HTTP ${res.status})`);
      setSavingGrafana(false);
      return;
    }
    toast.success('Grafana account saved.');
    setGrafanaForm((prev) => ({ ...prev, apiKey: '' }));
    await loadAccounts();
    setSavingGrafana(false);
  };

  const saveUptimeAccount = async () => {
    if (!orgId || !uptimeForm.name || !uptimeForm.url || !uptimeForm.apiKey) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to add Uptime Kuma accounts for this organization.');
      return;
    }
    const res = await fetch('/api/integrations/uptime-kuma/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify(uptimeForm),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to save Uptime Kuma account (HTTP ${res.status})`);
      return;
    }
    toast.success('Uptime Kuma account saved.');
    setUptimeForm((prev) => ({ ...prev, apiKey: '' }));
    await loadAccounts();
  };

  const saveLlmAccount = async () => {
    if (!orgId || !llmForm.name || !llmForm.provider || !llmForm.apiKey) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to add LLM accounts for this organization.');
      return;
    }
    const res = await fetch('/api/integrations/llm/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify({
        name: llmForm.name,
        provider: llmForm.provider,
        apiKey: llmForm.apiKey,
        baseUrl: llmForm.baseUrl || undefined,
        model: llmForm.model || undefined,
      }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to save LLM account (HTTP ${res.status})`);
      return;
    }
    toast.success('LLM account saved.');
    setLlmForm((prev) => ({ ...prev, apiKey: '' }));
    await loadAccounts();
  };

  const saveArgocdAccount = async () => {
    if (!orgId || !argocdForm.name || !argocdForm.url || !argocdForm.token) return;
    if (!isAdmin(currentOrganization?.role)) {
      toast.error('Admin role required to add ArgoCD accounts for this organization.');
      return;
    }
    const res = await fetch('/api/integrations/argocd/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': orgId },
      body: JSON.stringify(argocdForm),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      toast.error(data?.error?.message || `Failed to save ArgoCD account (HTTP ${res.status})`);
      return;
    }
    toast.success('ArgoCD account saved.');
    setArgocdForm((prev) => ({ ...prev, token: '' }));
    await loadAccounts();
  };

  const githubOptions = useMemo(
    () => githubAccounts.map((cred) => ({ value: cred.id, label: cred.name || 'default' })),
    [githubAccounts]
  );
  const uptimeOptions = useMemo(
    () => uptimeAccounts.map((cred) => ({ value: cred.id, label: cred.name || 'default' })),
    [uptimeAccounts]
  );
  const grafanaOptions = useMemo(
    () => grafanaAccounts.map((cred) => ({ value: cred.id, label: cred.name || 'default' })),
    [grafanaAccounts]
  );
  const argocdOptions = useMemo(
    () => argocdAccounts.map((cred) => ({ value: cred.id, label: cred.name || 'default' })),
    [argocdAccounts]
  );
  const llmOptions = useMemo(
    () => llmAccounts.map((cred) => ({ value: cred.id, label: cred.name || 'default' })),
    [llmAccounts]
  );

  const canEditOrgSettings = currentOrganization?.role === 'ADMIN';
  const featureKeys: Array<{ key: string; label: string; defaultMinRole: 'USER' | 'READWRITE' | 'ADMIN' }> = [
    { key: 'vulnerability', label: 'Vulnerability', defaultMinRole: 'USER' },
    { key: 'mcp', label: 'MCP', defaultMinRole: 'READWRITE' },
    { key: 'diagrams', label: 'Diagrams', defaultMinRole: 'USER' },
    { key: 'helm', label: 'Helm', defaultMinRole: 'READWRITE' },
    { key: 'gitOpsStudio', label: 'GitOps Studio', defaultMinRole: 'ADMIN' },
  ];

  const handleTabChange = (tab: string) => {
    router.replace(`/settings?tab=${tab}`, { scroll: false });
    if (tab === 'team') loadTeam();
    if (tab === 'organization') loadOrgDetails();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account, integrations, team, and organization
        </p>
      </div>

      <Tabs defaultValue={defaultTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="organization">
            <Building2 className="h-4 w-4 mr-2" />
            Organization
          </TabsTrigger>
        </TabsList>

        {/* ======================== PROFILE TAB ======================== */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Connections
                </CardTitle>
                <CardDescription>Linked accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProviderEnabled('keycloak') && (
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
                    {isConnected('keycloak') ? (
                      <Badge variant="default">Connected</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => signIn('keycloak', { callbackUrl: '/settings' })} disabled={connectionsLoading}>
                        Connect
                      </Button>
                    )}
                  </div>
                )}

                {isProviderEnabled('github') && (
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
                    {isConnected('github') ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Connected</Badge>
                        <Button size="sm" variant="ghost" onClick={() => disconnect('github')} disabled={connectionsLoading}>
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => signIn('github', { callbackUrl: '/settings' })} disabled={connectionsLoading}>
                        Connect
                      </Button>
                    )}
                  </div>
                )}

                {isProviderEnabled('google') && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <Chrome className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Google</p>
                        <p className="text-sm text-gray-500">OAuth login</p>
                      </div>
                    </div>
                    {isConnected('google') ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Connected</Badge>
                        <Button size="sm" variant="ghost" onClick={() => disconnect('google')} disabled={connectionsLoading}>
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => signIn('google', { callbackUrl: '/settings' })} disabled={connectionsLoading}>
                        Connect
                      </Button>
                    )}
                  </div>
                )}

                {isProviderEnabled('azure-ad') && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <AppWindow className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Microsoft</p>
                        <p className="text-sm text-gray-500">Entra ID (Azure AD)</p>
                      </div>
                    </div>
                    {isConnected('azure-ad') ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Connected</Badge>
                        <Button size="sm" variant="ghost" onClick={() => disconnect('azure-ad')} disabled={connectionsLoading}>
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => signIn('azure-ad', { callbackUrl: '/settings' })} disabled={connectionsLoading}>
                        Connect
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                    <span className="text-sm text-muted-foreground">Manage 2FA in Keycloak</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${window.location.origin}/keycloak/realms/devops-portal/account/#/security`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Setup 2FA
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Session timeout</span>
                    <span className="text-sm text-gray-500">8 hours</span>
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
        </TabsContent>

        {/* ======================== INTEGRATIONS TAB ======================== */}
        <TabsContent value="integrations" className="space-y-6 mt-6">
          {/* GitHub Accounts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  GitHub Accounts
                </CardTitle>
                <CardDescription>Store personal access tokens securely for API access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Default GitHub Account</Label>
                  <Select
                    value={draft?.github?.credentialId || ''}
                    onValueChange={(value) => setDraft((prev: any) => ({ ...prev, github: { credentialId: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {githubOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>
                  Save GitHub Settings
                </Button>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Add GitHub Account</p>
                  <div className="grid gap-3">
                    <Input placeholder="Account name" value={githubForm.name} onChange={(e) => setGithubForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <Input placeholder="Personal access token" type="password" value={githubForm.token} onChange={(e) => setGithubForm((prev) => ({ ...prev, token: e.target.value }))} />
                    <Input placeholder="Organization (optional)" value={githubForm.organization} onChange={(e) => setGithubForm((prev) => ({ ...prev, organization: e.target.value }))} />
                    <Button onClick={saveGithubAccount} disabled={saving}>Save GitHub Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Grafana Accounts
                </CardTitle>
                <CardDescription>Configure Grafana endpoints and API keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Default Grafana Account</Label>
                  <Select
                    value={draft?.grafana?.credentialId || ''}
                    onValueChange={(value) => setDraft((prev: any) => ({ ...prev, grafana: { credentialId: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {grafanaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save Grafana Settings</Button>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Add Grafana Account</p>
                  <div className="grid gap-3">
                    <Input placeholder="Account name" value={grafanaForm.name} onChange={(e) => setGrafanaForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <Input placeholder="https://grafana.example.com" value={grafanaForm.url} onChange={(e) => setGrafanaForm((prev) => ({ ...prev, url: e.target.value }))} />
                    <Input placeholder="API key" type="password" value={grafanaForm.apiKey} onChange={(e) => setGrafanaForm((prev) => ({ ...prev, apiKey: e.target.value }))} />
                    {!isAdmin(currentOrganization?.role) ? (
                      <p className="text-xs text-muted-foreground">
                        Only <span className="font-medium">Admins</span> can add organization integration accounts.
                      </p>
                    ) : null}
                    <Button onClick={saveGrafanaAccount} disabled={savingGrafana || saving || !isAdmin(currentOrganization?.role)}>Save Grafana Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ArgoCD + Uptime Kuma */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  ArgoCD Accounts
                </CardTitle>
                <CardDescription>Configure ArgoCD server endpoints and tokens</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Default ArgoCD Account</Label>
                  <Select
                    value={draft?.argocd?.credentialId || ''}
                    onValueChange={(value) => setDraft((prev: any) => ({ ...prev, argocd: { credentialId: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {argocdOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save ArgoCD Settings</Button>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Add ArgoCD Account</p>
                  <div className="grid gap-3">
                    <Input placeholder="Account name" value={argocdForm.name} onChange={(e) => setArgocdForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <Input placeholder="https://argocd.example.com" value={argocdForm.url} onChange={(e) => setArgocdForm((prev) => ({ ...prev, url: e.target.value }))} />
                    <Input placeholder="Auth token" type="password" value={argocdForm.token} onChange={(e) => setArgocdForm((prev) => ({ ...prev, token: e.target.value }))} />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Skip TLS verification</p>
                        <p className="text-xs text-muted-foreground">For self-signed certificates</p>
                      </div>
                      <Switch checked={argocdForm.insecure} onCheckedChange={(checked) => setArgocdForm((prev) => ({ ...prev, insecure: checked }))} />
                    </div>
                    <Button onClick={saveArgocdAccount} disabled={saving}>Save ArgoCD Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Uptime Kuma
                </CardTitle>
                <CardDescription>Configure Uptime Kuma monitors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Default Uptime Kuma Account</Label>
                  <Select
                    value={draft?.uptimeKuma?.credentialId || ''}
                    onValueChange={(value) => setDraft((prev: any) => ({ ...prev, uptimeKuma: { credentialId: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {uptimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save Uptime Kuma Settings</Button>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Add Uptime Kuma Account</p>
                  <div className="grid gap-3">
                    <Input placeholder="Account name" value={uptimeForm.name} onChange={(e) => setUptimeForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <Input placeholder="https://kuma.example.com" value={uptimeForm.url} onChange={(e) => setUptimeForm((prev) => ({ ...prev, url: e.target.value }))} />
                    <Input placeholder="API key" type="password" value={uptimeForm.apiKey} onChange={(e) => setUptimeForm((prev) => ({ ...prev, apiKey: e.target.value }))} />
                    <Button onClick={saveUptimeAccount} disabled={saving}>Save Uptime Kuma Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LLM + MCP */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  LLM Accounts
                </CardTitle>
                <CardDescription>Configure hosted or self-hosted LLM providers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Default LLM Account</Label>
                  <Select
                    value={draft?.llm?.credentialId || ''}
                    onValueChange={(value) => setDraft((prev: any) => ({ ...prev, llm: { credentialId: value } }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {llmOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save LLM Settings</Button>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Add LLM Account</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Account name" value={llmForm.name} onChange={(e) => setLlmForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <Input placeholder="Provider (openai, anthropic, gemini)" value={llmForm.provider} onChange={(e) => setLlmForm((prev) => ({ ...prev, provider: e.target.value }))} />
                    <Input placeholder="API key" type="password" value={llmForm.apiKey} onChange={(e) => setLlmForm((prev) => ({ ...prev, apiKey: e.target.value }))} />
                    <Input placeholder="Base URL (optional)" value={llmForm.baseUrl} onChange={(e) => setLlmForm((prev) => ({ ...prev, baseUrl: e.target.value }))} />
                    <Input placeholder="Model (optional)" value={llmForm.model} onChange={(e) => setLlmForm((prev) => ({ ...prev, model: e.target.value }))} />
                    <Button onClick={saveLlmAccount} disabled={saving}>Save LLM Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  MCP Configuration
                </CardTitle>
                <CardDescription>Routing and MCP server defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Enable Fastworkflow</p>
                    <p className="text-sm text-muted-foreground">Route prompts through deterministic workflows</p>
                  </div>
                  <Switch
                    checked={draft?.mcp?.fastworkflowEnabled ?? true}
                    onCheckedChange={(checked) =>
                      setDraft((prev: any) => ({ ...prev, mcp: { ...prev?.mcp, fastworkflowEnabled: checked } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fastworkflow URL</Label>
                  <Input
                    placeholder="https://fastworkflow.internal"
                    value={draft?.mcp?.fastworkflowUrl || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, mcp: { ...prev?.mcp, fastworkflowUrl: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fastworkflow Tool Name</Label>
                  <Input
                    placeholder="command"
                    value={draft?.mcp?.fastworkflowToolName || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, mcp: { ...prev?.mcp, fastworkflowToolName: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>MCP Server URL</Label>
                  <Input
                    placeholder="https://mcp.example.com"
                    value={draft?.mcp?.mcpServerUrl || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, mcp: { ...prev?.mcp, mcpServerUrl: e.target.value } }))}
                  />
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save MCP Settings</Button>
              </CardContent>
            </Card>
          </div>

          {/* Ollama + OpenWebUI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  Ollama (Local LLM)
                </CardTitle>
                <CardDescription>Self-hosted LLM running in the cluster</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Enable Ollama</p>
                    <p className="text-sm text-muted-foreground">Use local LLM in the auto-routing chain</p>
                  </div>
                  <Switch
                    checked={draft?.ollama?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      setDraft((prev: any) => ({ ...prev, ollama: { ...prev?.ollama, enabled: checked } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ollama URL</Label>
                  <Input
                    placeholder="http://ollama:11434/v1"
                    value={draft?.ollama?.url || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, ollama: { ...prev?.ollama, url: e.target.value } }))}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for default in-cluster URL</p>
                </div>
                <div className="space-y-1">
                  <Label>Model</Label>
                  <Input
                    placeholder="qwen2.5:3b"
                    value={draft?.ollama?.model || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, ollama: { ...prev?.ollama, model: e.target.value } }))}
                  />
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save Ollama Settings</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  OpenWebUI
                </CardTitle>
                <CardDescription>Full-featured chat UI for the local LLM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Enable OpenWebUI</p>
                    <p className="text-sm text-muted-foreground">Show full UI toggle in the assistant dock</p>
                  </div>
                  <Switch
                    checked={draft?.openwebui?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      setDraft((prev: any) => ({ ...prev, openwebui: { ...prev?.openwebui, enabled: checked } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>OpenWebUI URL</Label>
                  <Input
                    placeholder="/openwebui"
                    value={draft?.openwebui?.url || ''}
                    onChange={(e) => setDraft((prev: any) => ({ ...prev, openwebui: { ...prev?.openwebui, url: e.target.value } }))}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for default (proxied via /openwebui)</p>
                </div>
                <Button onClick={() => updateSettings(draft)} disabled={saving}>Save OpenWebUI Settings</Button>
              </CardContent>
            </Card>
          </div>

          {/* Feature Access Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Feature Access Control
              </CardTitle>
              <CardDescription>
                Enable/disable portal sections and set the minimum role required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featureKeys.map((f) => {
                  const current = (draft?.features?.[f.key] || {}) as { enabled?: boolean; minRole?: string };
                  const enabled = current.enabled ?? true;
                  const minRole = (current.minRole as any) ?? f.defaultMinRole;
                  return (
                    <div key={f.key} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{f.label}</p>
                          <p className="text-xs text-muted-foreground">Key: {f.key}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={!canEditOrgSettings}
                          onCheckedChange={(checked) =>
                            setDraft((prev: any) => ({
                              ...prev,
                              features: {
                                ...(prev?.features || {}),
                                [f.key]: { ...(prev?.features?.[f.key] || {}), enabled: checked },
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 space-y-1">
                        <Label>Minimum role</Label>
                        <Select
                          value={minRole}
                          onValueChange={(value) =>
                            setDraft((prev: any) => ({
                              ...prev,
                              features: {
                                ...(prev?.features || {}),
                                [f.key]: { ...(prev?.features?.[f.key] || {}), minRole: value },
                              },
                            }))
                          }
                          disabled={!canEditOrgSettings}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">USER</SelectItem>
                            <SelectItem value="READWRITE">READWRITE</SelectItem>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => updateSettings(draft)} disabled={saving || !canEditOrgSettings}>
                  Save Feature Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== TEAM TAB ======================== */}
        <TabsContent value="team" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>Manage your organization&apos;s team</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/team')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Full Team Page
              </Button>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <p className="text-sm text-muted-foreground">Loading team members...</p>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No team members found.</p>
                  <Button variant="outline" className="mt-3" onClick={() => router.push('/team')}>
                    Manage Team
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.slice(0, 10).map((member: any) => (
                    <div key={member.id || member.userId} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.image} />
                          <AvatarFallback>{(member.name || member.email || '?')[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name || member.email}</p>
                          {member.email && member.name && (
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline">{member.role || 'USER'}</Badge>
                    </div>
                  ))}
                  {teamMembers.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing 10 of {teamMembers.length} members.{' '}
                      <button className="text-primary underline" onClick={() => router.push('/team')}>
                        View all
                      </button>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== ORGANIZATION TAB ======================== */}
        <TabsContent value="organization" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Details
                </CardTitle>
                <CardDescription>View and manage your organization</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/organizations')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Organizations
              </Button>
            </CardHeader>
            <CardContent>
              {currentOrganization ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{currentOrganization.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Slug</Label>
                      <p className="font-medium font-mono">{currentOrganization.slug}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Your Role</Label>
                      <Badge variant="outline" className="mt-1">{currentOrganization.role || 'USER'}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">ID</Label>
                      <p className="font-mono text-xs text-muted-foreground">{currentOrganization.id}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Button variant="outline" onClick={() => (window.location.href = '/select-organization?manage=1')}>
                      Switch Organization
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No organization selected.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
