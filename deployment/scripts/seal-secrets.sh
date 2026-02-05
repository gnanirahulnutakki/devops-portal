#!/bin/bash
# ============================================================================
# Seal Secrets Script for DevOps Portal
# ============================================================================
# This script helps generate Sealed Secrets that can be safely stored in Git.
# The encrypted secrets can only be decrypted by the Sealed Secrets controller
# in your cluster.
#
# Prerequisites:
#   - kubeseal CLI installed: brew install kubeseal
#   - Sealed Secrets controller installed in cluster
#   - kubectl configured to access your cluster
#
# Usage:
#   ./seal-secrets.sh <namespace>
#
# Interactive mode will prompt for each secret value.
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

NAMESPACE="${1:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/sealed-secrets"
SECRET_NAME="backstage-secrets"

# Check prerequisites
if ! command -v kubeseal &> /dev/null; then
    log_error "kubeseal not found. Install with: brew install kubeseal"
    exit 1
fi

if ! kubectl get deploy -n kube-system sealed-secrets-controller &> /dev/null && \
   ! kubectl get deploy -n sealed-secrets sealed-secrets-controller &> /dev/null; then
    log_warn "Sealed Secrets controller not found. Install with:"
    echo "kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.5/controller.yaml"
fi

mkdir -p "$OUTPUT_DIR"

echo ""
echo "=============================================="
echo "  Sealed Secrets Generator for DevOps Portal"
echo "=============================================="
echo "Namespace: $NAMESPACE"
echo ""
echo "This will create encrypted secrets that can be safely committed to Git."
echo "Press Ctrl+C to cancel at any time."
echo ""

# Function to read secret value securely
read_secret() {
    local prompt="$1"
    local varname="$2"
    local required="${3:-true}"
    
    echo -n "$prompt"
    read -s value
    echo ""
    
    if [ -z "$value" ] && [ "$required" = "true" ]; then
        log_error "Value is required"
        exit 1
    fi
    
    eval "$varname='$value'"
}

# Function to generate random string
generate_random() {
    openssl rand -hex 32
}

# Collect secrets
log_info "Enter secret values (input is hidden):"
echo ""

read_secret "GitHub Personal Access Token (required): " GITHUB_TOKEN true
read_secret "GitHub OAuth Client ID (required): " GITHUB_OAUTH_CLIENT_ID true
read_secret "GitHub OAuth Client Secret (required): " GITHUB_OAUTH_CLIENT_SECRET true
read_secret "PostgreSQL Password (leave empty to generate): " POSTGRES_PASSWORD false
read_secret "ArgoCD Token (optional, press Enter to skip): " ARGOCD_TOKEN false

# Generate values if empty
if [ -z "$POSTGRES_PASSWORD" ]; then
    POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
    log_info "Generated PostgreSQL password"
fi

AUTH_SESSION_SECRET=$(generate_random)
log_info "Generated auth session secret"

# Create temporary secret YAML
TEMP_SECRET=$(mktemp)
cat > "$TEMP_SECRET" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: $SECRET_NAME
  namespace: $NAMESPACE
type: Opaque
stringData:
  GITHUB_TOKEN: "$GITHUB_TOKEN"
  GITHUB_OAUTH_CLIENT_ID: "$GITHUB_OAUTH_CLIENT_ID"
  GITHUB_OAUTH_CLIENT_SECRET: "$GITHUB_OAUTH_CLIENT_SECRET"
  POSTGRES_PASSWORD: "$POSTGRES_PASSWORD"
  AUTH_SESSION_SECRET: "$AUTH_SESSION_SECRET"
EOF

if [ -n "$ARGOCD_TOKEN" ]; then
    cat >> "$TEMP_SECRET" << EOF
  ARGOCD_TOKEN: "$ARGOCD_TOKEN"
EOF
fi

# Seal the secret
log_info "Encrypting secrets with kubeseal..."

SEALED_SECRET_FILE="$OUTPUT_DIR/sealed-secret-$NAMESPACE.yaml"
kubeseal --format yaml < "$TEMP_SECRET" > "$SEALED_SECRET_FILE"

# Clean up temp file
rm -f "$TEMP_SECRET"

log_success "Sealed secret created: $SEALED_SECRET_FILE"

# Generate values snippet
log_info "Generating Helm values snippet..."

VALUES_SNIPPET="$OUTPUT_DIR/values-secrets-$NAMESPACE.yaml"
cat > "$VALUES_SNIPPET" << 'EOF'
# Add this to your values file for Sealed Secrets
secrets:
  provider: sealed-secrets
  name: backstage-secrets
  sealedSecrets:
    encryptedData:
EOF

# Extract encrypted data from sealed secret
grep -A 100 "encryptedData:" "$SEALED_SECRET_FILE" | grep "^    [A-Z]" | while read line; do
    echo "      $line" >> "$VALUES_SNIPPET"
done

log_success "Values snippet created: $VALUES_SNIPPET"

echo ""
echo "=============================================="
echo "  Next Steps"
echo "=============================================="
echo ""
echo "Option 1: Apply sealed secret directly"
echo "  kubectl apply -f $SEALED_SECRET_FILE"
echo ""
echo "Option 2: Include in Helm values"
echo "  Copy the content from $VALUES_SNIPPET into your values file"
echo "  Then deploy with: helm upgrade --install devops-portal ./deployment/helm -f values.yaml"
echo ""
echo "The sealed secret is safe to commit to Git!"
echo ""
