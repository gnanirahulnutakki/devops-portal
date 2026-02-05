#!/bin/bash
# ============================================================================
# DevOps Portal Deployment Script
# ============================================================================
# Deploys the DevOps Portal to a Kubernetes cluster using Helm.
# Supports both fresh installs and upgrades.
#
# Usage:
#   ./deploy.sh <namespace> [values-file]
#
# Examples:
#   ./deploy.sh duploservices-saasops1
#   ./deploy.sh duploservices-saasops1 values-saasops1.yaml
#   ./deploy.sh my-namespace values-custom.yaml
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$(dirname "$SCRIPT_DIR")/helm"
RELEASE_NAME="devops-portal"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <namespace> [values-file]"
    echo ""
    echo "Arguments:"
    echo "  namespace    Kubernetes namespace to deploy to"
    echo "  values-file  Optional: Custom values file (default: auto-detect)"
    echo ""
    echo "Examples:"
    echo "  $0 duploservices-saasops1"
    echo "  $0 duploservices-saasops1 values-saasops1.yaml"
    exit 1
fi

NAMESPACE="$1"
VALUES_FILE="$2"

# Auto-detect values file if not provided
if [ -z "$VALUES_FILE" ]; then
    # Try to find a matching values file
    TENANT_NAME=$(echo "$NAMESPACE" | sed 's/duploservices-//')
    if [ -f "$CHART_DIR/values-${TENANT_NAME}.yaml" ]; then
        VALUES_FILE="values-${TENANT_NAME}.yaml"
        log_info "Auto-detected values file: $VALUES_FILE"
    elif [ -f "$CHART_DIR/values-${NAMESPACE}.yaml" ]; then
        VALUES_FILE="values-${NAMESPACE}.yaml"
        log_info "Auto-detected values file: $VALUES_FILE"
    fi
fi

log_info "=========================================="
log_info "DevOps Portal Deployment"
log_info "=========================================="
log_info "Namespace: $NAMESPACE"
log_info "Release:   $RELEASE_NAME"
log_info "Chart:     $CHART_DIR"
[ -n "$VALUES_FILE" ] && log_info "Values:    $VALUES_FILE"
log_info "=========================================="

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    log_warn "Namespace '$NAMESPACE' does not exist. Creating..."
    kubectl create namespace "$NAMESPACE"
    log_success "Namespace created"
fi

# Check for required secrets
log_info "Checking for required secrets..."
if ! kubectl get secret backstage-secrets -n "$NAMESPACE" &>/dev/null; then
    log_error "Secret 'backstage-secrets' not found in namespace '$NAMESPACE'"
    echo ""
    echo "Please create the secret first:"
    echo ""
    echo "kubectl create secret generic backstage-secrets -n $NAMESPACE \\"
    echo "  --from-literal=GITHUB_TOKEN=<your-github-token> \\"
    echo "  --from-literal=POSTGRES_PASSWORD=<postgres-password> \\"
    echo "  --from-literal=GITHUB_OAUTH_CLIENT_ID=<oauth-client-id> \\"
    echo "  --from-literal=GITHUB_OAUTH_CLIENT_SECRET=<oauth-client-secret> \\"
    echo "  --from-literal=AUTH_SESSION_SECRET=\$(openssl rand -hex 32)"
    echo ""
    exit 1
fi
log_success "Required secrets found"

# Build helm command
HELM_CMD="helm upgrade --install $RELEASE_NAME $CHART_DIR -n $NAMESPACE"

if [ -n "$VALUES_FILE" ]; then
    if [ -f "$CHART_DIR/$VALUES_FILE" ]; then
        HELM_CMD="$HELM_CMD -f $CHART_DIR/$VALUES_FILE"
    elif [ -f "$VALUES_FILE" ]; then
        HELM_CMD="$HELM_CMD -f $VALUES_FILE"
    else
        log_error "Values file not found: $VALUES_FILE"
        exit 1
    fi
fi

# Deploy
log_info "Deploying with Helm..."
echo "$HELM_CMD"
$HELM_CMD

log_success "Helm deployment completed!"

# Wait for deployment
log_info "Waiting for deployment to be ready..."
kubectl rollout status deployment/$RELEASE_NAME -n $NAMESPACE --timeout=300s

log_success "Deployment is ready!"

# Check ingress
if kubectl get ingress $RELEASE_NAME -n $NAMESPACE &>/dev/null; then
    log_info "Checking ingress status..."
    sleep 10  # Wait for ALB to provision
    
    # Get ALB hostname
    ALB_HOSTNAME=$(kubectl get ingress $RELEASE_NAME -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    
    if [ -n "$ALB_HOSTNAME" ]; then
        log_success "Ingress is ready!"
        echo ""
        echo "=========================================="
        echo "Access Information:"
        echo "=========================================="
        echo "ALB Hostname: $ALB_HOSTNAME"
        echo ""
        echo "To use nip.io, run:"
        echo "  $SCRIPT_DIR/update-nip-io-host.sh $NAMESPACE"
        echo ""
    else
        log_warn "Ingress created but ALB not yet provisioned"
        echo "Run this command to check status:"
        echo "  kubectl get ingress $RELEASE_NAME -n $NAMESPACE"
    fi
fi

# Print pod status
echo ""
log_info "Pod Status:"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/instance=$RELEASE_NAME

echo ""
log_success "Deployment complete!"
