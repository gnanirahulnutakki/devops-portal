export interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  links?: string[];
  tags?: string[];
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'k8s-list-pods',
    title: 'List pods in a namespace',
    keywords: ['list pods', 'get pods', 'pods', 'kubectl get pods'],
    answer:
      'Use: `kubectl get pods -n <namespace>` or `kubectl get pods --all-namespaces` to list pods across all namespaces.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-describe-pod',
    title: 'Describe a pod',
    keywords: ['describe pod', 'pod details', 'kubectl describe pod'],
    answer: 'Use: `kubectl describe pod <pod-name> -n <namespace>` to see events and container details.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-pod-logs',
    title: 'Get pod logs',
    keywords: ['pod logs', 'get logs', 'kubectl logs', 'container logs'],
    answer:
      'Use: `kubectl logs <pod-name> -n <namespace>` or `kubectl logs <pod-name> -n <namespace> -c <container>`.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-exec-shell',
    title: 'Shell into a pod',
    keywords: ['exec', 'shell', 'bash', 'sh', 'kubectl exec'],
    answer:
      'Use: `kubectl exec -it <pod-name> -n <namespace> -- /bin/sh` (or `/bin/bash` if available).',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-list-services',
    title: 'List services',
    keywords: ['list services', 'get services', 'svc', 'kubectl get svc'],
    answer: 'Use: `kubectl get services -n <namespace>` (or `kubectl get svc -n <namespace>`).',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-list-nodes',
    title: 'List nodes',
    keywords: ['list nodes', 'get nodes', 'kubectl get nodes'],
    answer: 'Use: `kubectl get nodes` to list cluster nodes.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-list-deployments',
    title: 'List deployments',
    keywords: ['list deployments', 'get deployments', 'kubectl get deploy'],
    answer: 'Use: `kubectl get deployments -n <namespace>` (or `kubectl get deploy -n <namespace>`).',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-apply-yaml',
    title: 'Apply a manifest',
    keywords: ['apply yaml', 'kubectl apply', 'apply manifest'],
    answer: 'Use: `kubectl apply -f <file-or-dir>` to apply Kubernetes manifests.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-get-contexts',
    title: 'List kubeconfig contexts',
    keywords: ['contexts', 'kubeconfig', 'kubectl config get-contexts'],
    answer: 'Use: `kubectl config get-contexts` to list kubeconfig contexts.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'helm-list',
    title: 'List Helm releases',
    keywords: ['helm list', 'list releases', 'helm ls'],
    answer: 'Use: `helm list -n <namespace>` or `helm list --all-namespaces`.',
    links: ['https://helm.sh/docs/helm/helm_list/'],
    tags: ['helm'],
  },
  {
    id: 'helm-values',
    title: 'Show Helm values',
    keywords: ['helm values', 'get values', 'helm get values'],
    answer: 'Use: `helm get values <release> -n <namespace>` to view values.',
    links: ['https://helm.sh/docs/helm/helm_get_values/'],
    tags: ['helm'],
  },
  {
    id: 'helm-status',
    title: 'Show Helm release status',
    keywords: ['helm status', 'release status'],
    answer: 'Use: `helm status <release> -n <namespace>` to see status and resources.',
    links: ['https://helm.sh/docs/helm/helm_status/'],
    tags: ['helm'],
  },
  {
    id: 'helm-history',
    title: 'Show Helm release history',
    keywords: ['helm history', 'release history'],
    answer: 'Use: `helm history <release> -n <namespace>` to view revisions.',
    links: ['https://helm.sh/docs/helm/helm_history/'],
    tags: ['helm'],
  },
  {
    id: 'k8s-list-namespaces',
    title: 'List namespaces',
    keywords: ['list namespaces', 'get namespaces', 'kubectl get ns'],
    answer: 'Use: `kubectl get namespaces` (or `kubectl get ns`).',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-top-pods',
    title: 'Top pods by CPU/memory',
    keywords: ['top pods', 'kubectl top pods', 'cpu usage', 'memory usage'],
    answer: 'Use: `kubectl top pods -n <namespace>` (metrics-server required).',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-events',
    title: 'Check cluster events',
    keywords: ['events', 'kubectl get events', 'pod events'],
    answer: 'Use: `kubectl get events -n <namespace>` to inspect warnings and errors.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'k8s-port-forward',
    title: 'Port-forward to a pod/service',
    keywords: ['port forward', 'kubectl port-forward', 'portforward'],
    answer: 'Use: `kubectl port-forward svc/<service> 8080:80 -n <namespace>` or `kubectl port-forward pod/<pod> 8080:80`.',
    links: ['https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
    tags: ['k8s', 'kubectl'],
  },
  {
    id: 'argocd-sync',
    title: 'Sync an ArgoCD app',
    keywords: ['argocd sync', 'sync app', 'argocd application sync'],
    answer: 'Use: `argocd app sync <app-name>` or trigger sync in the ArgoCD UI.',
    links: ['https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_sync/'],
    tags: ['argocd'],
  },
  {
    id: 'argocd-status',
    title: 'Check ArgoCD app status',
    keywords: ['argocd status', 'app status', 'argocd app get'],
    answer: 'Use: `argocd app get <app-name>` for health, sync, and resources.',
    links: ['https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_get/'],
    tags: ['argocd'],
  },
  {
    id: 'grafana-dashboards',
    title: 'List Grafana dashboards',
    keywords: ['grafana dashboards', 'list dashboards', 'grafana api dashboards'],
    answer: 'Use Grafana API: `GET /api/search?type=dash-db` with an API key.',
    links: ['https://grafana.com/docs/grafana/latest/developers/http_api/search/'],
    tags: ['grafana'],
  },
  {
    id: 'prometheus-query',
    title: 'Run a Prometheus query',
    keywords: ['prometheus query', 'promql', 'query prometheus'],
    answer: 'Use: `GET /api/v1/query?query=<promql>` or query in Prometheus UI.',
    links: ['https://prometheus.io/docs/prometheus/latest/querying/api/'],
    tags: ['prometheus'],
  },
  {
    id: 'uptime-kuma-api',
    title: 'Uptime Kuma API basics',
    keywords: ['uptime kuma', 'kuma api', 'uptime monitoring'],
    answer: 'Use Uptime Kuma API with a generated API key to list monitors and status.',
    links: ['https://github.com/louislam/uptime-kuma/wiki/REST-API'],
    tags: ['uptime-kuma'],
  },
  {
    id: 'github-clone',
    title: 'Clone a GitHub repo',
    keywords: ['git clone', 'clone repo', 'github clone'],
    answer: 'Use: `git clone https://github.com/<org>/<repo>.git`.',
    links: ['https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository'],
    tags: ['github', 'git'],
  },
  {
    id: 'gitlab-clone',
    title: 'Clone a GitLab repo',
    keywords: ['gitlab clone', 'git clone gitlab'],
    answer: 'Use: `git clone https://gitlab.com/<group>/<repo>.git`.',
    links: ['https://docs.gitlab.com/ee/gitlab-basics/start-using-git.html#clone-a-repository'],
    tags: ['gitlab', 'git'],
  },
  {
    id: 'aws-cli-configure',
    title: 'Configure AWS CLI',
    keywords: ['aws configure', 'aws cli', 'aws credentials'],
    answer: 'Use: `aws configure` to set access key, secret, region, and output.',
    links: ['https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html'],
    tags: ['aws'],
  },
  {
    id: 'gcp-auth',
    title: 'Authenticate gcloud',
    keywords: ['gcloud auth', 'gcp login', 'gcp cli'],
    answer: 'Use: `gcloud auth login` and `gcloud config set project <project-id>`.',
    links: ['https://cloud.google.com/sdk/docs/authorizing'],
    tags: ['gcp'],
  },
  {
    id: 'azure-login',
    title: 'Authenticate Azure CLI',
    keywords: ['az login', 'azure cli', 'azure authenticate'],
    answer: 'Use: `az login` and `az account set --subscription <id>`.',
    links: ['https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli'],
    tags: ['azure'],
  },
];

export function searchKnowledge(query: string) {
  const text = query.toLowerCase();
  const scored = KNOWLEDGE_BASE.map((entry) => {
    const matches = entry.keywords.reduce((score, keyword) => {
      const hit = text.includes(keyword.toLowerCase());
      return score + (hit ? 1 : 0);
    }, 0);
    return { entry, score: matches };
  }).filter((item) => item.score > 0);

  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  return scored[0].entry;
}
