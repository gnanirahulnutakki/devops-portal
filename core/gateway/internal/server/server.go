package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/TBD_PROJECT_NAME/core/protocol/mvp"
)

const (
	commandBufferSize      = 16
	agentTokenHeader       = "X-Agent-Token"
	pendingStatus          = "pending"
	completedStatus        = "completed"
	expiredStatus          = "expired"
	defaultPollWait        = 25 * time.Second
	defaultExecuteWait     = 60 * time.Second
	defaultAgentTTL        = 120 * time.Second
	defaultEvictionEvery   = 60 * time.Second
	defaultOperationTTL    = 5 * time.Minute
	defaultOperationIDSize = 16
	defaultAgentIDSize     = 16
	defaultAgentTokenSize  = 32
)

type agentRecord struct {
	AgentID      string
	AgentName    string
	AgentToken   string
	Commands     chan mvp.Command
	LastPollTime time.Time
}

type operationRecord struct {
	OperationID string
	AgentID     string
	Status      string
	Result      *mvp.Result
	CreatedAt   time.Time
	ExpiresAt   time.Time
}

type Server struct {
	mu               sync.RWMutex
	agentsByID       map[string]*agentRecord
	agentNameToID    map[string]string
	pending          map[string]chan mvp.Result
	operations       map[string]*operationRecord
	pollWait         time.Duration
	executeWaitTimeout time.Duration
	agentTTL         time.Duration
	evictionInterval time.Duration
	operationTTL     time.Duration
}

// New creates a new in-memory MVP gateway server.
func New() *Server {
	s := &Server{
		agentsByID:         make(map[string]*agentRecord),
		agentNameToID:      make(map[string]string),
		pending:            make(map[string]chan mvp.Result),
		operations:         make(map[string]*operationRecord),
		pollWait:           defaultPollWait,
		executeWaitTimeout: defaultExecuteWait,
		agentTTL:           defaultAgentTTL,
		evictionInterval:   defaultEvictionEvery,
		operationTTL:       defaultOperationTTL,
	}
	go s.startEviction()
	return s
}

// Handler returns the HTTP handler for the MVP gateway API.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/register", s.handleRegister)
	mux.HandleFunc("/poll", s.handlePoll)
	mux.HandleFunc("/submit-result", s.handleSubmitResult)
	mux.HandleFunc("/execute", s.handleExecute)
	mux.HandleFunc("/result", s.handleGetResult)
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

	agentID, err := randomHex(defaultAgentIDSize)
	if err != nil {
		log.Printf("register agent_name=%s error=%v", req.AgentName, err)
		http.Error(w, "failed to generate agent id", http.StatusInternalServerError)
		return
	}
	agentToken, err := randomHex(defaultAgentTokenSize)
	if err != nil {
		log.Printf("register agent_name=%s error=%v", req.AgentName, err)
		http.Error(w, "failed to generate agent token", http.StatusInternalServerError)
		return
	}

	now := time.Now()

	s.mu.Lock()
	if existingID, ok := s.agentNameToID[req.AgentName]; ok {
		if _, exists := s.agentsByID[existingID]; exists {
			s.mu.Unlock()
			log.Printf("register-rejected agent_name=%s reason=duplicate", req.AgentName)
			http.Error(w, "agent already registered", http.StatusConflict)
			return
		}
		delete(s.agentNameToID, req.AgentName)
	}
	s.agentsByID[agentID] = &agentRecord{
		AgentID:      agentID,
		AgentName:    req.AgentName,
		AgentToken:   agentToken,
		Commands:     make(chan mvp.Command, commandBufferSize),
		LastPollTime: now,
	}
	s.agentNameToID[req.AgentName] = agentID
	s.mu.Unlock()

	log.Printf("register agent_name=%s agent_id=%s", req.AgentName, agentID)
	writeJSON(w, http.StatusOK, mvp.RegisterResponse{
		AgentID:    agentID,
		AgentToken: agentToken,
	})
}

func (s *Server) handlePoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	agentID := r.URL.Query().Get("agent_id")
	if agentID == "" {
		http.Error(w, "agent_id is required", http.StatusBadRequest)
		return
	}

	token := r.Header.Get(agentTokenHeader)
	if token == "" {
		http.Error(w, "missing agent token", http.StatusForbidden)
		return
	}

	s.mu.Lock()
	rec, ok := s.agentsByID[agentID]
	if !ok {
		s.mu.Unlock()
		http.Error(w, "agent not found", http.StatusNotFound)
		return
	}
	if rec.AgentToken != token {
		s.mu.Unlock()
		http.Error(w, "invalid agent token", http.StatusForbidden)
		return
	}
	rec.LastPollTime = time.Now()
	s.mu.Unlock()

	log.Printf("poll-blocked agent_id=%s", agentID)

	select {
	case cmd := <-rec.Commands:
		log.Printf("poll-delivered agent_id=%s operation_id=%s adapter_name=%s", agentID, cmd.OperationID, cmd.AdapterName)
		writeJSON(w, http.StatusOK, cmd)
	case <-time.After(s.pollWait):
		log.Printf("poll-timeout agent_id=%s", agentID)
		w.WriteHeader(http.StatusNoContent)
	case <-r.Context().Done():
		log.Printf("poll-cancelled agent_id=%s", agentID)
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

	token := r.Header.Get(agentTokenHeader)
	if token == "" {
		http.Error(w, "missing agent token", http.StatusForbidden)
		return
	}

	var waiter chan mvp.Result

	s.mu.Lock()
	op, ok := s.operations[res.OperationID]
	if !ok {
		s.mu.Unlock()
		log.Printf("submit operation_id=%s stale=true", res.OperationID)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if time.Now().After(op.ExpiresAt) {
		op.Status = expiredStatus
		delete(s.operations, res.OperationID)
		delete(s.pending, res.OperationID)
		s.mu.Unlock()
		log.Printf("operation-expired operation_id=%s", res.OperationID)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	rec, ok := s.agentsByID[op.AgentID]
	if !ok || rec.AgentToken != token {
		s.mu.Unlock()
		log.Printf("submit-forbidden operation_id=%s agent_id=%s", res.OperationID, op.AgentID)
		http.Error(w, "invalid agent token", http.StatusForbidden)
		return
	}

	if op.Status == completedStatus {
		s.mu.Unlock()
		log.Printf("submit operation_id=%s duplicate=true", res.OperationID)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	resCopy := res
	op.Result = &resCopy
	op.Status = completedStatus
	op.ExpiresAt = time.Now().Add(s.operationTTL)
	waiter = s.pending[res.OperationID]
	delete(s.pending, res.OperationID)
	s.mu.Unlock()

	if waiter != nil {
		select {
		case waiter <- resCopy:
		default:
		}
	}

	log.Printf("operation-completed operation_id=%s agent_id=%s ok=%t", res.OperationID, op.AgentID, res.OK)
	log.Printf("submit operation_id=%s stale=false ok=%t", res.OperationID, res.OK)
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
	agentID, ok := s.agentNameToID[req.AgentName]
	if !ok {
		s.mu.RUnlock()
		http.Error(w, "agent not found", http.StatusNotFound)
		return
	}
	rec, ok := s.agentsByID[agentID]
	s.mu.RUnlock()
	if !ok {
		http.Error(w, "agent not found", http.StatusNotFound)
		return
	}

	opID, err := newOperationID()
	if err != nil {
		log.Printf("execute-request agent_name=%s error=%v", req.AgentName, err)
		http.Error(w, "failed to generate operation id", http.StatusInternalServerError)
		return
	}

	cmd := mvp.Command{
		OperationID: opID,
		AdapterName: req.AdapterName,
		Params:      req.Params,
	}
	resultCh := make(chan mvp.Result, 1)
	now := time.Now()

	s.mu.Lock()
	s.operations[opID] = &operationRecord{
		OperationID: opID,
		AgentID:     rec.AgentID,
		Status:      pendingStatus,
		CreatedAt:   now,
		ExpiresAt:   now.Add(s.operationTTL),
	}
	s.pending[opID] = resultCh
	s.mu.Unlock()

	log.Printf("execute-request agent_name=%s agent_id=%s operation_id=%s adapter_name=%s", req.AgentName, rec.AgentID, opID, req.AdapterName)
	log.Printf("operation-pending operation_id=%s agent_id=%s", opID, rec.AgentID)

	select {
	case rec.Commands <- cmd:
		log.Printf("execute-dispatched agent_id=%s operation_id=%s", rec.AgentID, opID)
	default:
		s.mu.Lock()
		delete(s.pending, opID)
		delete(s.operations, opID)
		s.mu.Unlock()
		http.Error(w, "agent command queue full", http.StatusServiceUnavailable)
		return
	}

	timer := time.NewTimer(s.executeWaitTimeout)
	defer timer.Stop()

	select {
	case res := <-resultCh:
		log.Printf("execute-returned agent_id=%s operation_id=%s ok=%t", rec.AgentID, opID, res.OK)
		writeJSON(w, http.StatusOK, mvp.ExecuteResponse{
			OperationID: opID,
			OK:          res.OK,
			Error:       res.Error,
			ResultJSON:  res.ResultJSON,
		})
	case <-timer.C:
		log.Printf("execute-pending operation_id=%s", opID)
		writeJSON(w, http.StatusAccepted, mvp.ExecuteResponse{
			OperationID: opID,
		})
	case <-r.Context().Done():
		log.Printf("execute-cancelled operation_id=%s", opID)
		return
	}
}

func (s *Server) handleGetResult(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	operationID := r.URL.Query().Get("operation_id")
	if operationID == "" {
		http.Error(w, "operation_id is required", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	op, ok := s.operations[operationID]
	if !ok {
		s.mu.Unlock()
		http.Error(w, "operation not found", http.StatusNotFound)
		return
	}
	if time.Now().After(op.ExpiresAt) {
		op.Status = expiredStatus
		delete(s.operations, operationID)
		delete(s.pending, operationID)
		s.mu.Unlock()
		log.Printf("operation-expired operation_id=%s", operationID)
		http.Error(w, "operation expired", http.StatusNotFound)
		return
	}

	status := mvp.OperationStatus{
		OperationID: operationID,
		Status:      op.Status,
	}
	if op.Result != nil {
		resultCopy := *op.Result
		status.Result = &resultCopy
	}
	s.mu.Unlock()

	log.Printf("get-result operation_id=%s status=%s", operationID, status.Status)
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) startEviction() {
	ticker := time.NewTicker(s.evictionInterval)
	defer ticker.Stop()

	for now := range ticker.C {
		s.pruneStaleAgents(now)
		s.pruneExpiredOperations(now)
	}
}

func (s *Server) pruneStaleAgents(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for agentID, rec := range s.agentsByID {
		if now.Sub(rec.LastPollTime) <= s.agentTTL {
			continue
		}
		if s.agentHasPendingOperationLocked(agentID) {
			continue
		}
		delete(s.agentsByID, agentID)
		delete(s.agentNameToID, rec.AgentName)
		log.Printf("agent-evicted agent_name=%s agent_id=%s", rec.AgentName, rec.AgentID)
	}
}

func (s *Server) pruneExpiredOperations(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for operationID, op := range s.operations {
		if now.After(op.ExpiresAt) {
			op.Status = expiredStatus
			delete(s.operations, operationID)
			delete(s.pending, operationID)
			log.Printf("operation-expired operation_id=%s", operationID)
		}
	}
}

func (s *Server) agentHasPendingOperationLocked(agentID string) bool {
	for _, op := range s.operations {
		if op.AgentID == agentID && op.Status == pendingStatus {
			return true
		}
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func newOperationID() (string, error) {
	return randomHex(defaultOperationIDSize)
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
