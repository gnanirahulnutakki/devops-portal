# Architectural Justification: Why Not OCM?

As TBD_PROJECT_NAME progresses toward Cloud Native Computing Foundation (CNCF) Sandbox donation, a fundamental architectural question arises: *Why is this project not simply implemented as an Open Cluster Management (OCM) addon?* 

Given OCM's established position as a CNCF incubating project for multi-cluster management, any new project operating in the multi-cluster space must clearly delineate its boundaries, define its unique value proposition, and justify its independent architecture. This document serves as that formal justification, detailing our architectural divergence from OCM, our unique protocol-level contributions, and our complementary posture within the broader cloud-native ecosystem.

### 1. What OCM Does Well (and What We Adopt as Prior Art)

Open Cluster Management (OCM) is a mature, well-governed CNCF project that has successfully defined the standard for multi-cluster fleet management, workload distribution, and cluster lifecycle operations. We recognize OCM's foundational contributions to the multi-cluster ecosystem and explicitly adopt several of its architectural patterns as prior art for TBD_PROJECT_NAME.

Specifically, we acknowledge and draw inspiration from the following OCM capabilities:

*   **ManagedCluster Identity Model:** OCM's robust identity bootstrapping mechanism—utilizing join tokens, Certificate Signing Requests (CSRs), and hub-centric approval workflows—serves as the direct precedent for our own identity and registration architecture (DR-006).
*   **Addon Framework:** OCM's extensible addon framework demonstrates a highly effective pattern for extending hub and agent capabilities across a fleet without modifying the core control plane.
*   **Cluster-Proxy:** OCM's `cluster-proxy` project provides an elegant solution for reverse-tunneled access into spoke clusters operating behind restrictive firewalls or NAT, a network topology challenge we also address.
*   **Managed-ServiceAccount:** OCM's `managed-serviceaccount` provides a secure mechanism for token projection and identity federation across cluster boundaries, validating the need for cross-cluster credential management.

We view OCM as the premier framework for Kubernetes fleet management. However, TBD_PROJECT_NAME solves a fundamentally different class of problem: the secure, auditable, and schema-validated execution of day-2 operations.

### 2. What OCM Doesn't Do (Our Protocol's Unique Contributions)

While OCM excels at declarative state synchronization and workload propagation, it is not designed to be a generalized, typed remote procedure call (RPC) protocol for day-2 actions. TBD_PROJECT_NAME introduces several unique architectural contributions that fall outside of OCM's current or planned scope:

*   **Typed Operation Envelopes:** OCM dispatches work primarily through Kubernetes Custom Resource Definitions (CRDs) such as `ManifestWork` and `ClusterClaim`. In contrast, TBD_PROJECT_NAME defines a typed, schema-addressed, opaque-payload wire contract. This envelope is completely adapter-independent and does not rely on the Kubernetes API machinery as its transport layer, allowing for highly deterministic, synchronous operation execution and response handling.
*   **Gateway-Authored Canonical Audit:** OCM lacks a single-author, cryptographically verifiable audit model for cross-cluster operations; its audit trail is inherently log-based and distributed across per-component event streams. Our protocol enforces a strict gateway-authored canonical audit model, where the gateway serves as the definitive author of the operation record, corroborated by cryptographic evidence returned from the executing agent.
*   **Credential Reference Semantics:** While OCM's `managed-serviceaccount` handles token projection, it does not define a protocol-level credential reference envelope. TBD_PROJECT_NAME introduces explicit semantics for credential rotation, failure handling, and versioning directly within the operation envelope, ensuring that credential state is intrinsically linked to operation execution.
*   **Schema-Addressed Payloads:** OCM distributes work using raw YAML or JSON Kubernetes manifests. Our protocol utilizes a `schema_uri` and `payload_digest` paired with opaque payload bytes. This allows for adapter-independent schema distribution, strict payload validation before execution, and the ability to execute non-Kubernetes operations (e.g., database migrations, infrastructure provisioning) through the same secure channel.
*   **Dual OPA/CEL Policy Placement:** OCM's policy engines (such as the Policy Framework and Governance Policy Propagator) operate at the manifest and resource level. TBD_PROJECT_NAME enforces policy at the typed-operation-envelope level, utilizing a dual Open Policy Agent (OPA) and Common Expression Language (CEL) placement strategy. This allows for synchronous, fine-grained authorization decisions at both the central gateway (pre-dispatch) and the local agent (pre-execution).

### 3. Why This Is NOT an OCM Addon

The decision to build TBD_PROJECT_NAME as an independent protocol rather than an OCM addon is rooted in fundamental differences regarding the wire contract, trust boundaries, and deployment models. Building this as an OCM addon would require compromising the core security and audit guarantees of the protocol.

*   **Different Wire Contract:** OCM addons communicate via the OCM API, relying on `ManifestWork` and `ManagedClusterAddOn` CRDs synchronized through the Kubernetes API server. TBD_PROJECT_NAME defines its own highly optimized, synchronous gRPC wire format. This independence from the Kubernetes API surface is intentional, reducing latency, eliminating etcd storage overhead for ephemeral operations, and preventing API server throttling during massive fleet-wide operational bursts.
*   **Different Trust Model:** OCM operates on a trust model where the hub is trusted to author manifests, and the spoke blindly applies them. TBD_PROJECT_NAME enforces a distinct trust boundary: the gateway is the sole author of the audit record, but the agent provides corroborating cryptographic evidence of execution. This zero-trust operational model assumes the transport layer could be compromised and requires cryptographic proof of execution from the edge.
*   **Different Adapter Abstraction:** OCM addons are typically full, standalone Go programs (controllers) deployed continuously on spoke clusters. Our protocol's adapters are lightweight, typed operation handlers invoked dynamically by a generic, persistent agent. This composition model drastically reduces the resource footprint on edge clusters.
*   **Different Payload Model:** Because OCM's `ManifestWork` is designed to carry raw Kubernetes manifests, it is tightly coupled to the Kubernetes resource model. Our protocol carries schema-addressed opaque bytes. This means an operation can represent *any* adapter-specific action—such as triggering a remote script, interacting with a local hypervisor, or querying a proprietary API—not just applying a Kubernetes resource.
*   **Different Deployment Model:** OCM requires a fully functional Kubernetes cluster to serve as the hub control plane. TBD_PROJECT_NAME's gateway is a standalone, dependency-free Go binary. It does not require a running Kubernetes cluster for its control plane, allowing it to be deployed in highly constrained environments, edge POPs, or as a lightweight binary in a CI/CD pipeline.

### 4. Complementary Posture: How They Can Work Together

TBD_PROJECT_NAME is not a competitor to OCM; it is a complementary protocol designed to handle the specific edge cases of synchronous, audited, day-2 operations that declarative state synchronizers struggle with. We envision a highly synergistic relationship between the two projects:

*   **Protocol as a Transport Layer:** An OCM addon could seamlessly utilize TBD_PROJECT_NAME as its underlying transport layer for executing complex day-2 operations, bypassing the latency of `ManifestWork` synchronization for time-sensitive actions.
*   **Side-by-Side Deployment:** The TBD_PROJECT_NAME gateway can run alongside an OCM hub as a specialized operation dispatch service. While OCM handles cluster lifecycle and workload deployment, our gateway handles on-demand diagnostics, synchronous remediation, and audited break-glass access.
*   **Identity Infrastructure Reuse:** OCM's robust identity infrastructure, including its CSR flow and `cluster-proxy` tunneling mechanisms, can be directly reused by our protocol's agents, preventing the fragmentation of fleet identity management.
*   **Clear Scope Delineation:** This project explicitly does *not* compete with OCM's workload propagation, cluster lifecycle management, or declarative governance frameworks. We are strictly a protocol for typed, audited, synchronous actions. OCM remains the definitive framework for declarative cluster management.

By maintaining architectural independence, TBD_PROJECT_NAME can provide strict, synchronous audit and execution guarantees without forcing OCM to alter its highly successful, eventually-consistent declarative model.

### 5. Prior Art References

To provide context for CNCF Technical Oversight Committee (TOC) reviewers, we reference the following prior art, OCM documentation, and CNCF Sandbox precedents that informed this architectural justification:

*   **OCM Documentation:** https://open-cluster-management.io/docs/
*   **OCM Addon Developer Guide:** https://open-cluster-management.io/docs/developer-guides/addon/
*   **OCM Managed-ServiceAccount:** https://open-cluster-management.io/docs/getting-started/integration/managed-serviceaccount/
*   **OCM Cluster-Proxy:** https://open-cluster-management.io/docs/getting-started/integration/cluster-proxy/
*   **OCM Pushing Kube API Requests:** https://open-cluster-management.io/docs/scenarios/pushing-kube-api-requests/
*   **CNCF Sandbox Subproject Guidelines:** https://github.com/cncf/sandbox
*   **Relevant Prior Sandbox Rejections/Pushbacks:** OpenChoreo (#442), CrossView (#460) - *These reviews highlight the TOC's strict requirement for clear architectural differentiation from existing CNCF projects.*
