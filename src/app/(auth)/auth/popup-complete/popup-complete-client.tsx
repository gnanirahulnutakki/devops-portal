'use client';

import { useEffect } from 'react';

export default function PopupCompleteClient({
  callbackUrl,
  status,
}: {
  callbackUrl: string;
  status: string;
}) {
  useEffect(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: 'auth:complete',
            status,
            callbackUrl,
          },
          window.location.origin
        );
        setTimeout(() => window.close(), 50);
        return;
      }
    } catch {
      // ignore
    }
    window.location.href = callbackUrl;
  }, [callbackUrl, status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Completing sign-in…</div>
    </div>
  );
}

