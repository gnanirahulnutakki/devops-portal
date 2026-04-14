#!/usr/bin/env bash
# Deploy script for the action-protocol multi-cluster test.
# Run this AFTER images are pushed to a registry the clusters can pull from.
set -euo pipefail

GATEWAY_KUBECONFIG="${GATEWAY_KUBECONFIG:-/Users/nutakki/Documents/cloud-2026/kubeconfigs-2026/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml}"
AGENT_KUBECONFIG="${AGENT_KUBECONFIG:-/Users/nutakki/Documents/cloud-2026/kubeconfigs-2026/kubeconfigs/rlqa-usw2-dev01/duploinfra-rlqa-usw2-kubeconfig.yaml}"
NAMESPACE="${NAMESPACE:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Generate execute token"
EXECUTE_TOKEN=$(openssl rand -hex 32)
echo "EXECUTE_TOKEN=$EXECUTE_TOKEN"
echo "(save this — the portal will need it as PROTOCOL_GATEWAY_TOKEN)"

echo ""
echo "==> Phase 1: Deploy gateway to gateway cluster"
KUBECONFIG="$GATEWAY_KUBECONFIG" kubectl get nodes -o name | head -3 || { echo "Gateway cluster unreachable"; exit 1; }

sed "s|REPLACE_ME_WITH_OPENSSL_RAND_HEX_32|$EXECUTE_TOKEN|" "$SCRIPT_DIR/k8s/gateway-public.yaml" \
  | KUBECONFIG="$GATEWAY_KUBECONFIG" kubectl apply -f - -n "$NAMESPACE"

echo ""
echo "==> Wait for gateway pod ready"
KUBECONFIG="$GATEWAY_KUBECONFIG" kubectl wait --for=condition=ready pod -l app=protocol-gateway -n "$NAMESPACE" --timeout=120s

echo ""
echo "==> Wait for LoadBalancer hostname"
GATEWAY_HOST=""
for i in {1..30}; do
  GATEWAY_HOST=$(KUBECONFIG="$GATEWAY_KUBECONFIG" kubectl get svc protocol-gateway-public -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
  if [ -n "$GATEWAY_HOST" ]; then
    echo "Gateway public host: $GATEWAY_HOST"
    break
  fi
  echo "  waiting for LB ($i/30)..."
  sleep 10
done
if [ -z "$GATEWAY_HOST" ]; then
  echo "ERROR: LoadBalancer never got a hostname"
  exit 1
fi

GATEWAY_URL="http://$GATEWAY_HOST:8080"
echo "Gateway URL: $GATEWAY_URL"

echo ""
echo "==> Phase 2: Deploy agent to remote cluster"
KUBECONFIG="$AGENT_KUBECONFIG" kubectl get nodes -o name | head -3 || { echo "Agent cluster unreachable"; exit 1; }

sed "s|http://REPLACE_WITH_GATEWAY_NLB_DNS:8080|$GATEWAY_URL|" "$SCRIPT_DIR/k8s/agent-remote.yaml" \
  | KUBECONFIG="$AGENT_KUBECONFIG" kubectl apply -f - -n "$NAMESPACE"

echo ""
echo "==> Wait for agent pod ready"
KUBECONFIG="$AGENT_KUBECONFIG" kubectl wait --for=condition=ready pod -l app=protocol-agent -n "$NAMESPACE" --timeout=120s

echo ""
echo "==> Phase 3: Smoke test"
sleep 5
AGENT_NODE=$(KUBECONFIG="$AGENT_KUBECONFIG" kubectl get pod -l app=protocol-agent -n "$NAMESPACE" -o jsonpath='{.items[0].spec.nodeName}')
echo "Agent registered with name: $AGENT_NODE"

echo ""
echo "==> Test the protocol end-to-end:"
echo ""
echo "curl -sS -X POST $GATEWAY_URL/execute \\"
echo "  -H 'Authorization: Bearer $EXECUTE_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"agent_name\": \"$AGENT_NODE\", \"adapter_name\": \"k8s-get-pods\", \"params\": {\"namespace\": \"default\"}}'"
echo ""
echo "==> Done. Watch logs:"
echo "  Gateway: KUBECONFIG=$GATEWAY_KUBECONFIG kubectl logs -l app=protocol-gateway -n $NAMESPACE -f"
echo "  Agent:   KUBECONFIG=$AGENT_KUBECONFIG kubectl logs -l app=protocol-agent -n $NAMESPACE -f"
