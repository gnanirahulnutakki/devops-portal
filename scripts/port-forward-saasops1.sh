#!/bin/bash
# Port-forward DevOps Portal (duploservices-saasops1) so you can open the UI in your browser.
# Run this script in a terminal on the SAME machine where you will open the browser.
# Keep the terminal open while using the portal.
#
# Usage:
#   ./port-forward-saasops1.sh           # use http://localhost:7007
#   LOCAL_PORT=7008 ./port-forward-saasops1.sh   # use http://localhost:7008

set -e
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/Users/nutakki/Documents/cloud-2025/kubeconfigs/self-managed-test-dev01/duploinfra-qa-self-managed-kubeconfig.yaml}"
NAMESPACE="duploservices-saasops1"
LOCAL_PORT="${LOCAL_PORT:-7007}"

if [ ! -f "$KUBECONFIG_PATH" ]; then
  echo "Error: Kubeconfig not found at $KUBECONFIG_PATH"
  echo "Set KUBECONFIG_PATH if your kubeconfig is elsewhere."
  exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"

# Quick connectivity check
if ! kubectl get deployment devops-portal -n "$NAMESPACE" &>/dev/null; then
  echo "Error: deployment/devops-portal not found in namespace $NAMESPACE."
  echo "Deploy first with: ./scripts/deploy-saasops1.sh"
  exit 1
fi

echo "Port-forwarding DevOps Portal to http://127.0.0.1:${LOCAL_PORT}"
echo "Namespace: $NAMESPACE"
echo ""
echo "  --> Open in browser: http://localhost:${LOCAL_PORT}"
echo ""
echo "Keep this terminal open. Press Ctrl+C to stop."
echo ""

kubectl port-forward "deployment/devops-portal" "${LOCAL_PORT}:7007" -n "$NAMESPACE" --address=127.0.0.1
