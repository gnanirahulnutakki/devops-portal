#!/bin/bash
# Deploy Backstage GitOps Portal to QA Cluster
# This script builds, pushes, and deploys the Backstage portal to duploservices-qa4 namespace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Backstage GitOps Portal - QA Deployment Script${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Configuration
KUBECONFIG="/Users/nutakki/Documents/cloud-2025/kubeconfigs/qa-self-managed/duploinfra-qa-self-managed-kubeconfig.yaml"
NAMESPACE="duploservices-qa4"
IMAGE_NAME="rahulnutakki/devprotal"
IMAGE_TAG="latest"
HELM_RELEASE="backstage-gitops"

# Step 1: Build Docker image
echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker image built successfully${NC}"
echo ""

# Step 2: Push to Docker Hub
echo -e "${YELLOW}Step 2: Pushing image to Docker Hub...${NC}"
echo "Make sure you're logged in to Docker Hub:"
echo "  docker login"
echo ""
read -p "Press Enter to continue with push, or Ctrl+C to cancel..."

docker push ${IMAGE_NAME}:${IMAGE_TAG}

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker push failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Image pushed successfully${NC}"
echo ""

# Step 3: Verify Kubernetes access
echo -e "${YELLOW}Step 3: Verifying Kubernetes access...${NC}"
export KUBECONFIG=${KUBECONFIG}
kubectl get namespace ${NAMESPACE} > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}Cannot access namespace ${NAMESPACE}${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Kubernetes access verified${NC}"
echo ""

# Step 4: Check secrets
echo -e "${YELLOW}Step 4: Checking Kubernetes secrets...${NC}"
kubectl get secret backstage-secrets -n ${NAMESPACE} > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}Secret 'backstage-secrets' not found in namespace ${NAMESPACE}${NC}"
    echo "Please create it first using:"
    echo "  kubectl create secret generic backstage-secrets \\"
    echo "    --namespace ${NAMESPACE} \\"
    echo "    --from-literal=GITHUB_TOKEN='your_token' \\"
    echo "    --from-literal=POSTGRES_PASSWORD='your_password' \\"
    echo "    --from-literal=ARGOCD_TOKEN='your_argocd_token'"
    exit 1
fi
echo -e "${GREEN}✓ Secrets found${NC}"
echo ""

# Step 5: Deploy with Helm
echo -e "${YELLOW}Step 5: Deploying with Helm...${NC}"
helm upgrade --install ${HELM_RELEASE} ./helm \
  --namespace ${NAMESPACE} \
  --values helm/values-qa.yaml \
  --wait \
  --timeout 10m

if [ $? -ne 0 ]; then
    echo -e "${RED}Helm deployment failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Helm deployment successful${NC}"
echo ""

# Step 6: Verify deployment
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=backstage-gitops
echo ""

# Wait for pods to be ready
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=backstage-gitops \
  -n ${NAMESPACE} \
  --timeout=5m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pods are ready${NC}"
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo "To check logs:"
    echo "  kubectl logs -f deployment/${HELM_RELEASE} -n ${NAMESPACE}"
    echo ""
    echo "To access the application:"
    echo "  kubectl port-forward -n ${NAMESPACE} service/${HELM_RELEASE} 7007:80"
    echo "  Then open: http://localhost:7007"
    echo ""
    echo "To check status:"
    echo "  kubectl get all -n ${NAMESPACE} -l app.kubernetes.io/name=backstage-gitops"
else
    echo -e "${RED}Pods failed to become ready. Check logs:${NC}"
    echo "  kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=backstage-gitops"
    echo "  kubectl describe pods -n ${NAMESPACE} -l app.kubernetes.io/name=backstage-gitops"
    exit 1
fi
