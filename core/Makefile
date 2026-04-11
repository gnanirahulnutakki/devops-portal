# TBD_PROJECT_NAME — MVP Makefile
#
# Quickstart:
#   make deps     # fetch Go deps
#   make build    # build gateway, agent, client
#   make demo     # run the end-to-end MVP demo in one shot

MODULE   := github.com/TBD_PROJECT_NAME/core
GO       := go
BINDIR   := bin
GATEWAY  := $(BINDIR)/gateway
AGENT    := $(BINDIR)/agent
CLIENT   := $(BINDIR)/client

.PHONY: all
all: build

.PHONY: deps
deps:
	$(GO) mod tidy

.PHONY: build
build: $(GATEWAY) $(AGENT) $(CLIENT)

$(GATEWAY):
	$(GO) build -o $(GATEWAY) ./gateway/cmd/gateway

$(AGENT):
	$(GO) build -o $(AGENT) ./agent/cmd/agent

$(CLIENT):
	$(GO) build -o $(CLIENT) ./cmd/client

.PHONY: run-gateway
run-gateway: $(GATEWAY)
	$(GATEWAY) -addr localhost:8080

.PHONY: run-agent
run-agent: $(AGENT)
	$(AGENT) -gateway http://localhost:8080 -agent-name local-agent

.PHONY: test-client
test-client: $(CLIENT)
	$(CLIENT) get-pods -namespace default

# Convenience target that launches gateway and agent in the background,
# runs the client once, then tears everything down.
.PHONY: demo
demo: build
	@echo "== starting gateway on localhost:8080 =="
	@$(GATEWAY) -addr localhost:8080 > /tmp/gateway.log 2>&1 & echo $$! > /tmp/gateway.pid
	@sleep 1
	@echo "== starting agent =="
	@$(AGENT) -gateway http://localhost:8080 -agent-name local-agent > /tmp/agent.log 2>&1 & echo $$! > /tmp/agent.pid
	@sleep 2
	@echo "== running client: get-pods -namespace default =="
	@$(CLIENT) get-pods -namespace default || true
	@echo "== tearing down =="
	@kill $$(cat /tmp/agent.pid) 2>/dev/null || true
	@kill $$(cat /tmp/gateway.pid) 2>/dev/null || true
	@rm -f /tmp/gateway.pid /tmp/agent.pid
	@echo "== logs at /tmp/gateway.log and /tmp/agent.log =="

.PHONY: clean
clean:
	rm -rf $(BINDIR)

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  deps         - go mod tidy"
	@echo "  build        - build gateway, agent, client binaries into ./bin/"
	@echo "  run-gateway  - start the gateway on localhost:8080"
	@echo "  run-agent    - start the agent pointing at localhost:8080"
	@echo "  test-client  - run the client against the gateway once"
	@echo "  demo         - end-to-end: gateway + agent + client in one shot"
	@echo "  clean        - remove ./bin/"
