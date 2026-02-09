'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    fetch('/api/openapi')
      .then((res) => res.json())
      .then((data) => setSpec(data));
  }, []);

  if (!spec) {
    return <div className="text-sm text-muted-foreground">Loading API docs...</div>;
  }

  return (
    <div className="h-full w-full">
      <SwaggerUI spec={spec} docExpansion="list" />
    </div>
  );
}
