#!/bin/bash
# ============================================================================
# Update Ingress Host with nip.io
# ============================================================================
# After ALB is provisioned, this script updates the ingress host to use
# nip.io for dynamic DNS resolution without requiring a DNS provider.
#
# Usage:
#   ./update-nip-io-host.sh <namespace> [release-name]
#
# Example:
#   ./update-nip-io-host.sh duploservices-saasops1
#   ./update-nip-io-host.sh duploservices-saasops1 devops-portal
# ============================================================================

set -e

NAMESPACE="${1:-duploservices-saasops1}"
RELEASE_NAME="${2:-devops-portal}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log_info "Checking ingress '$RELEASE_NAME' in namespace '$NAMESPACE'..."

# Get ALB hostname
ALB_HOSTNAME=$(kubectl get ingress $RELEASE_NAME -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)

if [ -z "$ALB_HOSTNAME" ]; then
    log_error "Ingress not found or ALB not yet provisioned"
    echo ""
    echo "Check ingress status:"
    echo "  kubectl get ingress $RELEASE_NAME -n $NAMESPACE"
    echo ""
    echo "If just deployed, wait a few minutes for ALB to provision."
    exit 1
fi

log_info "ALB Hostname: $ALB_HOSTNAME"

# Resolve ALB hostname to IP
log_info "Resolving ALB hostname to IP..."
ALB_IP=$(dig +short $ALB_HOSTNAME | head -1)

if [ -z "$ALB_IP" ]; then
    log_error "Could not resolve ALB hostname to IP"
    exit 1
fi

log_info "ALB IP: $ALB_IP"

# Create nip.io hostname
# Replace dots with dashes for nip.io format
NIP_HOST="${RELEASE_NAME}.${ALB_IP//./-}.nip.io"

log_info "New nip.io host: $NIP_HOST"

# Update ingress host
log_info "Updating ingress host..."
kubectl patch ingress $RELEASE_NAME -n $NAMESPACE --type='json' \
    -p="[{\"op\": \"replace\", \"path\": \"/spec/rules/0/host\", \"value\": \"$NIP_HOST\"}]"

log_success "Ingress updated!"

# Update ConfigMap with new baseUrl
log_info "Updating ConfigMap with new baseUrl..."
CONFIGMAP_NAME="${RELEASE_NAME}-config"
if kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE &>/dev/null; then
    # Get current config and update baseUrl
    kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml | \
        sed "s|baseUrl:.*|baseUrl: http://${NIP_HOST}|g" | \
        kubectl apply -f -
    log_success "ConfigMap updated!"
    
    # Restart deployment to pick up new config
    log_info "Restarting deployment to apply changes..."
    kubectl rollout restart deployment/$RELEASE_NAME -n $NAMESPACE
    kubectl rollout status deployment/$RELEASE_NAME -n $NAMESPACE --timeout=120s
fi

echo ""
echo "=========================================="
echo "Access Information:"
echo "=========================================="
echo ""
echo "Application URL: http://$NIP_HOST"
echo ""
echo "Note: nip.io provides wildcard DNS that resolves to the IP address"
echo "embedded in the hostname. No DNS configuration required!"
echo ""
echo "For HTTPS, you'll need to configure an ACM certificate and update"
echo "the ingress annotations with the certificate ARN."
echo ""
log_success "Done!"
