'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Key, Shield } from 'lucide-react';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    fetch('/api/openapi')
      .then((res) => res.json())
      .then((data) => setSpec(data));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Interactive reference for the DevOps Portal REST API
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>How to authenticate with the API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Session Cookie</span>
                <Badge variant="outline">Primary</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                The portal uses cookie-based session authentication via NextAuth. When logged in through the UI,
                requests are automatically authenticated via the <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">next-auth.session-token</code> cookie.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Organization Header</span>
                <Badge variant="secondary">Required for most endpoints</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Multi-tenant endpoints require the <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">x-organization-id</code> header
                to scope data to your organization. The UI sets this automatically.
              </p>
            </div>
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Try it out</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click any endpoint below, then click &quot;Try it out&quot; to send requests directly from the browser.
                Your session cookie is included automatically. For organization-scoped endpoints,
                paste your organization ID in the <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">x-organization-id</code> field.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card">
        {!spec ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Loading API docs...
          </div>
        ) : (
          <SwaggerUI spec={spec} docExpansion="list" />
        )}
      </div>
    </div>
  );
}
