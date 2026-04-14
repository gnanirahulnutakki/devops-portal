'use client';

import { useState } from 'react';

export default function ProtocolTestPage() {
  const [agentName, setAgentName] = useState('rlqa-usw2-dev01');
  const [adapterName, setAdapterName] = useState('k8s-get-pods');
  const [namespace, setNamespace] = useState('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/protocol/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          adapter_name: adapterName,
          params: { namespace },
        }),
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!res.ok) {
        setError(`${res.status} ${res.statusText}${typeof parsed === 'string' ? `: ${parsed}` : ''}`);
        setResult(parsed);
        return;
      }
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Protocol Test — Multi-Cluster Day-2 Action Protocol
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          POSTs to <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">/api/protocol/execute</code> (proxied to
          the protocol gateway).
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-1">
          <label htmlFor="agent_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            agent_name
          </label>
          <input
            id="agent_name"
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="adapter_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            adapter_name
          </label>
          <input
            id="adapter_name"
            type="text"
            value={adapterName}
            onChange={(e) => setAdapterName(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="namespace" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            namespace
          </label>
          <input
            id="namespace"
            type="text"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Executing…' : 'Execute'}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {result !== null && (
        <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
