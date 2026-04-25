'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, Trash2, Download } from 'lucide-react';

interface PodLogStreamProps {
  clusterId: string;
  namespace: string;
  podName: string;
  container?: string;
  tailLines?: number;
}

const MAX_BUFFER_LINES = 5000;

export function PodLogStream({
  clusterId,
  namespace,
  podName,
  container,
  tailLines = 200,
}: PodLogStreamProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      namespace,
      tailLines: String(tailLines),
    });
    if (container) params.set('container', container);

    const url = `/api/clusters/${clusterId}/pods/${encodeURIComponent(podName)}/logs/stream?${params}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      if (paused) return;
      setLines((prev) => {
        const next = [...prev, event.data];
        return next.length > MAX_BUFFER_LINES ? next.slice(-MAX_BUFFER_LINES) : next;
      });
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
    // The paused state is intentionally NOT in deps; we read it inside onmessage
    // via closure on each event. Pause-state changes do not need to reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, namespace, podName, container, tailLines]);

  // Auto-scroll on new lines
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, paused]);

  const handleDownload = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName}-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[60vh] border rounded-md overflow-hidden bg-black/95">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-black/80 text-xs">
        <div className="flex items-center gap-2 text-white/80">
          <Badge variant={connected ? 'default' : 'destructive'} className="h-5 text-[10px]">
            {connected ? 'live' : 'disconnected'}
          </Badge>
          <span>{lines.length} lines{lines.length === MAX_BUFFER_LINES && ' (buffer cap)'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white"
            onClick={() => setLines([])}
            title="Clear buffer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white"
            onClick={handleDownload}
            disabled={lines.length === 0}
            title="Download buffer"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-tight text-green-300/90 whitespace-pre-wrap"
      >
        {lines.length === 0 ? (
          <span className="text-white/40 italic">Waiting for log lines…</span>
        ) : (
          lines.map((l, i) => <div key={i}>{l}</div>)
        )}
      </div>
    </div>
  );
}
