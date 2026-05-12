package agentv1_test

import (
	"testing"
	"time"

	"github.com/gnanirahulnutakki/devops-portal/agent/proto/devops_portal/agent/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// =============================================================================
// Envelope Serialization Tests
// =============================================================================

func TestEnvelopeRoundTrip(t *testing.T) {
	env := &agentv1.Envelope{
		V:          1,
		CommandId:  "0d2c4f3a-1234-5678-9abc-def012345678",
		IssuedAt:   time.Now().UTC().Format(time.RFC3339Nano),
		UserId:     "u_abcdef",
		TenantId:   "org_default",
		ClusterId:  "c_123",
		Intent:     "ListPods",
		ArgsHash:   "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		IssuerKid:  "central-issuer-2026-q2",
		Sig:        "ed25519:base64encodedsignaturehere",
	}

	b, err := proto.Marshal(env)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}

	var out agentv1.Envelope
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal envelope: %v", err)
	}

	if out.V != env.V {
		t.Errorf("V: got %d, want %d", out.V, env.V)
	}
	if out.CommandId != env.CommandId {
		t.Errorf("CommandId: got %s, want %s", out.CommandId, env.CommandId)
	}
	if out.UserId != env.UserId {
		t.Errorf("UserId: got %s, want %s", out.UserId, env.UserId)
	}
	if out.ClusterId != env.ClusterId {
		t.Errorf("ClusterId: got %s, want %s", out.ClusterId, env.ClusterId)
	}
	if out.Intent != env.Intent {
		t.Errorf("Intent: got %s, want %s", out.Intent, env.Intent)
	}
	if out.IssuerKid != env.IssuerKid {
		t.Errorf("IssuerKid: got %s, want %s", out.IssuerKid, env.IssuerKid)
	}
	if out.Sig != env.Sig {
		t.Errorf("Sig: got %s, want %s", out.Sig, env.Sig)
	}
}

func TestEnvelopeAllFields(t *testing.T) {
	env := &agentv1.Envelope{
		V:         1,
		CommandId: "cmd-001",
		IssuedAt:  "2026-05-12T01:00:00.123Z",
		UserId:    "user-1",
		TenantId:  "tenant-1",
		ClusterId: "cluster-1",
		Intent:    "AgentMetadata",
		ArgsHash:  "sha256:0000000000000000000000000000000000000000000000000000000000000000",
		IssuerKid: "kid-1",
		Sig:       "sig-1",
	}

	b, err := proto.Marshal(env)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.Envelope
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if !proto.Equal(env, &out) {
		t.Errorf("round-trip mismatch:\noriginal: %+v\noutput:   %+v", env, &out)
	}
}

// =============================================================================
// K8s Object Serialization Tests
// =============================================================================

func TestK8SPodRoundTrip(t *testing.T) {
	pod := &agentv1.K8SPod{
		Name:      "nginx-7c4b8b4d9-x2k3m",
		Namespace: "default",
		Status:    "Running",
		Phase:     "Running",
		Containers: []*agentv1.K8SContainer{
			{
				Name:         "nginx",
				Image:        "nginx:1.25",
				Ready:        true,
				RestartCount: 0,
			},
		},
		Labels: map[string]string{
			"app":     "nginx",
			"version": "1.25",
		},
	}

	b, err := proto.Marshal(pod)
	if err != nil {
		t.Fatalf("marshal pod: %v", err)
	}

	var out agentv1.K8SPod
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal pod: %v", err)
	}

	if out.Name != pod.Name {
		t.Errorf("Name: got %s, want %s", out.Name, pod.Name)
	}
	if out.Namespace != pod.Namespace {
		t.Errorf("Namespace: got %s, want %s", out.Namespace, pod.Namespace)
	}
	if out.Phase != pod.Phase {
		t.Errorf("Phase: got %s, want %s", out.Phase, pod.Phase)
	}
	if len(out.Containers) != 1 {
		t.Fatalf("Containers: got %d, want 1", len(out.Containers))
	}
	if out.Containers[0].Image != pod.Containers[0].Image {
		t.Errorf("Container.Image: got %s, want %s", out.Containers[0].Image, pod.Containers[0].Image)
	}
	if !out.Containers[0].Ready {
		t.Errorf("Container.Ready: got false, want true")
	}
	if out.Labels["app"] != "nginx" {
		t.Errorf("Label[app]: got %s, want nginx", out.Labels["app"])
	}
}

func TestK8SNodeRoundTrip(t *testing.T) {
	node := &agentv1.K8SNode{
		Name:           "kind-control-plane",
		Status:         "Ready",
		Labels:         map[string]string{"kubernetes.io/os": "linux"},
		Version:        "v1.32.0",
		CpuCapacity:    4000,
		MemoryCapacity: 8589934592,
	}

	b, err := proto.Marshal(node)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.K8SNode
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.Name != node.Name {
		t.Errorf("Name: got %s, want %s", out.Name, node.Name)
	}
	if out.CpuCapacity != node.CpuCapacity {
		t.Errorf("CpuCapacity: got %d, want %d", out.CpuCapacity, node.CpuCapacity)
	}
	if out.MemoryCapacity != node.MemoryCapacity {
		t.Errorf("MemoryCapacity: got %d, want %d", out.MemoryCapacity, node.MemoryCapacity)
	}
}

// =============================================================================
// Service Adapter Serialization Tests
// =============================================================================

func TestArgoApplicationRoundTrip(t *testing.T) {
	app := &agentv1.ArgoApplication{
		Name:           "guestbook",
		Project:        "default",
		RepoUrl:        "https://github.com/argoproj/argocd-example-apps.git",
		Path:           "guestbook",
		TargetRevision: "HEAD",
		SyncStatus:     "Synced",
		HealthStatus:   "Healthy",
		LastSync:       timestamppb.New(time.Now()),
	}

	b, err := proto.Marshal(app)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.ArgoApplication
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.Name != app.Name {
		t.Errorf("Name: got %s, want %s", out.Name, app.Name)
	}
	if out.SyncStatus != app.SyncStatus {
		t.Errorf("SyncStatus: got %s, want %s", out.SyncStatus, app.SyncStatus)
	}
	if out.LastSync == nil {
		t.Errorf("LastSync: got nil, want non-nil")
	}
}

func TestPromQueryResponseRoundTrip(t *testing.T) {
	resp := &agentv1.PromQueryResponse{
		ResultType: "vector",
		Result:     []byte(`[{"metric":{"__name__":"up"},"value":[1715472000,"1"]}]`),
	}

	b, err := proto.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.PromQueryResponse
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.ResultType != resp.ResultType {
		t.Errorf("ResultType: got %s, want %s", out.ResultType, resp.ResultType)
	}
	if string(out.Result) != string(resp.Result) {
		t.Errorf("Result: got %s, want %s", string(out.Result), string(resp.Result))
	}
}

// =============================================================================
// Request/Response Serialization Tests
// =============================================================================

func TestAgentMetadataRoundTrip(t *testing.T) {
	resp := &agentv1.AgentMetadataResponse{
		Version:    "0.5.0",
		ClusterId:  "c_test",
		Capabilities: []string{"k8s", "argocd", "prometheus"},
		Adapters: []*agentv1.AdapterInfo{
			{Name: "argocd", Version: "0.5.0", Healthy: true},
			{Name: "prometheus", Version: "0.5.0", Healthy: true},
		},
	}

	b, err := proto.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.AgentMetadataResponse
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.Version != resp.Version {
		t.Errorf("Version: got %s, want %s", out.Version, resp.Version)
	}
	if len(out.Adapters) != 2 {
		t.Fatalf("Adapters: got %d, want 2", len(out.Adapters))
	}
	if !out.Adapters[0].Healthy {
		t.Errorf("Adapter[0].Healthy: got false, want true")
	}
}

func TestHeartbeatRoundTrip(t *testing.T) {
	req := &agentv1.HeartbeatRequest{
		Timestamp: timestamppb.New(time.Now()),
	}
	resp := &agentv1.HeartbeatResponse{
		Timestamp:          timestamppb.New(time.Now()),
		Status:             "ok",
		DeprecationNotice:  "",
	}

	b1, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	b2, err := proto.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}

	var reqOut agentv1.HeartbeatRequest
	var respOut agentv1.HeartbeatResponse
	if err := proto.Unmarshal(b1, &reqOut); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	if err := proto.Unmarshal(b2, &respOut); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if respOut.Status != "ok" {
		t.Errorf("Status: got %s, want ok", respOut.Status)
	}
}

// =============================================================================
// Streaming Message Serialization Tests
// =============================================================================

func TestLogChunkRoundTrip(t *testing.T) {
	chunk := &agentv1.LogChunk{
		Line:      "2026-05-12 01:00:00 [INFO] server started",
		Timestamp: timestamppb.New(time.Now()),
		Truncated: false,
	}

	b, err := proto.Marshal(chunk)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out agentv1.LogChunk
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.Line != chunk.Line {
		t.Errorf("Line: got %s, want %s", out.Line, chunk.Line)
	}
	if out.Truncated != chunk.Truncated {
		t.Errorf("Truncated: got %v, want %v", out.Truncated, chunk.Truncated)
	}
}

// =============================================================================
// Audit Reconciliation Tests
// =============================================================================

func TestReportAuditCountsRoundTrip(t *testing.T) {
	req := &agentv1.ReportAuditCountsRequest{
		ClusterId:   "c_123",
		PeriodStart: timestamppb.New(time.Now().Add(-24 * time.Hour)),
		PeriodEnd:   timestamppb.New(time.Now()),
		Counts: []*agentv1.IntentCount{
			{Intent: "ListPods", Count: 1500},
			{Intent: "GetPod", Count: 300},
			{Intent: "ArgoListApplications", Count: 50},
		},
	}
	resp := &agentv1.ReportAuditCountsResponse{
		Reconciled:      true,
		MismatchDetail:  "",
	}

	b1, err := proto.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	b2, err := proto.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}

	var reqOut agentv1.ReportAuditCountsRequest
	var respOut agentv1.ReportAuditCountsResponse
	if err := proto.Unmarshal(b1, &reqOut); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	if err := proto.Unmarshal(b2, &respOut); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(reqOut.Counts) != 3 {
		t.Fatalf("Counts: got %d, want 3", len(reqOut.Counts))
	}
	if reqOut.Counts[0].Count != 1500 {
		t.Errorf("Counts[0].Count: got %d, want 1500", reqOut.Counts[0].Count)
	}
	if !respOut.Reconciled {
		t.Errorf("Reconciled: got false, want true")
	}
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestEmptyPodList(t *testing.T) {
	resp := &agentv1.PodsResponse{
		Items: []*agentv1.K8SPod{},
	}

	b, err := proto.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal empty list: %v", err)
	}

	var out agentv1.PodsResponse
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal empty list: %v", err)
	}

	if len(out.Items) != 0 {
		t.Errorf("Items: got %d, want 0", len(out.Items))
	}
}

func TestLargeLabelMap(t *testing.T) {
	labels := make(map[string]string)
	for i := 0; i < 1000; i++ {
		labels["label-"+string(rune(i))] = "value-" + string(rune(i))
	}

	pod := &agentv1.K8SPod{
		Name:   "heavy-labels",
		Labels: labels,
	}

	b, err := proto.Marshal(pod)
	if err != nil {
		t.Fatalf("marshal large labels: %v", err)
	}

	var out agentv1.K8SPod
	if err := proto.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal large labels: %v", err)
	}

	if len(out.Labels) != 1000 {
		t.Errorf("Labels: got %d, want 1000", len(out.Labels))
	}
}
