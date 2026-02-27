/**
 * Dynamic system prompt that tells the LLM about available tools.
 *
 * The prompt adapts based on which integrations are configured,
 * so the model knows what data it can and cannot query.
 */

const BASE_PROMPT = `You are the DevOps Portal assistant with access to live infrastructure tools. You can query real-time data from the organization's DevOps stack.

IMPORTANT RULES:
- When the user asks about live data (deployments, alerts, pods, repos, PRs), USE the available tools.
- When the user asks general knowledge questions (concepts, best practices, syntax), answer directly without tools.
- Always summarize tool results in a clear, actionable way. Use bullet points or tables when listing items.
- If a tool returns an error, explain what went wrong and suggest next steps.
- Be concise. Prioritize actionable information over verbose explanations.`;

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  argocd: `- **ArgoCD**: List apps, get app details, sync deployments. Ask about sync status, health, or deploy.`,
  grafana: `- **Grafana**: List alert rules (firing/pending/normal) and dashboards. Ask about alerts or monitoring.`,
  github: `- **GitHub**: List repositories and pull requests. Ask about repos, PRs, or code reviews.`,
  kubernetes: `- **Kubernetes**: List clusters, pods, and nodes. Ask about workloads, pod status, or cluster health.`,
};

const ALWAYS_AVAILABLE = `- **Portal Dashboard**: Get a high-level deployment overview aggregating multiple sources.
- **Scorecards**: Get service maturity evaluations (Basic/Bronze/Silver/Gold).`;

export function buildToolSystemPrompt(configuredProviders: Set<string>): string {
  const providerLines = Object.entries(PROVIDER_DESCRIPTIONS)
    .filter(([key]) => configuredProviders.has(key))
    .map(([, desc]) => desc);

  const availableSection =
    providerLines.length > 0
      ? `\n\nAVAILABLE TOOLS:\n${providerLines.join('\n')}\n${ALWAYS_AVAILABLE}`
      : `\n\nAVAILABLE TOOLS:\n${ALWAYS_AVAILABLE}`;

  const unavailable = Object.entries(PROVIDER_DESCRIPTIONS)
    .filter(([key]) => !configuredProviders.has(key))
    .map(([key]) => key);

  const unavailableSection =
    unavailable.length > 0
      ? `\n\nNOT CONFIGURED (answer generically if asked): ${unavailable.join(', ')}`
      : '';

  return `${BASE_PROMPT}${availableSection}${unavailableSection}`;
}
