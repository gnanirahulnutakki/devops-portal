M19_CLUSTER_A := m19-cluster-a
M19_CLUSTER_B := m19-cluster-b
GATEWAY_IMG   := ghcr.io/m19-federation/gateway:m1.9
AGENT_IMG     := ghcr.io/m19-federation/agent:m1.9

.PHONY: m1.9-doctor
m1.9-doctor:
	@which docker > /dev/null || (echo "Error: docker not found"; exit 1)
	@which kind > /dev/null || (echo "Error: kind not found"; exit 1)
	@which kubectl > /dev/null || (echo "Error: kubectl not found"; exit 1)
	@if [ -z "$$GITHUB_TOKEN" ]; then echo "Error: GITHUB_TOKEN environment variable not set"; exit 1; fi
	@docker info > /dev/null 2>&1 || (echo "Error: docker daemon not responding (is OrbStack/Docker Desktop running?)"; exit 1)
	@echo "Prerequisites met."

.PHONY: m1.9-build-images
m1.9-build-images:
	docker build -t $(GATEWAY_IMG) -f ../../../gateway/Dockerfile ../../..
	docker build -t $(AGENT_IMG) -f ../../../agent/Dockerfile ../../..

.PHONY: m1.9-up
m1.9-up: m1.9-doctor
	kind create cluster --name $(M19_CLUSTER_A) --config kind-cluster-a.yaml
	kind create cluster --name $(M19_CLUSTER_B) --config kind-cluster-b.yaml
	kind load docker-image $(GATEWAY_IMG) --name $(M19_CLUSTER_A)
	kind load docker-image $(AGENT_IMG) --name $(M19_CLUSTER_A)
	kind load docker-image $(AGENT_IMG) --name $(M19_CLUSTER_B)
	kubectl --context kind-$(M19_CLUSTER_A) apply -f cluster-a/00-namespace.yaml
	kubectl --context kind-$(M19_CLUSTER_A) create secret generic github-pat --from-literal=token=$$GITHUB_TOKEN -n m19-mcp --dry-run=client -o yaml | kubectl --context kind-$(M19_CLUSTER_A) apply -f -
	kubectl --context kind-$(M19_CLUSTER_A) apply -f cluster-a/
	kubectl --context kind-$(M19_CLUSTER_B) apply -f cluster-b/00-namespace.yaml
	kubectl --context kind-$(M19_CLUSTER_B) apply -f cluster-b/
	@echo "Waiting for readiness..."
	kubectl --context kind-$(M19_CLUSTER_A) wait --for=condition=available --timeout=120s deployment -n m19-mcp --all
	kubectl --context kind-$(M19_CLUSTER_B) wait --for=condition=Ready pod demo-caller -n m19-mcp --timeout=120s

.PHONY: m1.9-demo
m1.9-demo:
	@echo "==> Step 1: caller in cluster-b posts /execute to gateway in cluster-a (via host.docker.internal:8080)"
	@OP_ID=$$(kubectl --context kind-$(M19_CLUSTER_B) exec demo-caller -n m19-mcp -- /bin/sh -c '\
		curl -sf -X POST http://host.docker.internal:8080/execute \
		  -H "Content-Type: application/json" \
		  -H "X-Execute-Token: $$EXECUTE_TOKEN" \
		  -d "{\"agent_name\":\"cluster-a-agent\",\"adapter_name\":\"mcp-client\",\"params\":{\"server_url\":\"http://github-mcp.m19-mcp.svc.cluster.local:8082\",\"tool_name\":\"list_issues\",\"arguments\":{\"owner\":\"kubernetes\",\"repo\":\"kubernetes\",\"per_page\":3},\"credential\":\"k8s://secret/github-pat?key=token\",\"schema_uri\":\"mcp://tools/call/v1.0\"}}" \
		' | tee /tmp/m19-execute.json | grep -o '"operation_id":"[^"]*"' | cut -d'"' -f4); \
	echo "operation_id=$$OP_ID"; \
	echo "==> Step 2: poll gateway /result for outcome"; \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
		curl -sf "http://localhost:8080/result?operation_id=$$OP_ID" > /tmp/m19-result.json && break || sleep 2; \
	done; \
	echo "==> Result:"; \
	cat /tmp/m19-result.json | head -40; \
	echo ""; \
	echo "==> Verification:"; \
	if grep -q "$$GITHUB_TOKEN" /tmp/m19-result.json; then \
		echo "FAIL: PAT bytes appear in gateway result — credential boundary broken"; exit 1; \
	else \
		echo "PASS: PAT bytes do not appear in gateway result (credential boundary preserved)"; \
	fi; \
	if [ -n "$$(grep -o '\"ok\":true' /tmp/m19-result.json)" ]; then \
		echo "PASS: federated MCP call returned ok=true"; \
	else \
		echo "FAIL: result did not indicate success"; exit 1; \
	fi

.PHONY: m1.9-logs
m1.9-logs:
	kubectl --context kind-$(M19_CLUSTER_A) logs -n m19-mcp -l app.kubernetes.io/part-of=m19-mcp-federation --tail=100 -f

.PHONY: m1.9-down
m1.9-down:
	kind delete cluster --name $(M19_CLUSTER_A)
	kind delete cluster --name $(M19_CLUSTER_B)
