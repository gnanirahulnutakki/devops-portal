package queue

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestEnqueueAndGet(t *testing.T) {
	for _, impl := range testImplementations(t) {
		t.Run(impl.name, func(t *testing.T) {
			q := impl.new(t)
			defer func() { _ = q.Close() }()

			now := time.Now().UTC()
			op := &Operation{
				ID:          "op-1",
				AgentID:     "agent-a",
				AdapterName: "adapter-a",
				Params:      []byte(`{"hello":"world"}`),
				Status:      StatusPending,
				CreatedAt:   now,
				UpdatedAt:   now,
				ExpiresAt:   now.Add(5 * time.Minute),
			}

			if err := q.Enqueue(context.Background(), op); err != nil {
				t.Fatalf("enqueue: %v", err)
			}

			got, err := q.Get(context.Background(), op.ID)
			if err != nil {
				t.Fatalf("get: %v", err)
			}
			if got.ID != op.ID {
				t.Fatalf("expected id %q, got %q", op.ID, got.ID)
			}
			if got.AgentID != op.AgentID {
				t.Fatalf("expected agent_id %q, got %q", op.AgentID, got.AgentID)
			}
			if got.AdapterName != op.AdapterName {
				t.Fatalf("expected adapter_name %q, got %q", op.AdapterName, got.AdapterName)
			}
			if string(got.Params) != string(op.Params) {
				t.Fatalf("expected params %q, got %q", string(op.Params), string(got.Params))
			}
			if got.Status != op.Status {
				t.Fatalf("expected status %q, got %q", op.Status, got.Status)
			}
		})
	}
}

func TestDequeue(t *testing.T) {
	for _, impl := range testImplementations(t) {
		t.Run(impl.name, func(t *testing.T) {
			q := impl.new(t)
			defer func() { _ = q.Close() }()

			now := time.Now().UTC()
			op1 := &Operation{
				ID:          "op-1",
				AgentID:     "agent-a",
				AdapterName: "adapter-a",
				Params:      []byte(`{"seq":1}`),
				Status:      StatusPending,
				CreatedAt:   now,
				UpdatedAt:   now,
				ExpiresAt:   now.Add(5 * time.Minute),
			}
			op2 := &Operation{
				ID:          "op-2",
				AgentID:     "agent-a",
				AdapterName: "adapter-a",
				Params:      []byte(`{"seq":2}`),
				Status:      StatusPending,
				CreatedAt:   now.Add(time.Second),
				UpdatedAt:   now.Add(time.Second),
				ExpiresAt:   now.Add(5 * time.Minute),
			}

			if err := q.Enqueue(context.Background(), op1); err != nil {
				t.Fatalf("enqueue op1: %v", err)
			}
			if err := q.Enqueue(context.Background(), op2); err != nil {
				t.Fatalf("enqueue op2: %v", err)
			}

			first, err := q.Dequeue(context.Background(), "agent-a")
			if err != nil {
				t.Fatalf("dequeue first: %v", err)
			}
			if first.ID != op1.ID {
				t.Fatalf("expected first dequeue %q, got %q", op1.ID, first.ID)
			}
			if first.Status != StatusRunning {
				t.Fatalf("expected first status %q, got %q", StatusRunning, first.Status)
			}

			second, err := q.Dequeue(context.Background(), "agent-a")
			if err != nil {
				t.Fatalf("dequeue second: %v", err)
			}
			if second.ID != op2.ID {
				t.Fatalf("expected second dequeue %q, got %q", op2.ID, second.ID)
			}
			if second.Status != StatusRunning {
				t.Fatalf("expected second status %q, got %q", StatusRunning, second.Status)
			}
		})
	}
}

func TestUpdateStatus(t *testing.T) {
	for _, impl := range testImplementations(t) {
		t.Run(impl.name, func(t *testing.T) {
			q := impl.new(t)
			defer func() { _ = q.Close() }()

			now := time.Now().UTC()
			op := &Operation{
				ID:          "op-1",
				AgentID:     "agent-a",
				AdapterName: "adapter-a",
				Params:      []byte(`{}`),
				Status:      StatusPending,
				CreatedAt:   now,
				UpdatedAt:   now,
				ExpiresAt:   now.Add(5 * time.Minute),
			}

			if err := q.Enqueue(context.Background(), op); err != nil {
				t.Fatalf("enqueue: %v", err)
			}
			if err := q.UpdateStatus(context.Background(), op.ID, StatusSucceeded, []byte(`{"ok":true}`)); err != nil {
				t.Fatalf("update status: %v", err)
			}

			got, err := q.Get(context.Background(), op.ID)
			if err != nil {
				t.Fatalf("get: %v", err)
			}
			if got.Status != StatusSucceeded {
				t.Fatalf("expected status %q, got %q", StatusSucceeded, got.Status)
			}
			if string(got.Result) != `{"ok":true}` {
				t.Fatalf("expected result bytes to round-trip, got %q", string(got.Result))
			}
		})
	}
}

func TestPruneExpired(t *testing.T) {
	for _, impl := range testImplementations(t) {
		t.Run(impl.name, func(t *testing.T) {
			q := impl.new(t)
			defer func() { _ = q.Close() }()

			now := time.Now().UTC()
			op := &Operation{
				ID:          "op-expired",
				AgentID:     "agent-a",
				AdapterName: "adapter-a",
				Params:      []byte(`{}`),
				Status:      StatusPending,
				CreatedAt:   now.Add(-10 * time.Minute),
				UpdatedAt:   now.Add(-10 * time.Minute),
				ExpiresAt:   now.Add(-time.Minute),
			}

			if err := q.Enqueue(context.Background(), op); err != nil {
				t.Fatalf("enqueue: %v", err)
			}

			pruned, err := q.PruneExpired(context.Background())
			if err != nil {
				t.Fatalf("prune expired: %v", err)
			}
			if pruned != 1 {
				t.Fatalf("expected 1 pruned record, got %d", pruned)
			}

			if _, err := q.Get(context.Background(), op.ID); !errors.Is(err, ErrNotFound) {
				t.Fatalf("expected ErrNotFound after prune, got %v", err)
			}
		})
	}
}

func TestGetNotFound(t *testing.T) {
	for _, impl := range testImplementations(t) {
		t.Run(impl.name, func(t *testing.T) {
			q := impl.new(t)
			defer func() { _ = q.Close() }()

			_, err := q.Get(context.Background(), "does-not-exist")
			if !errors.Is(err, ErrNotFound) {
				t.Fatalf("expected ErrNotFound, got %v", err)
			}
		})
	}
}

type queueImplementation struct {
	name string
	new  func(t *testing.T) DurableQueue
}

func testImplementations(t *testing.T) []queueImplementation {
	t.Helper()

	return []queueImplementation{
		{
			name: "InMemory",
			new: func(t *testing.T) DurableQueue {
				t.Helper()
				return NewInMemoryQueue()
			},
		},
		{
			name: "SQLite",
			new: func(t *testing.T) DurableQueue {
				t.Helper()
				path := filepath.Join(t.TempDir(), "queue.db")
				q, err := Open(path)
				if err != nil {
					t.Fatalf("open sqlite queue: %v", err)
				}
				return q
			},
		},
	}
}
