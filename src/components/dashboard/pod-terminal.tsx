'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Power, RotateCcw } from 'lucide-react';

interface PodTerminalProps {
  clusterId: string;
  namespace: string;
  podName: string;
  container?: string;
  containers?: string[];
}

type ConnState = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

const SHELL_OPTIONS = [
  { value: '/bin/sh', label: 'sh' },
  { value: '/bin/bash', label: 'bash' },
] as const;

export function PodTerminal({
  clusterId,
  namespace,
  podName,
  container,
  containers,
}: PodTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [shell, setShell] = useState<string>('/bin/sh');
  const [state, setState] = useState<ConnState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: { background: '#0a0a0a' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => {
      try {
        fit.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        // best-effort
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      wsRef.current?.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  const connect = () => {
    const term = termRef.current;
    if (!term) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }

    setState('connecting');
    setStatusMessage('');
    term.clear();
    term.writeln(`\x1b[2mconnecting to ${podName} (${shell})...\x1b[0m`);

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      namespace,
      command: shell,
    });
    if (container) params.set('container', container);
    const url = `${proto}//${window.location.host}/api/ws/clusters/${encodeURIComponent(clusterId)}/pods/${encodeURIComponent(podName)}/exec?${params.toString()}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setState('connected');
      // Send initial size so the pod knows the dimensions.
      try {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      } catch {
        // best-effort
      }
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data === 'string') {
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed?.type === 'status') {
            const human = parsed.message || parsed.reason || parsed.status;
            if (human) setStatusMessage(String(human));
            if (parsed.status === 'error') setState('error');
            if (parsed.status === 'closed') setState('closed');
          }
        } catch {
          term.write(evt.data);
        }
      } else if (evt.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(evt.data));
      } else if (evt.data instanceof Blob) {
        evt.data.arrayBuffer().then((buf) => term.write(new Uint8Array(buf)));
      }
    };

    ws.onerror = () => {
      setState('error');
      setStatusMessage('connection error');
    };

    ws.onclose = (evt) => {
      setState((prev) => (prev === 'connected' ? 'closed' : prev));
      if (evt.reason) setStatusMessage(evt.reason);
      term.writeln(`\r\n\x1b[2m[disconnected]\x1b[0m`);
    };

    // Pipe terminal input to the WebSocket as binary.
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });
  };

  const disconnect = () => {
    wsRef.current?.close();
  };

  const variantForState = (s: ConnState): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (s) {
      case 'connected': return 'default';
      case 'connecting': return 'secondary';
      case 'error': return 'destructive';
      case 'closed': return 'outline';
      default: return 'outline';
    }
  };

  const isLive = state === 'connected' || state === 'connecting';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={variantForState(state)}>{state}</Badge>
        {statusMessage && (
          <span className="text-xs text-muted-foreground truncate max-w-[400px]" title={statusMessage}>
            {statusMessage}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Shell:</span>
          <Select value={shell} onValueChange={setShell} disabled={isLive}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHELL_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLive ? (
            <Button size="sm" onClick={connect} className="h-8 text-xs">
              <Power className="mr-1 h-3 w-3" /> Connect
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={disconnect} className="h-8 text-xs">
              <Power className="mr-1 h-3 w-3" /> Disconnect
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (isLive) disconnect();
              setTimeout(connect, 200);
            }}
            disabled={state === 'connecting'}
            className="h-8 text-xs"
            title="Reconnect"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <Card className="p-2 bg-black">
        <div ref={hostRef} className="h-[480px]" />
      </Card>
      {!isLive && (
        <p className="text-xs text-muted-foreground">
          Click Connect to open an interactive shell. Sessions auto-terminate after 30 minutes idle.
          {containers && containers.length > 1 && container && (
            <> Targeting container <code>{container}</code>.</>
          )}
        </p>
      )}
    </div>
  );
}
