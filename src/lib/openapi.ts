const organizationHeader = {
  name: 'x-organization-id',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Organization context header for multi-tenant APIs',
};

const apiResponseSchema = {
  type: 'object',
  properties: {
    data: {},
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        pageSize: { type: 'number' },
        total: { type: 'number' },
      },
    },
  },
};

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'DevOps Portal API',
    version: '1.0.0',
    description:
      'API reference for DevOps Portal. Most routes require session auth and an organization header.',
  },
  servers: [{ url: '/' }],
  security: [{ cookieAuth: [] }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Organizations' },
    { name: 'Users' },
    { name: 'Preferences' },
    { name: 'Clusters' },
    { name: 'GitHub' },
    { name: 'GitOps' },
    { name: 'ArgoCD' },
    { name: 'Monitoring' },
    { name: 'Grafana' },
    { name: 'Storage' },
    { name: 'Queue' },
    { name: 'Metrics' },
    { name: 'MCP' },
    { name: 'Integrations' },
    { name: 'Scorecards' },
    { name: 'Security' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description:
          'NextAuth session cookie. In production this may be __Secure-next-auth.session-token.',
      },
    },
    schemas: {
      ApiResponse: apiResponseSchema,
      ErrorResponse: {
        type: 'object',
        properties: {
          error: apiResponseSchema.properties.error,
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          logoUrl: { type: 'string', nullable: true },
          role: { type: 'string' },
          joinedAt: { type: 'string' },
        },
      },
      OrganizationSettings: {
        type: 'object',
        properties: {
          mcp: {
            type: 'object',
            properties: {
              fastworkflowEnabled: { type: 'boolean' },
              fastworkflowUrl: { type: 'string' },
              fastworkflowToolName: { type: 'string' },
              mcpServerUrl: { type: 'string' },
            },
          },
          llm: {
            type: 'object',
            properties: {
              mode: { type: 'string' },
              provider: { type: 'string' },
              model: { type: 'string' },
              baseUrl: { type: 'string' },
              credentialId: { type: 'string' },
            },
          },
          github: {
            type: 'object',
            properties: {
              credentialId: { type: 'string' },
            },
          },
          duplo: {
            type: 'object',
            properties: {
              jitTemplateUrl: { type: 'string' },
            },
          },
          uptimeKuma: {
            type: 'object',
            properties: {
              credentialId: { type: 'string' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          image: { type: 'string', nullable: true },
          role: { type: 'string' },
          createdAt: { type: 'string' },
          emailVerified: { type: 'string', nullable: true },
          membershipId: { type: 'string' },
        },
      },
      UserPreference: {
        type: 'object',
        properties: {
          theme: { type: 'string' },
          sidebarCollapsed: { type: 'boolean' },
          dashboardLayout: { type: 'object', nullable: true },
          emailNotifications: { type: 'boolean' },
          slackNotifications: { type: 'boolean' },
        },
      },
      Cluster: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          provider: { type: 'string' },
          region: { type: 'string' },
          environment: { type: 'string' },
          status: { type: 'string' },
          hasKubeconfig: { type: 'boolean' },
          jitUrl: { type: 'string', nullable: true },
        },
      },
      ClusterOverview: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          nodes: { type: 'number' },
          namespaces: { type: 'number' },
          pods: { type: 'number' },
        },
      },
      ClusterNode: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string' },
          version: { type: 'string' },
          cpu: { type: 'string' },
          memory: { type: 'string' },
          pods: { type: 'string' },
          age: { type: 'string' },
        },
      },
      ClusterNamespace: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          pods: { type: 'number' },
          status: { type: 'string' },
        },
      },
      ClusterWorkload: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string' },
          status: { type: 'string' },
          namespace: { type: 'string' },
        },
      },
      ClusterService: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          type: { type: 'string' },
          clusterIP: { type: 'string' },
          ports: { type: 'string' },
        },
      },
      ClusterIngress: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          className: { type: 'string' },
          hosts: { type: 'string' },
        },
      },
      ClusterCrd: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          scope: { type: 'string' },
          version: { type: 'string' },
          kind: { type: 'string' },
        },
      },
      ClusterPod: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          status: { type: 'string' },
          ready: { type: 'string' },
          restarts: { type: 'number' },
          age: { type: 'string' },
          containers: { type: 'array', items: { type: 'string' } },
        },
      },
      HelmRelease: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          revision: { type: 'number', nullable: true },
          status: { type: 'string' },
          chart: { type: 'string', nullable: true },
          updatedAt: { type: 'string', nullable: true },
        },
      },
      GitHubRepository: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          fullName: { type: 'string' },
          private: { type: 'boolean' },
          description: { type: 'string', nullable: true },
          defaultBranch: { type: 'string' },
          htmlUrl: { type: 'string' },
          language: { type: 'string', nullable: true },
          stargazersCount: { type: 'number' },
          forksCount: { type: 'number' },
          openIssuesCount: { type: 'number' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          pushedAt: { type: 'string', nullable: true },
        },
      },
      GitHubBranch: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          protected: { type: 'boolean' },
          commit: {
            type: 'object',
            properties: {
              sha: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
      GitHubPullRequest: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          number: { type: 'number' },
          title: { type: 'string' },
          state: { type: 'string' },
          body: { type: 'string', nullable: true },
          htmlUrl: { type: 'string' },
          draft: { type: 'boolean' },
          additions: { type: 'number' },
          deletions: { type: 'number' },
          changedFiles: { type: 'number' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          closedAt: { type: 'string', nullable: true },
          mergedAt: { type: 'string', nullable: true },
        },
      },
      GitHubWorkflowRun: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          status: { type: 'string' },
          conclusion: { type: 'string', nullable: true },
          event: { type: 'string' },
          branch: { type: 'string' },
          commitSha: { type: 'string' },
          commitMessage: { type: 'string', nullable: true },
          runNumber: { type: 'number' },
          htmlUrl: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
      IntegrationCredential: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          provider: { type: 'string' },
          enabled: { type: 'boolean' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          lastUsedAt: { type: 'string', nullable: true },
          lastErrorAt: { type: 'string', nullable: true },
          lastError: { type: 'string', nullable: true },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/openapi': {
      get: {
        tags: ['Health'],
        summary: 'OpenAPI spec',
        security: [],
        responses: {
          200: { description: 'OpenAPI JSON', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
    '/api/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Metrics endpoint',
        responses: {
          200: { description: 'Metrics', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/queue/stats': {
      get: {
        tags: ['Queue'],
        summary: 'Queue stats',
        responses: {
          200: { description: 'Queue stats', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations for current user',
        responses: {
          200: {
            description: 'Organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Organization' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Organization' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/organizations/settings': {
      get: {
        tags: ['Organizations'],
        summary: 'Get organization settings',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Settings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/OrganizationSettings' } },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Organizations'],
        summary: 'Update organization settings',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/OrganizationSettings' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/user-preferences': {
      get: {
        tags: ['Preferences'],
        summary: 'Get user preferences',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Preferences',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/UserPreference' } },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Preferences'],
        summary: 'Update user preferences',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/UserPreference' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/User' } } },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name'],
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by id',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'User',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/clusters': {
      get: {
        tags: ['Clusters'],
        summary: 'List clusters',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Clusters',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Cluster' } } },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Clusters'],
        summary: 'Create cluster',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: {
            description: 'Created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Cluster' } } },
              },
            },
          },
        },
      },
    },
    '/api/clusters/validate': {
      post: {
        tags: ['Clusters'],
        summary: 'Validate kubeconfig',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['kubeconfig'], properties: { kubeconfig: { type: 'string' } } },
            },
          },
        },
        responses: {
          200: {
            description: 'Validation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        server: { type: 'string' },
                        namespaces: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}': {
      patch: {
        tags: ['Clusters'],
        summary: 'Update cluster',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Cluster' } } },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Clusters'],
        summary: 'Delete cluster',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/clusters/{id}/overview': {
      get: {
        tags: ['Clusters'],
        summary: 'Cluster overview',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Overview',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ClusterOverview' } } },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/nodes': {
      get: {
        tags: ['Clusters'],
        summary: 'List nodes',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Nodes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterNode' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/namespaces': {
      get: {
        tags: ['Clusters'],
        summary: 'List namespaces',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Namespaces',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterNamespace' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/workloads': {
      get: {
        tags: ['Clusters'],
        summary: 'List workloads',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Workloads',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterWorkload' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/services': {
      get: {
        tags: ['Clusters'],
        summary: 'List services',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Services',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterService' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/ingresses': {
      get: {
        tags: ['Clusters'],
        summary: 'List ingresses',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Ingresses',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterIngress' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/crds': {
      get: {
        tags: ['Clusters'],
        summary: 'List CRDs',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'CRDs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterCrd' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/pods': {
      get: {
        tags: ['Clusters'],
        summary: 'List pods',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Pods',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ClusterPod' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/pods/{name}/logs': {
      get: {
        tags: ['Clusters'],
        summary: 'Pod logs',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'namespace', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'container', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        pod: { type: 'string' },
                        namespace: { type: 'string' },
                        container: { type: 'string', nullable: true },
                        logs: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/clusters/{id}/helm': {
      get: {
        tags: ['Clusters'],
        summary: 'Helm releases',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Helm releases',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/HelmRelease' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/gitops/contents': {
      get: {
        tags: ['GitOps'],
        summary: 'Get file contents',
        parameters: [
          organizationHeader,
          { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'path', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'ref', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Content',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'object' } },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['GitOps'],
        summary: 'Update file contents',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/gitops/tree': {
      get: {
        tags: ['GitOps'],
        summary: 'Get repository tree',
        parameters: [
          organizationHeader,
          { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'ref', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'recursive', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'filter', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Tree',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object' } } } } },
          },
        },
      },
    },
    '/api/gitops/branches': {
      get: {
        tags: ['GitOps'],
        summary: 'List branches',
        parameters: [
          organizationHeader,
          { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Branches', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/gitops/branches/create': {
      post: {
        tags: ['GitOps'],
        summary: 'Create branch',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Branch created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/gitops/pulls': {
      get: {
        tags: ['GitOps'],
        summary: 'List pull requests',
        parameters: [
          organizationHeader,
          { name: 'repo', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Pulls', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      post: {
        tags: ['GitOps'],
        summary: 'Create pull request',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/gitops/bulk-commit': {
      post: {
        tags: ['GitOps'],
        summary: 'Bulk commit',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Committed', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/github/repositories': {
      get: {
        tags: ['GitHub'],
        summary: 'List repositories',
        responses: {
          200: {
            description: 'Repositories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/GitHubRepository' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/github/branches': {
      get: {
        tags: ['GitHub'],
        summary: 'List branches',
        parameters: [{ name: 'repository', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Branches',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GitHubBranch' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/github/pull-requests': {
      get: {
        tags: ['GitHub'],
        summary: 'List pull requests',
        parameters: [{ name: 'repository', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Pull requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/GitHubPullRequest' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['GitHub'],
        summary: 'Create pull request',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: {
            description: 'Created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/GitHubPullRequest' } } },
              },
            },
          },
        },
      },
      patch: {
        tags: ['GitHub'],
        summary: 'Update pull request',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/GitHubPullRequest' } } },
              },
            },
          },
        },
      },
    },
    '/api/github/pull-requests/files': {
      get: {
        tags: ['GitHub'],
        summary: 'List pull request files',
        parameters: [
          { name: 'repository', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'number', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'PR files',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array' } } } } },
          },
        },
      },
    },
    '/api/github/pull-requests/merge': {
      post: {
        tags: ['GitHub'],
        summary: 'Merge pull request',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Merged', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/github/actions/runs': {
      get: {
        tags: ['GitHub'],
        summary: 'List workflow runs',
        parameters: [
          { name: 'repository', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'branch', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Workflow runs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/GitHubWorkflowRun' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/github/actions/runs/{runId}/rerun': {
      post: {
        tags: ['GitHub'],
        summary: 'Rerun workflow',
        parameters: [
          { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'repository', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Rerun requested', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/github/actions/runs/{runId}/cancel': {
      post: {
        tags: ['GitHub'],
        summary: 'Cancel workflow',
        parameters: [
          { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'repository', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Cancel requested', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications': {
      get: {
        tags: ['ArgoCD'],
        summary: 'List ArgoCD applications',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Applications', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications/{name}': {
      get: {
        tags: ['ArgoCD'],
        summary: 'Get ArgoCD application',
        parameters: [
          organizationHeader,
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Application', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications/{name}/sync': {
      post: {
        tags: ['ArgoCD'],
        summary: 'Sync ArgoCD app',
        parameters: [
          organizationHeader,
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Sync started', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications/{name}/refresh': {
      post: {
        tags: ['ArgoCD'],
        summary: 'Refresh ArgoCD app',
        parameters: [
          organizationHeader,
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Refreshed', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications/{name}/history': {
      get: {
        tags: ['ArgoCD'],
        summary: 'App history',
        parameters: [
          organizationHeader,
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'History', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/argocd/applications/{name}/resources': {
      get: {
        tags: ['ArgoCD'],
        summary: 'App resources',
        parameters: [
          organizationHeader,
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Resources', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/dashboard/summary': {
      get: {
        tags: ['Metrics'],
        summary: 'Dashboard summary',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Summary', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/monitoring/grafana/dashboards': {
      get: {
        tags: ['Grafana'],
        summary: 'Grafana dashboards',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Dashboards', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/monitoring/grafana/folders': {
      get: {
        tags: ['Grafana'],
        summary: 'Grafana folders',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Folders', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/monitoring/grafana/panels': {
      get: {
        tags: ['Grafana'],
        summary: 'Grafana panels',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Panels', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/monitoring/grafana/alerts': {
      get: {
        tags: ['Grafana'],
        summary: 'Grafana alerts',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Alerts', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/monitoring/grafana/render': {
      get: {
        tags: ['Grafana'],
        summary: 'Grafana render',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Rendered image',
            content: {
              'image/png': { schema: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
    },
    '/api/integrations/grafana/accounts': {
      get: {
        tags: ['Integrations'],
        summary: 'List Grafana accounts',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationCredential' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create Grafana account',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/integrations/github/accounts': {
      get: {
        tags: ['Integrations'],
        summary: 'List GitHub accounts',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationCredential' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create GitHub account',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/integrations/llm/accounts': {
      get: {
        tags: ['Integrations'],
        summary: 'List LLM accounts',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationCredential' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create LLM account',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/integrations/uptime-kuma/accounts': {
      get: {
        tags: ['Integrations'],
        summary: 'List Uptime Kuma accounts',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationCredential' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create Uptime Kuma account',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/integrations/supabase/accounts': {
      get: {
        tags: ['Integrations'],
        summary: 'List Supabase accounts',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationCredential' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Create Supabase account',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Created', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/storage/s3': {
      get: {
        tags: ['Storage'],
        summary: 'List objects',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Objects', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      post: {
        tags: ['Storage'],
        summary: 'Upload object',
        parameters: [organizationHeader],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Uploaded', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      delete: {
        tags: ['Storage'],
        summary: 'Delete object',
        parameters: [
          organizationHeader,
          { name: 'key', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/mcp/chat': {
      post: {
        tags: ['MCP'],
        summary: 'Chat endpoint with fastworkflow fallback',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string' },
                  context: { type: 'string' },
                  preferredSource: { type: 'string', enum: ['auto', 'fastworkflow', 'mcp', 'knowledge'] },
                  mcpServerUrl: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Chat response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        source: { type: 'string' },
                        tool: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        links: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/{nextauth}': {
      get: {
        tags: ['Auth'],
        summary: 'NextAuth route',
        parameters: [{ name: 'nextauth', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Auth response', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'NextAuth route',
        parameters: [{ name: 'nextauth', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          200: { description: 'Auth response', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/scorecards': {
      get: {
        tags: ['Scorecards'],
        summary: 'List scorecards',
        description: 'Returns all scorecards for the organization with their checks and current scores.',
        parameters: [organizationHeader],
        responses: {
          200: {
            description: 'Array of scorecards',
            content: { 'application/json': { schema: apiResponseSchema } },
          },
        },
      },
      post: {
        tags: ['Scorecards'],
        summary: 'Create scorecard',
        description: 'Create a new scorecard with checks and thresholds.',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Production Readiness' },
                  description: { type: 'string' },
                  checks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['manual', 'automated'] },
                        weight: { type: 'number' },
                      },
                    },
                  },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Created scorecard', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/scorecards/{id}': {
      get: {
        tags: ['Scorecards'],
        summary: 'Get scorecard by ID',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Scorecard details', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      patch: {
        tags: ['Scorecards'],
        summary: 'Update scorecard',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: { description: 'Updated scorecard', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      delete: {
        tags: ['Scorecards'],
        summary: 'Delete scorecard',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/scorecards/evaluate': {
      post: {
        tags: ['Scorecards'],
        summary: 'Evaluate scorecards',
        description: 'Trigger evaluation of all scorecard checks and compute scores.',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Evaluation results', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/scorecards/seed': {
      post: {
        tags: ['Scorecards'],
        summary: 'Seed sample scorecards',
        description: 'Create sample scorecards with pre-defined checks for demonstration purposes.',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Seeded scorecards', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/security/scans': {
      get: {
        tags: ['Security'],
        summary: 'List security scans',
        description: 'Returns all security scan records for the organization.',
        parameters: [organizationHeader],
        responses: {
          200: { description: 'Array of scans', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
      post: {
        tags: ['Security'],
        summary: 'Create security scan',
        description: 'Initiate a new security scan for a repository or image.',
        parameters: [organizationHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  target: { type: 'string', description: 'Repository or image to scan' },
                  type: { type: 'string', enum: ['trivy', 'grype', 'custom'] },
                },
                required: ['target'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Scan initiated', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
    '/api/security/scans/{id}': {
      get: {
        tags: ['Security'],
        summary: 'Get scan details',
        parameters: [
          organizationHeader,
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Scan details with findings', content: { 'application/json': { schema: apiResponseSchema } } },
        },
      },
    },
  },
};
