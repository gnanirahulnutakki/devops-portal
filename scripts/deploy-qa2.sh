#!/bin/bash
set -e

# Deploy DevOps Portal to QA2 namespace
# Cluster: self-managed-test-dev01
# Namespace: duploservices-qa2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KUBECONFIG_PATH="/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml"
NAMESPACE="duploservices-qa2"
RELEASE_NAME="devops-portal"
HELM_DIR="$PROJECT_ROOT/deployment/helm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== DevOps Portal Deployment to QA2 ===${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Set kubeconfig
export KUBECONFIG="$KUBECONFIG_PATH"

if [ ! -f "$KUBECONFIG" ]; then
    echo -e "${RED}Error: Kubeconfig not found at $KUBECONFIG${NC}"
    exit 1
fi

# Check cluster connectivity
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}Error: Cannot connect to cluster${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Cluster connected${NC}"

# Check namespace exists
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    echo -e "${RED}Error: Namespace $NAMESPACE not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Namespace $NAMESPACE exists${NC}"

# Check if Helm is installed
if ! command -v helm &>/dev/null; then
    echo -e "${RED}Error: Helm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Helm is installed${NC}"

# Create secrets if they don't exist
echo ""
echo -e "${YELLOW}Creating secrets...${NC}"

# Check if secret exists
if ! kubectl get secret backstage-secrets -n "$NAMESPACE" &>/dev/null; then
    echo -e "${YELLOW}Creating backstage-secrets...${NC}"
    
    # Generate random passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d '=' | head -c 16)
    AUTH_SESSION_SECRET=$(openssl rand -base64 32)
    
    # Create secret with Helm ownership metadata
    kubectl create secret generic backstage-secrets \
        --namespace "$NAMESPACE" \
        --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        --from-literal=AUTH_SESSION_SECRET="$AUTH_SESSION_SECRET" \
        --from-literal=GITHUB_TOKEN="${GITHUB_TOKEN:-mock_token}" \
        --from-literal=ARGOCD_TOKEN="${ARGOCD_TOKEN:-mock_token}" \
        --dry-run=client -o yaml \
      | kubectl label --local -f - app.kubernetes.io/managed-by=Helm -o yaml \
      | kubectl annotate --local -f - meta.helm.sh/release-name="$RELEASE_NAME" meta.helm.sh/release-namespace="$NAMESPACE" -o yaml \
      | kubectl apply -f -
    
    echo -e "${GREEN}✓ Secret created with generated passwords${NC}"
    echo -e "${YELLOW}Note: Update GITHUB_TOKEN in the secret for real GitHub access${NC}"
else
    echo -e "${GREEN}✓ Secret already exists${NC}"
    # Ensure Helm ownership metadata is present
    kubectl label secret backstage-secrets -n "$NAMESPACE" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null
    kubectl annotate secret backstage-secrets -n "$NAMESPACE" meta.helm.sh/release-name="$RELEASE_NAME" meta.helm.sh/release-namespace="$NAMESPACE" --overwrite >/dev/null
fi

# Validate Helm chart
echo ""
echo -e "${YELLOW}Validating Helm chart...${NC}"
cd "$HELM_DIR"

if ! helm lint . -f values-qa2.yaml; then
    echo -e "${RED}Error: Helm chart validation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Helm chart is valid${NC}"

# Dry-run to check generated manifests
echo ""
echo -e "${YELLOW}Generating manifests (dry-run)...${NC}"
helm template "$RELEASE_NAME" . \
    --namespace "$NAMESPACE" \
    --values values-qa2.yaml \
    > /tmp/devops-portal-manifests.yaml

echo -e "${GREEN}✓ Manifests generated (saved to /tmp/devops-portal-manifests.yaml)${NC}"

# Deploy (upgrade --install handles fresh + failed releases)
echo ""
echo -e "${YELLOW}Deploying with Helm upgrade --install...${NC}"

helm upgrade --install "$RELEASE_NAME" . \
    --namespace "$NAMESPACE" \
    --values values-qa2.yaml \
    --wait \
    --timeout 5m

echo -e "${GREEN}✓ Deployment complete!${NC}"

# Wait for pods to be ready
echo ""
echo -e "${YELLOW}Waiting for pods to be ready...${NC}"
kubectl rollout status statefulset/devops-portal-postgres -n "$NAMESPACE" --timeout=120s || true
kubectl rollout status deployment/devops-portal -n "$NAMESPACE" --timeout=120s || true

# Show status
echo ""
echo -e "${GREEN}=== Deployment Status ===${NC}"
kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/instance=$RELEASE_NAME"

echo ""
echo -e "${GREEN}=== Services ===${NC}"
kubectl get svc -n "$NAMESPACE" -l "app.kubernetes.io/instance=$RELEASE_NAME"

# Port forward instructions
echo ""
echo -e "${GREEN}=== Access Instructions ===${NC}"
echo -e "To access the portal locally, run:"
echo -e "${YELLOW}  export KUBECONFIG=$KUBECONFIG_PATH${NC}"
echo -e "${YELLOW}  kubectl port-forward svc/devops-portal 7007:7007 -n $NAMESPACE${NC}"
echo ""
echo -e "Then open: ${YELLOW}http://localhost:7007/api/gitops/health?detailed=true${NC}"
echo ""

# Health check
echo -e "${YELLOW}Checking health...${NC}"
sleep 5
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=devops-portal,app.kubernetes.io/instance=$RELEASE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$POD_NAME" ]; then
    echo "Pod: $POD_NAME"
    echo ""
    echo "Recent logs:"
    kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=20 || true
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
