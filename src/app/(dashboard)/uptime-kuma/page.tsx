'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, ShieldCheck } from 'lucide-react';

export default function UptimeKumaPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/integrations/uptime-kuma/accounts');
    const data = await res.json();
    if (res.ok) {
      setAccounts(data.data || []);
      // Functional updater avoids depending on selectedAccount (which would
      // make this callback churn on every selection).
      setSelectedAccount((current) => current || data.data?.[0]?.id || '');
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Uptime Kuma</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View monitors and alerts from connected Kuma instances
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAccounts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>Select an account to load monitors</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger>
              <SelectValue placeholder="Select Uptime Kuma account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name || 'default'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!accounts.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No Uptime Kuma accounts configured yet. Add one in Settings → Integrations.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Monitor listing will appear here once the backend connector is enabled.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
