# Production Architecture - rli-use2

**Date:** 2025-10-28
**Repository:** radiantlogic-saas/rli-use2
**Cluster:** rli-use2 (via kubeconfig: duploinfra-rli-use2-kubeconfig.yaml)

---

## 🏗️ **Confirmed Architecture**

### **Repository Structure**

```
radiantlogic-saas/rli-use2
│
├── master (HEAD) - Control Plane
│   └── app/charts/
│       └── common-services/
│           ├── Chart.yaml
│           │   └── Dependencies:
│           │       ├── common-services: 2.0.0 (from radiantlogic-devops/helm)
│           │       └── image-mapper (OCI)
│           └── values.yaml
│               ├── argo-cd:
│               │   enabled: true
│               │   image.tag: v2.11.2
│               ├── prometheus: enabled: true
│               └── grafana: enabled: true
│
├── 39 Tenant Branches (e.g., rli-use2-mp02, rli-use2-jb01, etc.)
│   └── app/charts/
│       ├── radiantone/values.yaml    (actual values, no variables)
│       ├── igrcanalytics/values.yaml (optional)
│       ├── eoc/values.yaml           (optional)
│       ├── sdc/values.yaml           (optional)
│       └── observability/values.yaml (optional)
```

---

## 🎯 **ArgoCD Deployment**

### **Location:**
- **Namespace:** `duploservices-rli-use2-svc`
- **Version:** ArgoCD v2.11.2
- **Deployed via:** `common-services` chart from master branch
- **Access:** NodePort 30080 (HTTP), 30443 (HTTPS)

### **Components:**
```bash
# All running in duploservices-rli-use2-svc namespace:
- argocd-server (1/1)
- argocd-repo-server (1/1)
- argocd-redis (1/1)
- argocd-applicationset-controller (1/1)
```

---

## 📊 **ArgoCD Applications**

### **Total Applications:** 60

### **Naming Convention:**

| Application Name | Chart Path | Target Branch | Destination Namespace |
|-----------------|------------|---------------|----------------------|
| `common-services` | `app/charts/common-services` | `HEAD` (master) | `duploservices-rli-use2-svc` |
| `{branch}` | `app/charts/radiantone` | `{branch}` | `duploservices-{branch}` |
| `{branch}-ia` | `app/charts/igrcanalytics` | `{branch}` | `duploservices-{branch}` |
| `{branch}-obs` | `app/charts/observability` | `{branch}` | `duploservices-{branch}` |
| `{branch}-eoc` | `app/charts/eoc` | `{branch}` | `duploservices-{branch}` |
| `{branch}-sdc` | `app/charts/sdc` | `{branch}` | `duploservices-{branch}` |
| `{branch}-shared-services` | `app/charts/shared-services` | `{branch}` | `duploservices-{branch}` |

**Chart Abbreviations:**
- (no suffix) = `radiantone` (main chart)
- `-ia` = `igrcanalytics`
- `-obs` = `observability`
- `-eoc` = `eoc`
- `-sdc` = `sdc`
- `-shared-services` = `shared-services`

### **Example: Branch rli-use2-mp02**

```yaml
# ArgoCD Applications for this branch:

1. Application: rli-use2-mp02
   Source:
     repoURL: git@github.com:radiantlogic-saas/rli-use2.git
     targetRevision: rli-use2-mp02
     path: app/charts/radiantone
   Destination:
     namespace: duploservices-rli-use2-mp02
   Status: Synced, Healthy

2. Application: rli-use2-mp02-ia
   Source:
     repoURL: git@github.com:radiantlogic-saas/rli-use2.git
     targetRevision: rli-use2-mp02
     path: app/charts/igrcanalytics
   Destination:
     namespace: duploservices-rli-use2-mp02
   Status: OutOfSync, Healthy
```

---

## 🔍 **Key Discoveries**

### **1. No Variable Substitution**
Unlike the ensemble repo, production tenant branches use **actual values**:

```yaml
# Tenant branch values.yaml (ACTUAL VALUES):
fid:
  image:
    tag: 8.1.2              # ← Not $FID_VERSION
    repository: radiantone/fid
  replicaCount: 1           # ← Not $FID_NODE_COUNT
  nodeSelector:
    tenantname: duploservices-rli-use2-mp02  # ← Actual tenant name
```

### **2. Chart Distribution**
Not all tenants have all charts:

| Pattern | Count | Example Branches |
|---------|-------|-----------------|
| radiantone only | ~10 | rli-use2-dant |
| radiantone + igrcanalytics | ~25 | rli-use2-mp02, rli-use2-jb01 |
| Additional charts (eoc, sdc, obs) | ~4 | rli-use2-eoc, rli-use2-sdc |

### **3. Namespace Pattern**
All resources follow consistent naming:
- **Tenant namespaces:** `duploservices-{branch-name}`
- **Services namespace:** `duploservices-rli-use2-svc`
- **Node selector:** `tenantname: duploservices-{branch-name}`

### **4. Cross-Tenant Applications**
Some applications exist without a matching branch:
- `rli-use2-eoc` (application for eoc chart, shared resource)
- `rli-use2-sdc` (application for sdc chart, shared resource)
- `rli-use2-shared-services` (shared services)

---

## 🔄 **How It Works**

### **Deployment Flow:**

```
1. Master Branch (Control Plane)
   └── Contains common-services chart
       └── Deploys to: duploservices-rli-use2-svc
           └── Creates ArgoCD instance
               └── ArgoCD Application: common-services
                   ├── targetRevision: HEAD (master)
                   └── Auto-sync: enabled

2. Tenant Branch (e.g., rli-use2-mp02)
   └── Contains tenant-specific charts:
       ├── app/charts/radiantone/values.yaml
       └── app/charts/igrcanalytics/values.yaml

   └── ArgoCD watches these paths:
       ├── Application: rli-use2-mp02
       │   ├── Watches: branch rli-use2-mp02, path app/charts/radiantone
       │   └── Deploys to: namespace duploservices-rli-use2-mp02
       │
       └── Application: rli-use2-mp02-ia
           ├── Watches: branch rli-use2-mp02, path app/charts/igrcanalytics
           └── Deploys to: namespace duploservices-rli-use2-mp02

3. When User Updates Branch rli-use2-mp02
   └── Edit: app/charts/radiantone/values.yaml
       └── Commit & Push to GitHub
           └── ArgoCD detects change (polling or webhook)
               └── Application rli-use2-mp02 becomes OutOfSync
                   └── User triggers sync (manual or auto)
                       └── ArgoCD deploys updated chart
                           └── Kubernetes applies changes
                               └── Application becomes Synced ✅
```

---

## 🎯 **Portal Integration Design**

### **How GitOps Portal Will Work:**

#### **Workflow 1: Update Image Tag Across Multiple Tenants**

```
User Action:
1. Select repository: rli-use2
2. Select branches: [rli-use2-mp02, rli-use2-mp04, rli-use2-mp06]
3. Navigate to: app/charts/radiantone/values.yaml
4. Edit: image.tag: 8.1.2 → 8.1.3
5. Preview changes across 3 branches
6. Commit to all 3 branches

Portal Actions:
7. For each branch:
   - Update app/charts/radiantone/values.yaml
   - Commit to GitHub
   - Log to audit trail

8. Discover ArgoCD apps:
   - Query ArgoCD: GET /api/v1/applications
   - Filter by targetRevision = branch name
   - Found apps: [rli-use2-mp02, rli-use2-mp04, rli-use2-mp06]

9. Display sync panel:
   ┌─────────────────────────────────────────┐
   │ ArgoCD Applications (3)                 │
   ├─────────────────────────────────────────┤
   │ ☑ rli-use2-mp02 (OutOfSync)            │
   │ ☑ rli-use2-mp04 (OutOfSync)            │
   │ ☑ rli-use2-mp06 (OutOfSync)            │
   │                                         │
   │ [Sync All Selected]                     │
   └─────────────────────────────────────────┘

10. User clicks "Sync All"
    - POST /api/v1/applications/{app}/sync for each
    - Monitor sync status
    - Show real-time progress

11. Result:
    ✅ 3 branches updated in <5 minutes
    ✅ 3 ArgoCD apps synced
    ✅ All changes audited
```

#### **Workflow 2: Add New Dependency to All Tenants**

```
User Action:
1. Select repository: rli-use2
2. Select branches: ALL (filter: rli-use2-*)
3. Navigate to: app/charts/radiantone/values.yaml
4. Add new section:
   metrics:
     enabled: true
     newMonitoring:
       endpoint: http://monitoring-service:9090
5. Preview changes across 35+ branches
6. Commit to all branches

Portal Actions:
7. Bulk commit to 35+ branches (parallel, with progress bar)
8. Discover all radiantone apps: [rli-use2-mp02, rli-use2-mp04, ...]
9. Display 35+ apps for sync
10. User triggers bulk sync
11. ArgoCD syncs all apps in parallel

Result:
✅ 35+ branches updated in <15 minutes
✅ 35+ apps synced
✅ Complete audit trail
```

---

## 🔌 **ArgoCD API Integration**

### **Connection Details:**

```yaml
# app-config.yaml
gitops:
  argocd:
    url: http://argocd-server.duploservices-rli-use2-svc.svc.cluster.local
    # Or via NodePort: http://<node-ip>:30080
    namespace: duploservices-rli-use2-svc
    version: v2.11.2
    token: ${ARGOCD_TOKEN}
```

### **Key API Endpoints:**

```bash
# List all applications
GET /api/v1/applications

# Get specific application
GET /api/v1/applications/{app-name}

# Sync application
POST /api/v1/applications/{app-name}/sync
{
  "prune": false,
  "dryRun": false
}

# Get sync status
GET /api/v1/applications/{app-name}
  → .status.sync.status (Synced/OutOfSync)
  → .status.health.status (Healthy/Progressing/Degraded)
```

### **Application Discovery Logic:**

```typescript
// Get all apps for a branch
async getApplicationsForBranch(branch: string): Promise<Application[]> {
  const allApps = await argocdService.listApplications();

  // Filter apps watching this branch
  return allApps.filter(app =>
    app.spec.source.targetRevision === branch
  );
}

// Example result for branch "rli-use2-mp02":
[
  {
    name: 'rli-use2-mp02',
    path: 'app/charts/radiantone',
    branch: 'rli-use2-mp02',
    syncStatus: 'Synced',
    health: 'Healthy'
  },
  {
    name: 'rli-use2-mp02-ia',
    path: 'app/charts/igrcanalytics',
    branch: 'rli-use2-mp02',
    syncStatus: 'OutOfSync',
    health: 'Healthy'
  }
]
```

### **Sync Status Mapping:**

| ArgoCD Status | Meaning | Portal Action |
|---------------|---------|---------------|
| `Synced` | Git and cluster match | ✅ No action needed |
| `OutOfSync` | Git has changes | 🔄 Show "Sync" button |
| `Unknown` | Status unavailable | ⚠️ Show warning |

| Health Status | Meaning | Portal Display |
|---------------|---------|----------------|
| `Healthy` | All resources running | ✅ Green indicator |
| `Progressing` | Deployment in progress | 🔄 Blue indicator |
| `Degraded` | Some resources failed | ❌ Red indicator |
| `Unknown` | Status unavailable | ⚠️ Yellow indicator |

---

## 📋 **Application Matrix**

### **Sample Branches and Their Applications:**

| Branch | Radiantone | IgrcAnalytics | EOC | SDC | Observability | Shared Services |
|--------|-----------|---------------|-----|-----|---------------|-----------------|
| rli-use2-mp02 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| rli-use2-jb01 | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| rli-use2-idoga | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| rli-use2-eoc | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| rli-use2-sdc | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

**Total:** ~60 applications across 39 branches

---

## 🔐 **Authentication**

### **ArgoCD Token Generation:**

```bash
# Option 1: Admin token (for development)
kubectl -n duploservices-rli-use2-svc exec -it \
  deployment/argocd-server -- \
  argocd account generate-token --account admin

# Option 2: Service account token (for production)
# Create service account with API access
```

### **Token Storage:**
```bash
# Kubernetes secret
kubectl create secret generic backstage-secrets \
  --namespace common-services \
  --from-literal=ARGOCD_TOKEN="<token-here>"
```

---

## 🎯 **Summary**

### **What We Know:**
✅ **ArgoCD Location:** `duploservices-rli-use2-svc` namespace
✅ **ArgoCD Version:** v2.11.2
✅ **Total Apps:** 60 applications
✅ **Application Naming:** `{branch}` for radiantone, `{branch}-{abbr}` for others
✅ **Access Method:** NodePort 30080/30443 or in-cluster service
✅ **Master Branch:** Deploys common-services (includes ArgoCD)
✅ **Tenant Branches:** Deploy application-specific charts
✅ **Namespace Pattern:** `duploservices-{branch-name}`

### **How Portal Will Connect:**
```typescript
// Configuration
const argocdConfig = {
  url: 'http://argocd-server.duploservices-rli-use2-svc.svc.cluster.local',
  namespace: 'duploservices-rli-use2-svc',
  token: process.env.ARGOCD_TOKEN,
};

// Discover apps for branch
const apps = await getApplicationsForBranch('rli-use2-mp02');
// Returns: ['rli-use2-mp02', 'rli-use2-mp02-ia']

// Sync all apps
for (const app of apps) {
  await argocdService.syncApplication(app.name);
}
```

---

## ✅ **Ready for Implementation**

With this information, we can now:
1. ✅ Update `app-config.yaml` with correct ArgoCD URL
2. ✅ Implement ArgoCD service with proper application discovery
3. ✅ Map branches to applications using the naming convention
4. ✅ Build the sync UI with real application data
5. ✅ Test end-to-end workflow with actual cluster

---

**Status:** Production Architecture Documented - Ready to Update Implementation

**Next:** Update architecture documents and continue Phase 0.3
