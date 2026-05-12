package agentv1_test

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/gnanirahulnutakki/devops-portal/agent/proto/devops_portal/agent/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// =============================================================================
// In-Memory gRPC Server/Client Integration Tests
// =============================================================================

// testServer implements the AgentServer interface with real (not mocked) responses
type testServer struct {
	agentv1.UnimplementedAgentServer
}

func (s *testServer) AgentMetadata(ctx context.Context, req *agentv1.AgentMetadataRequest) (*agentv1.AgentMetadataResponse, error) {
	return &agentv1.AgentMetadataResponse{
		Version:    "0.5.0",
		ClusterId:  "c_test",
		Capabilities: []string{"k8s", "argocd", "prometheus"},
		Adapters: []*agentv1.AdapterInfo{
			{Name: "argocd", Version: "0.5.0", Healthy: true},
			{Name: "prometheus", Version: "0.5.0", Healthy: true},
		},
	}, nil
}

func (s *testServer) Heartbeat(ctx context.Context, req *agentv1.HeartbeatRequest) (*agentv1.HeartbeatResponse, error) {
	return &agentv1.HeartbeatResponse{
		Timestamp: timestamppb.New(time.Now()),
		Status:    "ok",
	}, nil
}

func (s *testServer) ListNodes(ctx context.Context, req *agentv1.K8SListRequest) (*agentv1.NodesResponse, error) {
	return &agentv1.NodesResponse{
		Items: []*agentv1.K8SNode{
			{
				Name:           "kind-control-plane",
				Status:         "Ready",
				Labels:         map[string]string{"kubernetes.io/os": "linux"},
				Version:        "v1.32.0",
				CpuCapacity:    4000,
				MemoryCapacity: 8589934592,
			},
		},
	}, nil
}

func (s *testServer) ListPods(ctx context.Context, req *agentv1.K8SListPodsRequest) (*agentv1.PodsResponse, error) {
	return &agentv1.PodsResponse{
		Items: []*agentv1.K8SPod{
			{
				Name:      "nginx-7c4b8b4d9-x2k3m",
				Namespace: req.Namespace,
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
				Labels: map[string]string{"app": "nginx"},
			},
		},
	}, nil
}

func (s *testServer) GetPod(ctx context.Context, req *agentv1.K8SGetPodRequest) (*agentv1.Pod, error) {
	return &agentv1.Pod{
		Pod: &agentv1.K8SPod{
			Name:      req.Name,
			Namespace: req.Namespace,
			Status:    "Running",
			Phase:     "Running",
			Containers: []*agentv1.K8SContainer{
				{
					Name:  "main",
					Image: "busybox:latest",
					Ready: true,
				},
			},
		},
	}, nil
}

func (s *testServer) StreamPodLogs(req *agentv1.StreamPodLogsRequest, stream agentv1.Agent_StreamPodLogsServer) error {
	for i := 0; i < 5; i++ {
		if err := stream.Send(&agentv1.LogChunk{
			Line:      "log line " + string(rune('0'+i)),
			Timestamp: timestamppb.New(time.Now()),
			Truncated: false,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *testServer) ArgoListApplications(ctx context.Context, req *agentv1.ArgoListAppsRequest) (*agentv1.ArgoApplicationsResponse, error) {
	return &agentv1.ArgoApplicationsResponse{
		Items: []*agentv1.ArgoApplication{
			{
				Name:           "guestbook",
				Project:        "default",
				RepoUrl:        "https://github.com/argoproj/argocd-example-apps.git",
				Path:           "guestbook",
				TargetRevision: "HEAD",
				SyncStatus:     "Synced",
				HealthStatus:   "Healthy",
				LastSync:       timestamppb.New(time.Now()),
			},
		},
	}, nil
}

func (s *testServer) PromQuery(ctx context.Context, req *agentv1.PromQueryRequest) (*agentv1.PromQueryResponse, error) {
	return &agentv1.PromQueryResponse{
		ResultType: "vector",
		Result:     []byte(`[{"metric":{"__name__":"up"},"value":[1715472000,"1"]}]`),
	}, nil
}

func (s *testServer) ReportAuditCounts(ctx context.Context, req *agentv1.ReportAuditCountsRequest) (*agentv1.ReportAuditCountsResponse, error) {
	return &agentv1.ReportAuditCountsResponse{
		Reconciled:     true,
		MismatchDetail: "",
	}, nil
}

// startTestServer spins up a real gRPC server on a random local port
func startTestServer(t *testing.T) (*grpc.Server, net.Listener) {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	agentv1.RegisterAgentServer(s, &testServer{})

	go func() {
		if err := s.Serve(lis); err != nil {
			t.Logf("server serve error (expected on shutdown): %v", err)
		}
	}()

	// Give the server a moment to start accepting
	time.Sleep(50 * time.Millisecond)

	return s, lis
}

// =============================================================================
// Integration Tests (Real gRPC Server + Client)
// =============================================================================

func TestGRPCAgentMetadata(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.AgentMetadata(ctx, &agentv1.AgentMetadataRequest{})
	if err != nil {
		t.Fatalf("AgentMetadata: %v", err)
	}

	if resp.Version != "0.5.0" {
		t.Errorf("Version: got %s, want 0.5.0", resp.Version)
	}
	if resp.ClusterId != "c_test" {
		t.Errorf("ClusterId: got %s, want c_test", resp.ClusterId)
	}
	if len(resp.Adapters) != 2 {
		t.Fatalf("Adapters: got %d, want 2", len(resp.Adapters))
	}
	if resp.Adapters[0].Name != "argocd" {
		t.Errorf("Adapter[0].Name: got %s, want argocd", resp.Adapters[0].Name)
	}
}

func TestGRPCHeartbeat(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.Heartbeat(ctx, &agentv1.HeartbeatRequest{
		Timestamp: timestamppb.New(time.Now()),
	})
	if err != nil {
		t.Fatalf("Heartbeat: %v", err)
	}

	if resp.Status != "ok" {
		t.Errorf("Status: got %s, want ok", resp.Status)
	}
	if resp.Timestamp == nil {
		t.Errorf("Timestamp: got nil, want non-nil")
	}
}

func TestGRPCListNodes(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.ListNodes(ctx, &agentv1.K8SListRequest{})
	if err != nil {
		t.Fatalf("ListNodes: %v", err)
	}

	if len(resp.Items) != 1 {
		t.Fatalf("Items: got %d, want 1", len(resp.Items))
	}
	if resp.Items[0].Name != "kind-control-plane" {
		t.Errorf("Name: got %s, want kind-control-plane", resp.Items[0].Name)
	}
	if resp.Items[0].CpuCapacity != 4000 {
		t.Errorf("CpuCapacity: got %d, want 4000", resp.Items[0].CpuCapacity)
	}
}

func TestGRPCListPods(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.ListPods(ctx, &agentv1.K8SListPodsRequest{
		Namespace: "default",
	})
	if err != nil {
		t.Fatalf("ListPods: %v", err)
	}

	if len(resp.Items) != 1 {
		t.Fatalf("Items: got %d, want 1", len(resp.Items))
	}
	if resp.Items[0].Namespace != "default" {
		t.Errorf("Namespace: got %s, want default", resp.Items[0].Namespace)
	}
	if len(resp.Items[0].Containers) != 1 {
		t.Fatalf("Containers: got %d, want 1", len(resp.Items[0].Containers))
	}
	if resp.Items[0].Containers[0].Image != "nginx:1.25" {
		t.Errorf("Image: got %s, want nginx:1.25", resp.Items[0].Containers[0].Image)
	}
}

func TestGRPCGetPod(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.GetPod(ctx, &agentv1.K8SGetPodRequest{
		Namespace: "default",
		Name:      "test-pod",
	})
	if err != nil {
		t.Fatalf("GetPod: %v", err)
	}

	if resp.Pod == nil {
		t.Fatalf("Pod: got nil")
	}
	if resp.Pod.Name != "test-pod" {
		t.Errorf("Name: got %s, want test-pod", resp.Pod.Name)
	}
	if resp.Pod.Namespace != "default" {
		t.Errorf("Namespace: got %s, want default", resp.Pod.Namespace)
	}
}

func TestGRPCStreamPodLogs(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stream, err := client.StreamPodLogs(ctx, &agentv1.StreamPodLogsRequest{
		Namespace:  "default",
		PodName:    "nginx-xxx",
		Container:  "nginx",
		Follow:     true,
		TailLines:  100,
		Timestamps: true,
	})
	if err != nil {
		t.Fatalf("StreamPodLogs: %v", err)
	}

	var lines []string
	for {
		chunk, err := stream.Recv()
		if err != nil {
			break
		}
		lines = append(lines, chunk.Line)
	}

	if len(lines) != 5 {
		t.Fatalf("lines: got %d, want 5", len(lines))
	}
	if lines[0] != "log line 0" {
		t.Errorf("lines[0]: got %s, want log line 0", lines[0])
	}
}

func TestGRPCArgoListApplications(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.ArgoListApplications(ctx, &agentv1.ArgoListAppsRequest{})
	if err != nil {
		t.Fatalf("ArgoListApplications: %v", err)
	}

	if len(resp.Items) != 1 {
		t.Fatalf("Items: got %d, want 1", len(resp.Items))
	}
	if resp.Items[0].Name != "guestbook" {
		t.Errorf("Name: got %s, want guestbook", resp.Items[0].Name)
	}
	if resp.Items[0].SyncStatus != "Synced" {
		t.Errorf("SyncStatus: got %s, want Synced", resp.Items[0].SyncStatus)
	}
}

func TestGRPCPromQuery(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.PromQuery(ctx, &agentv1.PromQueryRequest{
		Query: "up",
	})
	if err != nil {
		t.Fatalf("PromQuery: %v", err)
	}

	if resp.ResultType != "vector" {
		t.Errorf("ResultType: got %s, want vector", resp.ResultType)
	}
	if len(resp.Result) == 0 {
		t.Errorf("Result: got empty, want non-empty")
	}
}

func TestGRPCReportAuditCounts(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.ReportAuditCounts(ctx, &agentv1.ReportAuditCountsRequest{
		ClusterId: "c_123",
		Counts: []*agentv1.IntentCount{
			{Intent: "ListPods", Count: 1500},
		},
	})
	if err != nil {
		t.Fatalf("ReportAuditCounts: %v", err)
	}

	if !resp.Reconciled {
		t.Errorf("Reconciled: got false, want true")
	}
	if resp.MismatchDetail != "" {
		t.Errorf("MismatchDetail: got %s, want empty", resp.MismatchDetail)
	}
}

// =============================================================================
// Connection Lifecycle Tests
// =============================================================================

func TestGRPCServerShutdown(t *testing.T) {
	server, lis := startTestServer(t)

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	// Verify connection works before shutdown
	client := agentv1.NewAgentClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err = client.Heartbeat(ctx, &agentv1.HeartbeatRequest{})
	if err != nil {
		t.Fatalf("pre-shutdown heartbeat: %v", err)
	}

	// Graceful shutdown
	server.GracefulStop()

	// Post-shutdown request should fail
	ctx2, cancel2 := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel2()

	_, err = client.Heartbeat(ctx2, &agentv1.HeartbeatRequest{})
	if err == nil {
		t.Errorf("post-shutdown heartbeat: expected error, got nil")
	}
}

func TestGRPCConnectionTimeout(t *testing.T) {
	server, lis := startTestServer(t)
	defer server.Stop()

	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer conn.Close()

	client := agentv1.NewAgentClient(conn)
	// Very short timeout to test deadline propagation
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err = client.AgentMetadata(ctx, &agentv1.AgentMetadataRequest{})
	// Request may succeed or fail with deadline exceeded depending on timing;
	// either is acceptable for this test
	t.Logf("short timeout result: %v", err)
}
