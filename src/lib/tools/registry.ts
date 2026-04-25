/**
 * Tool Registry — OpenAI function-calling schema definitions.
 *
 * Each tool maps 1:1 to an existing portal service function.
 * Ollama uses these schemas to decide when to call tools vs answer directly.
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

/** Provider category for UI badges */
export const TOOL_PROVIDERS: Record<string, string> = {
  list_argocd_apps: 'ArgoCD',
  get_argocd_app: 'ArgoCD',
  sync_argocd_app: 'ArgoCD',
  list_grafana_alerts: 'Grafana',
  list_grafana_dashboards: 'Grafana',
  list_github_repos: 'GitHub',
  list_github_prs: 'GitHub',
  get_dashboard_summary: 'Portal',
  list_clusters: 'Clusters',
  get_cluster_pods: 'Kubernetes',
  get_cluster_nodes: 'Kubernetes',
  list_scorecard_results: 'Scorecards',
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── ArgoCD ──────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_argocd_apps',
      description:
        'List all ArgoCD applications with their sync status, health status, and project. Use when the user asks about deployments, apps, or what is deployed.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Optional ArgoCD project name to filter by',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_argocd_app',
      description:
        'Get detailed information about a specific ArgoCD application including its resources, sync status, and history.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the ArgoCD application',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sync_argocd_app',
      description:
        'Trigger a sync on an ArgoCD application. Use when the user asks to sync, deploy, or redeploy an app.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the ArgoCD application to sync',
          },
          prune: {
            type: 'string',
            description: 'Whether to prune resources not in Git ("true" or "false")',
            enum: ['true', 'false'],
          },
        },
        required: ['name'],
      },
    },
  },

  // ── Grafana ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_grafana_alerts',
      description:
        'List Grafana alert rules with their current state (firing, pending, normal). Use when the user asks about alerts, what is firing, or monitoring issues.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_grafana_dashboards',
      description:
        'List available Grafana dashboards. Use when the user asks about dashboards or monitoring.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── GitHub ──────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_github_repos',
      description:
        'List GitHub repositories accessible to the organization. Use when the user asks about repos or code repositories.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Optional search filter for repository names',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_github_prs',
      description:
        'List open pull requests for a repository. Use when the user asks about PRs, reviews, or pending merges.',
      parameters: {
        type: 'object',
        properties: {
          repository: {
            type: 'string',
            description: 'Repository name in "owner/repo" format',
          },
          state: {
            type: 'string',
            description: 'PR state filter',
            enum: ['open', 'closed', 'all'],
          },
        },
        required: ['repository'],
      },
    },
  },

  // ── Portal / Dashboard ─────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description:
        'Get a high-level summary of the portal dashboard including deployment count, alert count, and repo count. Use for overview questions.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── Clusters / Kubernetes ──────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_clusters',
      description:
        'List all Kubernetes clusters registered in the portal with their provider, region, and environment.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cluster_pods',
      description:
        'List pods in a specific cluster and namespace. Use when the user asks about running pods or workloads.',
      parameters: {
        type: 'object',
        properties: {
          clusterId: {
            type: 'string',
            description: 'The cluster ID from list_clusters',
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (defaults to "default")',
          },
        },
        required: ['clusterId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cluster_nodes',
      description:
        'List nodes in a Kubernetes cluster with their status, roles, and resource capacity.',
      parameters: {
        type: 'object',
        properties: {
          clusterId: {
            type: 'string',
            description: 'The cluster ID from list_clusters',
          },
        },
        required: ['clusterId'],
      },
    },
  },

  // ── Scorecards ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_scorecard_results',
      description:
        'Get scorecard evaluation results showing service maturity levels (Basic, Bronze, Silver, Gold) across health, deployment, monitoring, and security checks.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

/** Get tool definitions filtered to only tools whose backend is available */
export function getAvailableTools(configuredProviders: Set<string>): ToolDefinition[] {
  const providerToRequired: Record<string, string> = {
    ArgoCD: 'argocd',
    Grafana: 'grafana',
    GitHub: 'github',
    Kubernetes: 'kubernetes',
    Clusters: 'kubernetes',
    // Portal and Scorecards are always available (DB-only)
  };

  return TOOL_DEFINITIONS.filter((tool) => {
    const provider = TOOL_PROVIDERS[tool.function.name];
    const required = providerToRequired[provider];
    // Always include Portal and Scorecards tools
    if (!required) return true;
    return configuredProviders.has(required);
  });
}
