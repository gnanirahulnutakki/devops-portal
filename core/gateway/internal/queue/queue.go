package queue

import (
	"context"
	"errors"
	"time"
)

const (
	// StatusPending indicates an operation has been durably accepted but not yet
	// handed to an agent for execution.
	StatusPending = "pending"

	// StatusRunning indicates an operation has been dequeued by an agent and is
	// in active execution.
	StatusRunning = "running"

	// StatusSucceeded indicates an operation completed successfully.
	StatusSucceeded = "succeeded"

	// StatusFailed indicates an operation completed with a terminal error.
	StatusFailed = "failed"

	// StatusCancelled indicates an operation was cooperatively cancelled.
	StatusCancelled = "cancelled"

	// StatusUnknown indicates an operation reached a terminal unknown outcome.
	StatusUnknown = "unknown"
)

var (
	// ErrNotFound is returned when the requested operation does not exist.
	ErrNotFound = errors.New("queue: operation not found")

	// ErrClosed is returned when the queue has already been closed.
	ErrClosed = errors.New("queue: queue closed")
)

// Operation is the durable record for a single gateway operation.
//
// Params and Result hold serialized payload bytes so the queue package does not
// depend on higher-level protocol types.
type Operation struct {
	ID          string
	AgentID     string
	AdapterName string
	Params      []byte
	Status      string
	Result      []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ExpiresAt   time.Time
}

// DurableQueue is the persistence contract the gateway uses for operation
// durability.
//
// Implementations must not return from Enqueue until the operation is durably
// committed. Dequeue returns the next pending operation for a given agent and
// marks it as running as part of the dequeue action.
type DurableQueue interface {
	// Enqueue durably persists op before returning.
	Enqueue(ctx context.Context, op *Operation) error

	// Dequeue returns the next pending operation for agentID in FIFO order and
	// marks it as running.
	Dequeue(ctx context.Context, agentID string) (*Operation, error)

	// UpdateStatus updates the status and optional result payload for opID.
	UpdateStatus(ctx context.Context, opID string, status string, result []byte) error

	// Get retrieves an operation by ID.
	Get(ctx context.Context, opID string) (*Operation, error)

	// PruneExpired removes operations whose ExpiresAt has passed and returns the
	// number of pruned records.
	PruneExpired(ctx context.Context) (int, error)

	// Close releases any resources held by the queue.
	Close() error
}
