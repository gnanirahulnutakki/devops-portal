package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TBD_PROJECT_NAME/core/protocol/mvp"
)

func TestRegister_Success(t *testing.T) {
	s := New()
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	resp, body := doJSONRequest(t, http.MethodPost, ts.URL+"/register", mvp.RegisterRequest{
		AgentName: "agent-a",
	}, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	var rr mvp.RegisterResponse
	if err := json.Unmarshal(body, &rr); err != nil {
		t.Fatalf("unmarshal register response: %v", err)
	}
	if rr.AgentID == "" {
		t.Fatal("expected non-empty agent_id")
	}
	if rr.AgentToken == "" {
		t.Fatal("expected non-empty agent_token")
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.agentsByID[rr.AgentID]; !ok {
		t.Fatalf("expected agent_id %q to be present", rr.AgentID)
	}
	if gotID := s.agentNameToID["agent-a"]; gotID != rr.AgentID {
		t.Fatalf("expected agent name mapping to %q, got %q", rr.AgentID, gotID)
	}
}

func TestRegister_DuplicateRejected(t *testing.T) {
	s := New()
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	firstResp, _ := doJSONRequest(t, http.MethodPost, ts.URL+"/register", mvp.RegisterRequest{
		AgentName: "agent-a",
	}, nil)
	firstResp.Body.Close()

	resp, body := doJSONRequest(t, http.MethodPost, ts.URL+"/register", mvp.RegisterRequest{
		AgentName: "agent-a",
	}, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.StatusCode, string(body))
	}
}

func TestSubmitResult_WrongToken(t *testing.T) {
	s := New()
	s.executeWaitTimeout = 10 * time.Millisecond
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	reg := registerAgent(t, ts.URL, "agent-a")
	execResp := executeAsync(t, ts.URL, "agent-a", "k8s-get-pods")

	resp, body := doJSONRequest(t, http.MethodPost, ts.URL+"/submit-result", mvp.Result{
		OperationID: execResp.OperationID,
		OK:          true,
	}, map[string]string{
		agentTokenHeader: "wrong-token",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.StatusCode, string(body))
	}

	_ = reg
}

func TestSubmitResult_ValidToken(t *testing.T) {
	s := New()
	s.executeWaitTimeout = 10 * time.Millisecond
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	reg := registerAgent(t, ts.URL, "agent-a")
	execResp := executeAsync(t, ts.URL, "agent-a", "k8s-get-pods")

	resp, body := doJSONRequest(t, http.MethodPost, ts.URL+"/submit-result", mvp.Result{
		OperationID: execResp.OperationID,
		OK:          true,
		ResultJSON:  []byte(`{"pods":[]}`),
	}, map[string]string{
		agentTokenHeader: reg.AgentToken,
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", resp.StatusCode, string(body))
	}
}

func TestExecute_Timeout_Returns202(t *testing.T) {
	s := New()
	s.executeWaitTimeout = 10 * time.Millisecond
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	registerAgent(t, ts.URL, "agent-a")

	resp, body := doJSONRequest(t, http.MethodPost, ts.URL+"/execute", mvp.ExecuteRequest{
		AgentName:   "agent-a",
		AdapterName: "k8s-get-pods",
		Params:      map[string]any{"namespace": "default"},
	}, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", resp.StatusCode, string(body))
	}

	var execResp mvp.ExecuteResponse
	if err := json.Unmarshal(body, &execResp); err != nil {
		t.Fatalf("unmarshal execute response: %v", err)
	}
	if execResp.OperationID == "" {
		t.Fatal("expected non-empty operation_id")
	}
}

func TestGetResult_AfterTimeout(t *testing.T) {
	s := New()
	s.executeWaitTimeout = 10 * time.Millisecond
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	reg := registerAgent(t, ts.URL, "agent-a")
	execResp := executeAsync(t, ts.URL, "agent-a", "k8s-get-pods")

	submitResp, submitBody := doJSONRequest(t, http.MethodPost, ts.URL+"/submit-result", mvp.Result{
		OperationID: execResp.OperationID,
		OK:          true,
		ResultJSON:  []byte(`{"items":[{"name":"pod-a"}]}`),
	}, map[string]string{
		agentTokenHeader: reg.AgentToken,
	})
	submitResp.Body.Close()
	if submitResp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected submit 204, got %d: %s", submitResp.StatusCode, string(submitBody))
	}

	resp, body := doJSONRequest(t, http.MethodGet, ts.URL+"/result?operation_id="+execResp.OperationID, nil, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	var status mvp.OperationStatus
	if err := json.Unmarshal(body, &status); err != nil {
		t.Fatalf("unmarshal operation status: %v", err)
	}
	if status.Status != completedStatus {
		t.Fatalf("expected status %q, got %q", completedStatus, status.Status)
	}
	if status.Result == nil {
		t.Fatal("expected non-nil result")
	}
	if !status.Result.OK {
		t.Fatal("expected OK result")
	}
}

func TestGetResult_NotFound(t *testing.T) {
	s := New()
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	resp, body := doJSONRequest(t, http.MethodGet, ts.URL+"/result?operation_id=missing", nil, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", resp.StatusCode, string(body))
	}
}

func TestEviction_PrunesStaleAgent(t *testing.T) {
	s := New()
	ts := httptest.NewServer(s.Handler())
	defer ts.Close()

	reg := registerAgent(t, ts.URL, "agent-a")

	s.mu.Lock()
	rec, ok := s.agentsByID[reg.AgentID]
	if !ok {
		s.mu.Unlock()
		t.Fatalf("expected registered agent %q", reg.AgentID)
	}
	rec.LastPollTime = time.Now().Add(-3 * time.Minute)
	s.mu.Unlock()

	s.pruneStaleAgents(time.Now())

	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.agentsByID[reg.AgentID]; ok {
		t.Fatalf("expected agent %q to be evicted", reg.AgentID)
	}
	if _, ok := s.agentNameToID["agent-a"]; ok {
		t.Fatal("expected agent name mapping to be removed")
	}
}

func registerAgent(t *testing.T, baseURL, agentName string) mvp.RegisterResponse {
	t.Helper()

	resp, body := doJSONRequest(t, http.MethodPost, baseURL+"/register", mvp.RegisterRequest{
		AgentName: agentName,
	}, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("register expected 200, got %d: %s", resp.StatusCode, string(body))
	}

	var rr mvp.RegisterResponse
	if err := json.Unmarshal(body, &rr); err != nil {
		t.Fatalf("unmarshal register response: %v", err)
	}
	return rr
}

func executeAsync(t *testing.T, baseURL, agentName, adapterName string) mvp.ExecuteResponse {
	t.Helper()

	resp, body := doJSONRequest(t, http.MethodPost, baseURL+"/execute", mvp.ExecuteRequest{
		AgentName:   agentName,
		AdapterName: adapterName,
		Params:      map[string]any{"namespace": "default"},
	}, nil)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("execute expected 202, got %d: %s", resp.StatusCode, string(body))
	}

	var execResp mvp.ExecuteResponse
	if err := json.Unmarshal(body, &execResp); err != nil {
		t.Fatalf("unmarshal execute response: %v", err)
	}
	if execResp.OperationID == "" {
		t.Fatal("expected non-empty operation_id")
	}
	return execResp
}

func doJSONRequest(t *testing.T, method, url string, body any, headers map[string]string) (*http.Response, []byte) {
	t.Helper()

	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		resp.Body.Close()
		t.Fatalf("read response: %v", err)
	}
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	return resp, raw
}
