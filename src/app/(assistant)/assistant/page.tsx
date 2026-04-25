"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrganizationStore } from '@/store/organization-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, X, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
  links?: string[];
}

export default function AssistantPopupPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const orgId = currentOrganization?.id;

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
    const container = listRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const sendMessage = async () => {
    if (!canSend || !orgId) return;
    const content = input.trim();
    setInput('');
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const res = await fetch('/api/mcp/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId,
        },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Unable to get a response');
      }
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: data?.data?.response || 'No response',
        source: data?.data?.source,
        links: data?.data?.links || [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: 'assistant',
          text: (error as Error).message || 'Failed to respond',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rl-orange" />
          <div>
            <p className="text-sm font-semibold">Assistant</p>
            <p className="text-xs text-muted-foreground">MCP + knowledge base</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => window.close()}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ask about Kubernetes or Helm commands. Example: “How do I get the list of pods?”
          </div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            <p>{message.text}</p>
            {message.role === 'assistant' && message.source ? (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{message.source}</Badge>
                {message.links?.length ? (
                  <a
                    href={message.links[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-rl-blue underline"
                  >
                    Reference
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!canSend}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
