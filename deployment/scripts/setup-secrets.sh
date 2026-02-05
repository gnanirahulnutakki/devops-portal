#!/bin/bash
# ============================================================================
# DevOps Portal - Secret Setup Wizard
# ============================================================================
# Interactive wizard to set up secrets using your preferred method.
# Supports:
#   - Plain Kubernetes secrets (development)
#   - Sealed Secrets (GitOps-safe, encrypted)
#   - HashiCorp Vault (enterprise secret management)
#   - Azure Key Vault
#   - AWS Secrets Manager
#
# Usage:
#   ./setup-secrets.sh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_header() {
    echo ""
    echo -e "${CYAN}=============================================="
    echo -e "  $1"
    echo -e "==============================================${NC}"
    echo ""
}

generate_random() {
    openssl rand -hex 32
}

# Main menu
print_header "DevOps Portal - Secret Setup Wizard"

echo "Select your secret management method:"
echo ""
echo "  1) Kubernetes Secret (simple, for development)"
echo "  2) Sealed Secrets (encrypted, safe for Git)"
echo "  3) HashiCorp Vault (enterprise)"
echo "  4) Azure Key Vault"
echo "  5) AWS Secrets Manager"
echo "  6) GCP Secret Manager"
echo ""
echo -n "Enter choice [1-6]: "
read CHOICE

case $CHOICE in
    1)
        print_header "Kubernetes Secret Setup"
        
        echo -n "Namespace: "
        read NAMESPACE
        NAMESPACE=${NAMESPACE:-default}
        
        echo ""
        log_info "Enter secret values (input is hidden):"
        echo ""
        
        echo -n "GitHub Personal Access Token: "
        read -s GITHUB_TOKEN
        echo ""
        
        echo -n "GitHub OAuth Client ID: "
        read -s GITHUB_OAUTH_CLIENT_ID
        echo ""
        
        echo -n "GitHub OAuth Client Secret: "
        read -s GITHUB_OAUTH_CLIENT_SECRET
        echo ""
        
        echo -n "PostgreSQL Password (empty to generate): "
        read -s POSTGRES_PASSWORD
        echo ""
        
        echo -n "ArgoCD Token (optional): "
        read -s ARGOCD_TOKEN
        echo ""
        
        # Generate if empty
        [ -z "$POSTGRES_PASSWORD" ] && POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
        AUTH_SESSION_SECRET=$(generate_random)
        
        # Build kubectl command
        CMD="kubectl create secret generic backstage-secrets -n $NAMESPACE"
        CMD="$CMD --from-literal=GITHUB_TOKEN='$GITHUB_TOKEN'"
        CMD="$CMD --from-literal=GITHUB_OAUTH_CLIENT_ID='$GITHUB_OAUTH_CLIENT_ID'"
        CMD="$CMD --from-literal=GITHUB_OAUTH_CLIENT_SECRET='$GITHUB_OAUTH_CLIENT_SECRET'"
        CMD="$CMD --from-literal=POSTGRES_PASSWORD='$POSTGRES_PASSWORD'"
        CMD="$CMD --from-literal=AUTH_SESSION_SECRET='$AUTH_SESSION_SECRET'"
        [ -n "$ARGOCD_TOKEN" ] && CMD="$CMD --from-literal=ARGOCD_TOKEN='$ARGOCD_TOKEN'"
        
        echo ""
        log_info "Creating secret..."
        eval $CMD --dry-run=client -o yaml | kubectl apply -f -
        
        log_success "Secret created!"
        echo ""
        echo "Helm values to use:"
        echo ""
        echo "secrets:"
        echo "  provider: kubernetes"
        echo "  name: backstage-secrets"
        ;;
        
    2)
        print_header "Sealed Secrets Setup"
        exec "$SCRIPT_DIR/seal-secrets.sh" "$@"
        ;;
        
    3)
        print_header "HashiCorp Vault Setup"
        exec "$SCRIPT_DIR/setup-vault-secrets.sh" "$@"
        ;;
        
    4)
        print_header "Azure Key Vault Setup"
        
        echo -n "Azure Key Vault URL (https://xxx.vault.azure.net/): "
        read VAULT_URL
        
        echo -n "Azure Tenant ID: "
        read TENANT_ID
        
        echo -n "Namespace: "
        read NAMESPACE
        NAMESPACE=${NAMESPACE:-default}
        
        echo ""
        log_info "Creating secrets in Azure Key Vault..."
        log_warn "Make sure you have Azure CLI installed and logged in (az login)"
        echo ""
        
        # Extract vault name from URL
        VAULT_NAME=$(echo $VAULT_URL | sed 's|https://||' | sed 's|.vault.azure.net/||')
        
        echo -n "GitHub Personal Access Token: "
        read -s GITHUB_TOKEN
        echo ""
        az keyvault secret set --vault-name $VAULT_NAME --name "devops-portal-github-token" --value "$GITHUB_TOKEN"
        
        echo -n "GitHub OAuth Client ID: "
        read -s GITHUB_OAUTH_CLIENT_ID
        echo ""
        az keyvault secret set --vault-name $VAULT_NAME --name "devops-portal-github-oauth-client-id" --value "$GITHUB_OAUTH_CLIENT_ID"
        
        echo -n "GitHub OAuth Client Secret: "
        read -s GITHUB_OAUTH_CLIENT_SECRET
        echo ""
        az keyvault secret set --vault-name $VAULT_NAME --name "devops-portal-github-oauth-client-secret" --value "$GITHUB_OAUTH_CLIENT_SECRET"
        
        POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
        az keyvault secret set --vault-name $VAULT_NAME --name "devops-portal-postgres-password" --value "$POSTGRES_PASSWORD"
        
        AUTH_SESSION_SECRET=$(generate_random)
        az keyvault secret set --vault-name $VAULT_NAME --name "devops-portal-auth-session-secret" --value "$AUTH_SESSION_SECRET"
        
        log_success "Secrets created in Azure Key Vault!"
        echo ""
        echo "Helm values to use:"
        echo ""
        cat << EOF
secrets:
  provider: external-secrets
  name: backstage-secrets
  externalSecrets:
    provider: azure-keyvault
    createSecretStore: true
    secretStoreRef:
      name: devops-portal-secret-store
      kind: SecretStore
    azure:
      vaultUrl: $VAULT_URL
      tenantId: $TENANT_ID
      authType: ManagedIdentity  # or ServicePrincipal
    data:
      - secretKey: GITHUB_TOKEN
        remoteKey: devops-portal-github-token
      - secretKey: GITHUB_OAUTH_CLIENT_ID
        remoteKey: devops-portal-github-oauth-client-id
      - secretKey: GITHUB_OAUTH_CLIENT_SECRET
        remoteKey: devops-portal-github-oauth-client-secret
      - secretKey: POSTGRES_PASSWORD
        remoteKey: devops-portal-postgres-password
      - secretKey: AUTH_SESSION_SECRET
        remoteKey: devops-portal-auth-session-secret
EOF
        ;;
        
    5)
        print_header "AWS Secrets Manager Setup"
        
        echo -n "AWS Region: "
        read AWS_REGION
        AWS_REGION=${AWS_REGION:-us-west-2}
        
        SECRET_NAME="devops-portal/secrets"
        
        echo ""
        log_info "Creating secrets in AWS Secrets Manager..."
        log_warn "Make sure you have AWS CLI installed and configured"
        echo ""
        
        echo -n "GitHub Personal Access Token: "
        read -s GITHUB_TOKEN
        echo ""
        
        echo -n "GitHub OAuth Client ID: "
        read -s GITHUB_OAUTH_CLIENT_ID
        echo ""
        
        echo -n "GitHub OAuth Client Secret: "
        read -s GITHUB_OAUTH_CLIENT_SECRET
        echo ""
        
        POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
        AUTH_SESSION_SECRET=$(generate_random)
        
        # Create JSON secret
        SECRET_JSON=$(cat << EOF
{
  "GITHUB_TOKEN": "$GITHUB_TOKEN",
  "GITHUB_OAUTH_CLIENT_ID": "$GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET": "$GITHUB_OAUTH_CLIENT_SECRET",
  "POSTGRES_PASSWORD": "$POSTGRES_PASSWORD",
  "AUTH_SESSION_SECRET": "$AUTH_SESSION_SECRET"
}
EOF
)
        
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --secret-string "$SECRET_JSON" \
            --region $AWS_REGION 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "$SECRET_JSON" \
            --region $AWS_REGION
        
        log_success "Secrets created in AWS Secrets Manager!"
        echo ""
        echo "Helm values to use:"
        echo ""
        cat << EOF
secrets:
  provider: external-secrets
  name: backstage-secrets
  externalSecrets:
    provider: aws-secrets-manager
    createSecretStore: true
    secretStoreRef:
      name: devops-portal-secret-store
      kind: SecretStore
    aws:
      region: $AWS_REGION
      # For IRSA (recommended):
      # role: arn:aws:iam::ACCOUNT_ID:role/devops-portal-secrets-role
    data:
      - secretKey: GITHUB_TOKEN
        remoteKey: $SECRET_NAME
        property: GITHUB_TOKEN
      - secretKey: GITHUB_OAUTH_CLIENT_ID
        remoteKey: $SECRET_NAME
        property: GITHUB_OAUTH_CLIENT_ID
      - secretKey: GITHUB_OAUTH_CLIENT_SECRET
        remoteKey: $SECRET_NAME
        property: GITHUB_OAUTH_CLIENT_SECRET
      - secretKey: POSTGRES_PASSWORD
        remoteKey: $SECRET_NAME
        property: POSTGRES_PASSWORD
      - secretKey: AUTH_SESSION_SECRET
        remoteKey: $SECRET_NAME
        property: AUTH_SESSION_SECRET
EOF
        ;;
        
    6)
        print_header "GCP Secret Manager Setup"
        
        echo -n "GCP Project ID: "
        read PROJECT_ID
        
        echo ""
        log_info "Creating secrets in GCP Secret Manager..."
        log_warn "Make sure you have gcloud CLI installed and configured"
        echo ""
        
        echo -n "GitHub Personal Access Token: "
        read -s GITHUB_TOKEN
        echo ""
        echo -n "$GITHUB_TOKEN" | gcloud secrets create devops-portal-github-token --data-file=- --project=$PROJECT_ID 2>/dev/null || \
        echo -n "$GITHUB_TOKEN" | gcloud secrets versions add devops-portal-github-token --data-file=- --project=$PROJECT_ID
        
        echo -n "GitHub OAuth Client ID: "
        read -s GITHUB_OAUTH_CLIENT_ID
        echo ""
        echo -n "$GITHUB_OAUTH_CLIENT_ID" | gcloud secrets create devops-portal-github-oauth-client-id --data-file=- --project=$PROJECT_ID 2>/dev/null || \
        echo -n "$GITHUB_OAUTH_CLIENT_ID" | gcloud secrets versions add devops-portal-github-oauth-client-id --data-file=- --project=$PROJECT_ID
        
        echo -n "GitHub OAuth Client Secret: "
        read -s GITHUB_OAUTH_CLIENT_SECRET
        echo ""
        echo -n "$GITHUB_OAUTH_CLIENT_SECRET" | gcloud secrets create devops-portal-github-oauth-client-secret --data-file=- --project=$PROJECT_ID 2>/dev/null || \
        echo -n "$GITHUB_OAUTH_CLIENT_SECRET" | gcloud secrets versions add devops-portal-github-oauth-client-secret --data-file=- --project=$PROJECT_ID
        
        POSTGRES_PASSWORD=$(generate_random | cut -c1-24)
        echo -n "$POSTGRES_PASSWORD" | gcloud secrets create devops-portal-postgres-password --data-file=- --project=$PROJECT_ID 2>/dev/null || \
        echo -n "$POSTGRES_PASSWORD" | gcloud secrets versions add devops-portal-postgres-password --data-file=- --project=$PROJECT_ID
        
        AUTH_SESSION_SECRET=$(generate_random)
        echo -n "$AUTH_SESSION_SECRET" | gcloud secrets create devops-portal-auth-session-secret --data-file=- --project=$PROJECT_ID 2>/dev/null || \
        echo -n "$AUTH_SESSION_SECRET" | gcloud secrets versions add devops-portal-auth-session-secret --data-file=- --project=$PROJECT_ID
        
        log_success "Secrets created in GCP Secret Manager!"
        echo ""
        echo "Helm values to use:"
        echo ""
        cat << EOF
secrets:
  provider: external-secrets
  name: backstage-secrets
  externalSecrets:
    provider: gcp-secret-manager
    createSecretStore: true
    secretStoreRef:
      name: devops-portal-secret-store
      kind: SecretStore
    gcp:
      projectID: $PROJECT_ID
    data:
      - secretKey: GITHUB_TOKEN
        remoteKey: devops-portal-github-token
      - secretKey: GITHUB_OAUTH_CLIENT_ID
        remoteKey: devops-portal-github-oauth-client-id
      - secretKey: GITHUB_OAUTH_CLIENT_SECRET
        remoteKey: devops-portal-github-oauth-client-secret
      - secretKey: POSTGRES_PASSWORD
        remoteKey: devops-portal-postgres-password
      - secretKey: AUTH_SESSION_SECRET
        remoteKey: devops-portal-auth-session-secret
EOF
        ;;
        
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
log_success "Secret setup complete!"
