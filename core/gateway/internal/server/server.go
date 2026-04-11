package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/TBD_PROJECT_NAME/core/protocol/mvp"
)

type agentRecord struct {
	AgentID  string
	Commands chan mvp.Command
}

type Server struct {
	mu      sync.RWMutex
	agents  map[string]*agentRecord
	pending map[string]chan mvp.Result
}

func New() *Server {
	return &Server{
		agents:  make(map[string]*agentRecord),
		pending: make(map[string]chan mvp.Result),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/register", s.handleRegister)
	mux.HandleFunc("/poll", s.handlePoll)
	mux.HandleFunc("/submit-result", s.handleSubmitResult)
	mux.HandleFunc("/execute", s.handleExecute)
	return mux
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req mvp.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.AgentName == "" {
		http.Error(w, "agent_name is required", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	rec, ok := s.agents[req.AgentName]
	if !ok {
		rec = &agentRecord{
			AgentID:  req.AgentName,
			Commands: make(chan mvp.Command, 16),
		}
		s.agents[req.AgentName] = rec
	}
	s.mu.Unlock()

	log.Printf("register agent_name=%s agent_id=%s", req.AgentName, rec.AgentID)
	writeJSON(w, http.StatusOK, mvp.RegisterResponse{AgentID: rec.AgentID})
}

func (s *Server) handlePoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	agentName := r.URL.Query().Get("agent_name")
	if agentName == "" {
		http.Error(w, "agent_name is required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	rec, ok := s.agents[agentName]
	s.mu.RUnlock()
	if !ok {
		http.Error(w, "agent not found", http.StatusNotFound)
		return
	}

	log.Printf("poll-blocked agent_name=%s", agentName)

	select {
	case cmd := <-rec.Commands:
		log.Printf("poll-delivered agent_name=%s operation_id=%s adapter_name=%s", agentName, cmd.OperationID, cmd.AdapterName)
		writeJSON(w, http.StatusOK, cmd)
	case <-time.After(25 * time.Second):
		log.Printf("poll-timeout agent_name=%s", agentName)
		w.WriteHeader(http.StatusNoContent)
	case <-r.Context().Done():
		return
	}
}

func (s *Server) handleSubmitResult(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var res mvp.Result
	if err := json.NewDecoder(r.Body).Decode(&res); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if res.OperationID == "" {
		http.Error(w, "operation_id is required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	ch, ok := s.pending[res.OperationID]
	s.mu.RUnlock()

	if !ok {
		log.Printf("submit operation_id=%s stale=true", res.OperationID)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	select {
	case ch <- res:
		log.Printf("submit operation_id=%s stale=false ok=%t", res.OperationID, res.OK)
	default:
		log.Printf("submit operation_id=%s stale=true buffered=true", res.OperationID)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req mvp.ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.AgentName == "" || req.AdapterName == "" {
		http.Error(w, "agent_name and adapter_name are required", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	rec, ok := s.agents[req.AgentName]
	s.mu.RUnlock()
	if !ok {
		http.Error(w, "agent not found", http.StatusNotFound)
		return
	}

	opID := newOperationID()
	cmd := mvp.Command{
		OperationID: opID,
		AdapterName: req.AdapterName,
		Params:      req.Params,
	}
	resultCh := make(chan mvp.Result, 1)

	s.mu.Lock()
	s.pending[opID] = resultCh
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.pending, opID)
		s.mu.Unlock()
	}()

	log.Printf("execute-request agent_name=%s operation_id=%s adapter_name=%s", req.AgentName, opID, req.AdapterName)

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	select {
	case rec.Commands <- cmd:
		log.Printf("execute-dispatched agent_name=%s operation_id=%s", req.AgentName, opID)
	case <-ctx.Done():
		if ctx.Err() == context.DeadlineExceeded {
			http.Error(w, "execute timed out", http.StatusGatewayTimeout)
			return
		}
		return
	}

	select {
	case res := <-resultCh:
		log.Printf("execute-returned agent_name=%s operation_id=%s ok=%t", req.AgentName, opID, res.OK)
		writeJSON(w, http.StatusOK, mvp.ExecuteResponse{
			OK:         res.OK,
			Error:      res.Error,
			ResultJSON: res.ResultJSON,
		})
	case <-ctx.Done():
		if ctx.Err() == context.DeadlineExceeded {
			http.Error(w, "execute timed out", http.StatusGatewayTimeout)
			return
		}
		return
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func newOperationID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err == nil {
		return hex.EncodeToString(buf)
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
