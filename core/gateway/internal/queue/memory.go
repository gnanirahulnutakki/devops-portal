package queue

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// InMemoryQueue is a non-durable DurableQueue implementation for tests and
// laptop development only.
//
// Operations stored here are lost on process restart. It must not be used as
// the durability mechanism for any environment that claims ACCEPTED is crash
// safe.
type InMemoryQueue struct {
	mu         sync.RWMutex
	operations map[string]*Operation
	agentQueue map[string][]string
	closed     bool
}

// NewInMemoryQueue creates a new non-durable queue implementation.
func NewInMemoryQueue() *InMemoryQueue {
	return &InMemoryQueue{
		operations: make(map[string]*Operation),
		agentQueue: make(map[string][]string),
	}
}

// Enqueue stores op in memory and appends it to the agent's FIFO.
func (q *InMemoryQueue) Enqueue(ctx context.Context, op *Operation) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	normalized, err := normalizeOperation(op)
	if err != nil {
		return err
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return ErrClosed
	}
	if _, exists := q.operations[normalized.ID]; exists {
		return fmt.Errorf("queue: operation %q already exists", normalized.ID)
	}

	q.operations[normalized.ID] = normalized
	q.agentQueue[normalized.AgentID] = append(q.agentQueue[normalized.AgentID], normalized.ID)
	return nil
}

// Dequeue returns the next pending operation for agentID and marks it running.
func (q *InMemoryQueue) Dequeue(ctx context.Context, agentID string) (*Operation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return nil, ErrClosed
	}

	now := time.Now().UTC()
	queueIDs := q.agentQueue[agentID]
	for len(queueIDs) > 0 {
		id := queueIDs[0]
		queueIDs = queueIDs[1:]
		q.agentQueue[agentID] = queueIDs

		op, ok := q.operations[id]
		if !ok {
			continue
		}
		if !op.ExpiresAt.IsZero() && !op.ExpiresAt.After(now) {
			delete(q.operations, id)
			continue
		}
		if op.Status != StatusPending {
			continue
		}

		op.Status = StatusRunning
		op.UpdatedAt = now
		if len(queueIDs) == 0 {
			delete(q.agentQueue, agentID)
		}
		return cloneOperation(op), nil
	}

	delete(q.agentQueue, agentID)
	return nil, ErrNotFound
}

// UpdateStatus updates the stored status and result for opID.
func (q *InMemoryQueue) UpdateStatus(ctx context.Context, opID string, status string, result []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return ErrClosed
	}

	op, ok := q.operations[opID]
	if !ok {
		return ErrNotFound
	}

	op.Status = status
	op.Result = cloneBytes(result)
	op.UpdatedAt = time.Now().UTC()
	return nil
}

// Get returns a copy of the operation with ID opID.
func (q *InMemoryQueue) Get(ctx context.Context, opID string) (*Operation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	q.mu.RLock()
	defer q.mu.RUnlock()

	if q.closed {
		return nil, ErrClosed
	}

	op, ok := q.operations[opID]
	if !ok {
		return nil, ErrNotFound
	}

	return cloneOperation(op), nil
}

// PruneExpired removes expired operations and returns the number removed.
func (q *InMemoryQueue) PruneExpired(ctx context.Context) (int, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return 0, ErrClosed
	}

	now := time.Now().UTC()
	removed := 0
	for id, op := range q.operations {
		if !op.ExpiresAt.IsZero() && !op.ExpiresAt.After(now) {
			delete(q.operations, id)
			removed++
		}
	}
	return removed, nil
}

// Close releases the queue.
func (q *InMemoryQueue) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.closed = true
	q.operations = map[string]*Operation{}
	q.agentQueue = map[string][]string{}
	return nil
}

func normalizeOperation(op *Operation) (*Operation, error) {
	if op == nil {
		return nil, errorsf("queue: operation is nil")
	}
	if op.ID == "" {
		return nil, errorsf("queue: operation ID is required")
	}
	if op.AgentID == "" {
		return nil, errorsf("queue: agent ID is required")
	}
	if op.AdapterName == "" {
		return nil, errorsf("queue: adapter name is required")
	}

	now := time.Now().UTC()
	normalized := &Operation{
		ID:          op.ID,
		AgentID:     op.AgentID,
		AdapterName: op.AdapterName,
		Params:      cloneBytes(op.Params),
		Status:      op.Status,
		Result:      cloneBytes(op.Result),
		CreatedAt:   op.CreatedAt.UTC(),
		UpdatedAt:   op.UpdatedAt.UTC(),
		ExpiresAt:   op.ExpiresAt.UTC(),
	}
	if normalized.Status == "" {
		normalized.Status = StatusPending
	}
	if normalized.CreatedAt.IsZero() {
		normalized.CreatedAt = now
	}
	if normalized.UpdatedAt.IsZero() {
		normalized.UpdatedAt = normalized.CreatedAt
	}
	return normalized, nil
}

func cloneOperation(op *Operation) *Operation {
	if op == nil {
		return nil
	}
	return &Operation{
		ID:          op.ID,
		AgentID:     op.AgentID,
		AdapterName: op.AdapterName,
		Params:      cloneBytes(op.Params),
		Status:      op.Status,
		Result:      cloneBytes(op.Result),
		CreatedAt:   op.CreatedAt,
		UpdatedAt:   op.UpdatedAt,
		ExpiresAt:   op.ExpiresAt,
	}
}

func cloneBytes(src []byte) []byte {
	if src == nil {
		return nil
	}
	dst := make([]byte, len(src))
	copy(dst, src)
	return dst
}

func errorsf(format string, args ...any) error {
	return fmt.Errorf(format, args...)
}
