#!/bin/bash
# ============================================================================
# HashiCorp Vault Secrets Setup for DevOps Portal
# ============================================================================
# This script sets up secrets in HashiCorp Vault for the DevOps Portal.
# It creates the required secret paths and configures Kubernetes auth.
#
# Prerequisites:
#   - vault CLI installed
#   - VAULT_ADDR environment variable set
#   - VAULT_TOKEN or vault login completed
#
# Usage:
#   export VAULT_ADDR=https://vault.example.com
#   vault login
#   ./setup-vault-secrets.sh [namespace] [base-path]
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
BASE_PATH="${2:-devops-portal}"
SERVICE_ACCOUNT="${3:-devops-portal}"

# Check prerequisites
if ! command -v vault &> /dev/null; then
    log_error "vault CLI not found. Install from https://www.vaultproject.io/downloads"
    exit 1
fi

if [ -z "$VAULT_ADDR" ]; then
    log_error "VAULT_ADDR environment variable not set"
    echo "Example: export VAULT_ADDR=https://vault.example.com"
    exit 1
fi

echo ""
echo "=============================================="
echo "  HashiCorp Vault Setup for DevOps Portal"
echo "=============================================="
echo "Vault Address: $VAULT_ADDR"
echo "Namespace: $NAMESPACE"
echo "Secret Base Path: $BASE_PATH"
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
read_secret "ArgoCD Token (optional): " ARGOCD_TOKEN false

# Generate values if empty
if [ -z "$POSTGRES_PASSWORD" ]; then
    POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
    log_info "Generated PostgreSQL password"
fi

AUTH_SESSION_SECRET=$(generate_random)
log_info "Generated auth session secret"

# Enable KV v2 secrets engine if not enabled
log_info "Checking secrets engine..."
if ! vault secrets list | grep -q "^secret/"; then
    log_info "Enabling KV v2 secrets engine..."
    vault secrets enable -path=secret kv-v2 || true
fi

# Write secrets to Vault
log_info "Writing secrets to Vault..."

vault kv put secret/${BASE_PATH}/github \
    token="$GITHUB_TOKEN"

vault kv put secret/${BASE_PATH}/github-oauth \
    client_id="$GITHUB_OAUTH_CLIENT_ID" \
    client_secret="$GITHUB_OAUTH_CLIENT_SECRET"

vault kv put secret/${BASE_PATH}/postgres \
    password="$POSTGRES_PASSWORD"

vault kv put secret/${BASE_PATH}/auth \
    session_secret="$AUTH_SESSION_SECRET"

if [ -n "$ARGOCD_TOKEN" ]; then
    vault kv put secret/${BASE_PATH}/argocd \
        token="$ARGOCD_TOKEN"
fi

log_success "Secrets written to Vault"

# Setup Kubernetes auth
echo ""
log_info "Do you want to configure Kubernetes auth? (y/n)"
read -r SETUP_K8S_AUTH

if [ "$SETUP_K8S_AUTH" = "y" ] || [ "$SETUP_K8S_AUTH" = "Y" ]; then
    log_info "Configuring Kubernetes auth..."
    
    # Get cluster info
    echo -n "Enter Kubernetes API server URL: "
    read K8S_HOST
    
    echo -n "Enter path to CA certificate (or 'skip' to use in-cluster): "
    read K8S_CA_CERT
    
    # Enable Kubernetes auth if not enabled
    if ! vault auth list | grep -q "^kubernetes/"; then
        vault auth enable kubernetes || true
    fi
    
    # Configure Kubernetes auth
    if [ "$K8S_CA_CERT" != "skip" ]; then
        vault write auth/kubernetes/config \
            kubernetes_host="$K8S_HOST" \
            kubernetes_ca_cert=@"$K8S_CA_CERT"
    else
        vault write auth/kubernetes/config \
            kubernetes_host="$K8S_HOST"
    fi
    
    # Create policy
    log_info "Creating Vault policy..."
    vault policy write devops-portal - <<EOF
path "secret/data/${BASE_PATH}/*" {
  capabilities = ["read"]
}
EOF
    
    # Create role
    log_info "Creating Kubernetes auth role..."
    vault write auth/kubernetes/role/devops-portal \
        bound_service_account_names=$SERVICE_ACCOUNT \
        bound_service_account_namespaces=$NAMESPACE \
        policies=devops-portal \
        ttl=1h
    
    log_success "Kubernetes auth configured"
fi

echo ""
echo "=============================================="
echo "  Helm Values for External Secrets"
echo "=============================================="
echo ""
cat << EOF
# Add this to your values file
secrets:
  provider: external-secrets
  name: backstage-secrets
  externalSecrets:
    provider: hashicorp-vault
    basePath: ${BASE_PATH}
    createSecretStore: true
    secretStoreRef:
      name: devops-portal-secret-store
      kind: SecretStore
    vault:
      server: ${VAULT_ADDR}
      path: secret
      version: v2
      auth:
        kubernetes:
          mountPath: kubernetes
          role: devops-portal
EOF

echo ""
log_success "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Install External Secrets Operator if not installed:"
echo "   helm repo add external-secrets https://charts.external-secrets.io"
echo "   helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace"
echo ""
echo "2. Deploy DevOps Portal with the values shown above"
echo ""
