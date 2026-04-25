#!/bin/bash
# Port-forward script for local development
# Usage: ./scripts/port-forward.sh

set -e

KUBECONFIG_PATH="${KUBECONFIG:-/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml}"
NAMESPACE="duploservices-saasops1"

export KUBECONFIG="$KUBECONFIG_PATH"

echo "🔌 Setting up port-forwards to $NAMESPACE..."
echo "   Using kubeconfig: $KUBECONFIG_PATH"

# Kill existing port-forwards
pkill -f "kubectl port-forward" 2>/dev/null || true
sleep 1

# ArgoCD (HTTPS on 8080)
echo "📦 ArgoCD: https://localhost:8080"
kubectl port-forward svc/argocd-server -n "$NAMESPACE" 8080:80 > /tmp/pf-argocd.log 2>&1 &

# Grafana (HTTP on 3001)
echo "📊 Grafana: http://localhost:3001"
kubectl port-forward svc/grafana-local -n "$NAMESPACE" 3001:80 > /tmp/pf-grafana.log 2>&1 &

# Prometheus (HTTP on 9090)
echo "📈 Prometheus: http://localhost:9090"
kubectl port-forward svc/prom-local-prometheus-server -n "$NAMESPACE" 9090:80 > /tmp/pf-prom.log 2>&1 &

sleep 3

# Verify connections
echo ""
echo "🔍 Verifying connections..."
curl -s -o /dev/null -w "   ArgoCD:     %{http_code}\n" -k "https://localhost:8080/api/version" --max-time 5 || echo "   ArgoCD:     FAILED"
curl -s -o /dev/null -w "   Grafana:    %{http_code}\n" "http://localhost:3001/api/health" --max-time 5 || echo "   Grafana:    FAILED"
curl -s -o /dev/null -w "   Prometheus: %{http_code}\n" "http://localhost:9090/-/healthy" --max-time 5 || echo "   Prometheus: FAILED"

echo ""
echo "✅ Port-forwards established!"
echo ""
echo "To stop: pkill -f 'kubectl port-forward'"
echo "Logs: /tmp/pf-*.log"
