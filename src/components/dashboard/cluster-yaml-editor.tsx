'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MonacoEditor } from '@/components/gitops/monaco-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';

interface ClusterYamlEditorProps {
  clusterId: string;
  apiVersion?: string;
  kind: string;
  name: string;
  namespace?: string;
  /** When true, hide the Save button (read-only viewer). */
  readOnly?: boolean;
}

export function ClusterYamlEditor({
  clusterId,
  apiVersion = 'v1',
  kind,
  name,
  namespace,
  readOnly = false,
}: ClusterYamlEditorProps) {
  const [original, setOriginal] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ apiVersion, kind, name });
      if (namespace) params.set('namespace', namespace);
      const res = await fetch(`/api/clusters/${clusterId}/yaml?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      setOriginal(data.data.yaml || '');
      setDraft(data.data.yaml || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load YAML');
    } finally {
      setLoading(false);
    }
  }, [clusterId, apiVersion, kind, name, namespace]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      toast.success(`${kind}/${name} applied`);
      setOriginal(data.data.yaml || draft);
      setDraft(data.data.yaml || draft);
    } catch (e: any) {
      toast.error(e?.message || 'Apply failed');
    } finally {
      setSaving(false);
    }
  };

  const dirty = draft !== original;

  if (loading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 border rounded-md">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={() => void load()} className="ml-auto">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {apiVersion} · {kind}/{name}
          {namespace && <> · ns: {namespace}</>}
          {dirty && <span className="text-amber-600 dark:text-amber-400 ml-2">• unsaved changes</span>}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft(original)}
              disabled={!dirty || saving}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revert
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Apply
            </Button>
          </div>
        )}
      </div>
      <div className="border rounded-md overflow-hidden h-[500px]">
        <MonacoEditor
          value={draft}
          onChange={(v) => setDraft(v ?? '')}
          language="yaml"
          readOnly={readOnly}
          height="100%"
        />
      </div>
    </div>
  );
}
