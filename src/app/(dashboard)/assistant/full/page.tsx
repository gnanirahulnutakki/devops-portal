'use client';

import { useEffect, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AssistantFullPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);
  const orgId = currentOrganization?.id;
  const [openWebUIUrl, setOpenWebUIUrl] = useState('/openwebui');

  useEffect(() => {
    if (currentOrganization?.id) return;
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
  }, [currentOrganization?.id, setOrganization]);

  useEffect(() => {
    if (!orgId) return;
    const loadSettings = async () => {
      const res = await fetch('/api/organizations/settings', {
        headers: { 'x-organization-id': orgId },
      });
      const data = await res.json();
      if (res.ok && data.data?.openwebui?.url) {
        setOpenWebUIUrl(data.data.openwebui.url);
      }
    };
    loadSettings();
  }, [orgId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Powered by Ollama (qwen2.5:3b) via OpenWebUI
          </p>
        </div>
      </div>
      <iframe
        src={openWebUIUrl}
        className="flex-1 w-full border-0"
        title="OpenWebUI Assistant"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  );
}
