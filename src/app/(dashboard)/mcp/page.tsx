'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plug, Puzzle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const mockServers = [
  { id: 'mcp-001', name: 'EOC MCP', url: 'https://mcp.internal/api', status: 'connected' },
  { id: 'mcp-002', name: 'K8s MCP', url: 'https://k8s.mcp/api', status: 'disconnected' },
];

export default function McpPage() {
  const [servers, setServers] = useState(mockServers);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Placeholder until MCP server discovery is wired to a backend provider.
      // Keeps the UX consistent (and avoids a dead refresh button).
      setServers([...mockServers]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">MCP</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Connect Model Context Protocol servers for automation and diagnostics
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            MCP Configuration
          </CardTitle>
          <CardDescription>
            Account setup and routing preferences live in Settings.{' '}
            <Link className="text-rl-blue underline" href="/settings">
              Go to Settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Add MCP Server
          </CardTitle>
          <CardDescription>Register a new MCP endpoint for tools and resources</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="https://mcp.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button disabled={!name || !url}>Save Server</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Connected Servers
          </CardTitle>
          <CardDescription>Discover tools, resources, and actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {servers.map((server) => (
            <div key={server.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{server.name}</p>
                <p className="text-sm text-muted-foreground">{server.url}</p>
              </div>
              <Badge variant={server.status === 'connected' ? 'secondary' : 'outline'}>
                {server.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
