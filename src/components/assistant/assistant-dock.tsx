"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOrganizationStore } from "@/store/organization-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, X, Maximize2, Minimize2, ExternalLink } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: string;
  links?: string[];
}

const pageLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/organizations": "Organizations",
  "/repositories": "Repositories",
  "/pull-requests": "Pull Requests",
  "/github-actions": "GitHub Actions",
  "/gitops-studio": "GitOps Studio",
  "/deployments": "Deployments",
  "/argocd": "ArgoCD",
  "/monitoring": "Monitoring",
  "/storage": "Log Browser",
  "/clusters": "Clusters",
  "/helm": "Helm",
  "/alerts": "Alerts",
  "/vulnerability": "Vulnerability",
  "/mcp": "MCP",
  "/uptime-kuma": "Uptime Kuma",
  "/api-docs": "API Docs",
  "/settings": "Settings",
  "/team": "Team",
};

export function AssistantDock() {
  const pathname = usePathname();
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization);
  const setOrganization = useOrganizationStore((state) => state.setOrganization);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"compact" | "full">("compact");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [routing, setRouting] = useState<"auto" | "knowledge" | "fastworkflow" | "mcp" | "llm" | "ollama">("auto");
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [mcpUrlOverride, setMcpUrlOverride] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const orgId = currentOrganization?.id;
  const pageLabel = pageLabels[pathname] || "Page";
  const contextText = `Page: ${pageLabel}\nPath: ${pathname}`;

  // Derive OpenWebUI URL from org settings or default to the next.js rewrite path
  const openWebUIUrl = settings?.openwebui?.url || "/openwebui";
  const openWebUIEnabled = settings?.openwebui?.enabled !== false;

  useEffect(() => {
    if (currentOrganization?.id) return;
    let cancelled = false;
    async function loadOrg() {
      const res = await fetch("/api/organizations");
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
      const res = await fetch("/api/organizations/settings", {
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.data || {});
        setLlmConfigured(!!data.data?.llm?.credentialId);
      }
    };
    loadSettings();
  }, [orgId]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending && !!orgId, [input, sending, orgId]);

  const sendMessage = async () => {
    if (!canSend) return;
    const content = input.trim();
    setInput("");
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const res = await fetch("/api/mcp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId as string,
        },
        body: JSON.stringify({
          message: content,
          context: contextText,
          preferredSource: routing === "auto" ? undefined : routing,
          mcpServerUrl: routing === "mcp" ? mcpUrlOverride || settings?.mcp?.mcpServerUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Unable to get a response");
      }
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: data?.data?.response || "No response",
        source: data?.data?.source,
        links: data?.data?.links || [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          text: (error as Error).message || "Failed to respond",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Dock dimensions based on view mode
  const dockClass = viewMode === "full"
    ? "flex h-[600px] w-[700px] flex-col rounded-xl border bg-card shadow-xl"
    : "flex h-[520px] w-[380px] flex-col rounded-xl border bg-card shadow-xl";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className={dockClass}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Assistant</p>
              <p className="text-xs text-muted-foreground">
                {viewMode === "full" ? "Full UI (OpenWebUI)" : `Context: ${pageLabel}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {openWebUIEnabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode(viewMode === "compact" ? "full" : "compact")}
                  title={viewMode === "compact" ? "Switch to Full UI" : "Switch to Compact"}
                >
                  {viewMode === "compact" ? (
                    <Maximize2 className="h-4 w-4" />
                  ) : (
                    <Minimize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              <a href="/assistant/full" target="_blank" rel="noreferrer">
                <Button variant="ghost" size="icon" title="Open in new tab">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close assistant</span>
              </Button>
            </div>
          </div>

          {viewMode === "full" ? (
            /* Full mode: OpenWebUI iframe */
            <iframe
              src={openWebUIUrl}
              className="flex-1 w-full border-0"
              title="OpenWebUI"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          ) : (
            /* Compact mode: our custom chat UI */
            <>
              <div className="border-b px-3 py-2">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Routing</div>
                  <Select value={routing} onValueChange={(value) => setRouting(value as any)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select routing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Fastworkflow → Ollama → LLM → Knowledge)</SelectItem>
                      <SelectItem value="ollama">Ollama (local)</SelectItem>
                      <SelectItem value="knowledge">Knowledge only</SelectItem>
                      <SelectItem value="fastworkflow">Fastworkflow only</SelectItem>
                      <SelectItem value="llm">
                        LLM{llmConfigured === false ? " (requires config)" : ""}
                      </SelectItem>
                      <SelectItem value="mcp">MCP server</SelectItem>
                    </SelectContent>
                  </Select>
                  {routing === "llm" && llmConfigured === false ? (
                    <a
                      href="/settings?tab=integrations"
                      className="text-xs text-primary underline"
                    >
                      Configure LLM in Settings
                    </a>
                  ) : null}
                  {routing === "mcp" ? (
                    <Input
                      className="h-8"
                      placeholder={settings?.mcp?.mcpServerUrl || "https://mcp.example.com"}
                      value={mcpUrlOverride}
                      onChange={(e) => setMcpUrlOverride(e.target.value)}
                    />
                  ) : null}
                </div>
              </div>

              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Ask about Kubernetes or Helm commands. Example: &quot;How do I get the list of pods?&quot;
                  </div>
                ) : null}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <p>{message.text}</p>
                    {message.role === "assistant" && message.source ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{message.source}</Badge>
                        {message.links?.length ? (
                          <a
                            href={message.links[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-rl-blue underline"
                          >
                            Reference
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="border-t px-3 py-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
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
            </>
          )}
        </div>
      ) : (
        <Button className="h-12 w-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
