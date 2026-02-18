# Secrets, SealedSecrets, and Vault Integrations

## What we use today (recommended baseline)

- **Kubernetes Secrets** for runtime environment variables (mounted via `envFrom`).
- **SealedSecrets** (Bitnami) for GitOps-safe secret storage:
  - Commit **SealedSecret** manifests to Git
  - The controller creates/maintains the corresponding **Secret** at runtime

## Confirm SealedSecrets is installed

```bash
kubectl get crd sealedsecrets.bitnami.com
kubectl -n kube-system get deploy sealed-secrets
```

## Converting an existing Secret to a SealedSecret

1. Fetch the controller public cert (once):

```bash
kubectl -n kube-system get secret -o name | grep sealed-secrets-key
kubectl -n kube-system get secret <sealed-secrets-key-secret> -o jsonpath='{.data.tls\.crt}' | base64 -d > sealed-secrets-cert.pem
```

2. Seal an existing Secret:

```bash
kubectl -n <ns> get secret <name> -o yaml | \
  kubeseal --cert sealed-secrets-cert.pem --format yaml > <name>.sealedsecret.yaml
```

3. Apply SealedSecret and (optionally) delete the plaintext Secret:

```bash
kubectl -n <ns> apply -f <name>.sealedsecret.yaml
kubectl -n <ns> delete secret <name> # optional, controller will recreate it
```

## “Vault” options supported at deploy time

There are two common patterns. Pick **one**.

### Option A: External Secrets Operator (recommended)

External Secrets Operator (ESO) supports:
- **HashiCorp Vault**
- **AWS Secrets Manager / SSM**
- **Azure Key Vault**
- **GCP Secret Manager**

Helm values (example):

```yaml
externalSecrets:
  enabled: true
  targetSecretName: devops-portal-secrets
  storeRef:
    name: my-cluster-secret-store
    kind: ClusterSecretStore
  data:
    - secretKey: AUTH_SECRET
      remoteRef:
        key: devops-portal/auth
        property: AUTH_SECRET
```

This produces a normal Kubernetes `Secret` which the portal consumes via `envFrom`.

### Option B: Secrets Store CSI Driver (works well on EKS)

If you already run the Secrets Store CSI Driver, you can mount secrets as files and optionally sync them into a K8s Secret.

Helm values (example):

```yaml
secretsStoreCsi:
  enabled: true
  provider: aws
  secretProviderClassName: devops-portal-spc
  syncToKubernetesSecret: true
  parameters: {}
```

Notes:
- The CSI driver is **cluster-wide** and must already be installed.
- You must configure the `SecretProviderClass` parameters for your provider.

## “Vault after deployment via UI” (practical use cases)

The portal already supports storing integration credentials in the database (per org). The most useful “Vault after deploy”
flows are:

- **Store only references** in the DB (path/key), and fetch actual secrets from Vault on-demand
- **Rotate secrets** centrally in Vault without redeploying

If you want this behavior, we can add a “Secrets Provider” integration in Settings:
- Vault address + auth method (Kubernetes auth / AppRole / OIDC)
- Per-integration secret references (e.g., `secret/data/devops-portal/github#token`)
- Test connection + “resolve secret” actions (admin-only)

