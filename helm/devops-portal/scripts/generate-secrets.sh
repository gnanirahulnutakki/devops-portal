#!/bin/bash
# =============================================================================
# Sealed Secrets Generator for DevOps Portal
# 
# This script generates secrets and seals them using kubeseal.
# 
# Prerequisites:
#   - kubeseal CLI installed
#   - kubectl configured with cluster access
#   - sealed-secrets controller installed in cluster
#
# Usage:
#   ./generate-secrets.sh [namespace] [controller-namespace]
#
# Example:
#   ./generate-secrets.sh devops-portal kube-system
# =============================================================================

set -e

NAMESPACE="${1:-devops-portal}"
CONTROLLER_NS="${2:-kube-system}"
OUTPUT_DIR="./sealed-secrets"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       DevOps Portal - Sealed Secrets Generator                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Namespace: $NAMESPACE"
echo "Sealed Secrets Controller: $CONTROLLER_NS"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate random secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_ADMIN_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
POSTGRES_USER_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
REDIS_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

echo "Step 1: Generating main application secrets..."

cat > "$OUTPUT_DIR/devops-portal-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-sealed-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  NEXTAUTH_SECRET: "$NEXTAUTH_SECRET"
  ENCRYPTION_KEY: "$ENCRYPTION_KEY"
EOF

echo "Step 2: Generating PostgreSQL secrets..."

cat > "$OUTPUT_DIR/postgresql-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-postgresql-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  postgres-password: "$POSTGRES_ADMIN_PASS"
  password: "$POSTGRES_USER_PASS"
EOF

echo "Step 3: Generating Redis secrets..."

cat > "$OUTPUT_DIR/redis-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-redis-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  redis-password: "$REDIS_PASS"
EOF

echo "Step 4: Generating MinIO secrets..."

cat > "$OUTPUT_DIR/minio-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-minio-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  root-user: "admin"
  root-password: "$MINIO_PASS"
EOF

echo "Step 5: Creating integration secrets templates..."

cat > "$OUTPUT_DIR/argocd-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-argocd-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  # Get token: argocd account generate-token --account admin
  token: "REPLACE_WITH_ARGOCD_TOKEN"
EOF

cat > "$OUTPUT_DIR/grafana-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-grafana-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  # Create via Grafana UI: Configuration > API Keys
  api-key: "REPLACE_WITH_GRAFANA_API_KEY"
EOF

cat > "$OUTPUT_DIR/github-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: devops-portal-github-sealed
  namespace: $NAMESPACE
type: Opaque
stringData:
  # Create OAuth App at: GitHub > Settings > Developer Settings > OAuth Apps
  client-id: "REPLACE_WITH_GITHUB_CLIENT_ID"
  client-secret: "REPLACE_WITH_GITHUB_CLIENT_SECRET"
EOF

echo ""
echo "Step 6: Sealing secrets with kubeseal..."
echo ""

# Check if kubeseal is available
if ! command -v kubeseal &> /dev/null; then
    echo "⚠️  kubeseal not found. Skipping sealing step."
    echo "   Install kubeseal and run manually:"
    echo "   kubeseal --controller-namespace=$CONTROLLER_NS --format yaml < secret.yaml > sealed-secret.yaml"
    echo ""
    echo "Generated unsealed secrets in: $OUTPUT_DIR/"
    exit 0
fi

# Seal the auto-generated secrets
for secret_file in devops-portal-secrets postgresql-secrets redis-secrets minio-secrets; do
    echo "  Sealing $secret_file..."
    kubeseal --controller-namespace="$CONTROLLER_NS" \
             --format yaml \
             < "$OUTPUT_DIR/${secret_file}.yaml" \
             > "$OUTPUT_DIR/${secret_file}-sealed.yaml"
    # Remove the unsealed version
    rm "$OUTPUT_DIR/${secret_file}.yaml"
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Generation Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Sealed secrets generated in: $OUTPUT_DIR/"
echo ""
echo "Auto-sealed (ready to apply):"
echo "  - devops-portal-secrets-sealed.yaml"
echo "  - postgresql-secrets-sealed.yaml"
echo "  - redis-secrets-sealed.yaml"
echo "  - minio-secrets-sealed.yaml"
echo ""
echo "Manual sealing required (update values first):"
echo "  - argocd-secrets.yaml"
echo "  - grafana-secrets.yaml"
echo "  - github-secrets.yaml"
echo ""
echo "Next steps:"
echo "  1. Update integration secrets with real values"
echo "  2. Seal them: kubeseal --controller-namespace=$CONTROLLER_NS --format yaml < secret.yaml > sealed.yaml"
echo "  3. Apply: kubectl apply -f $OUTPUT_DIR/*-sealed.yaml"
echo "  4. Install chart: helm install devops-portal ./helm/devops-portal -n $NAMESPACE"
echo ""
