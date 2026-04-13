package queue

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// SQLiteQueue provides crash-safe operation persistence for single-instance
// gateway deployments.
type SQLiteQueue struct {
	db                     *sql.DB
	insertStmt             *sql.Stmt
	dequeueSelectStmt      *sql.Stmt
	dequeueMarkRunningStmt *sql.Stmt
	updateStmt             *sql.Stmt
	getStmt                *sql.Stmt
	pruneStmt              *sql.Stmt
}

// Open opens or creates a SQLite-backed queue at path.
func Open(path string) (*SQLiteQueue, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("queue: open sqlite: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if _, err := db.Exec(`
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS operations (
	id TEXT PRIMARY KEY,
	agent_id TEXT NOT NULL,
	adapter_name TEXT NOT NULL,
	params BLOB,
	status TEXT NOT NULL,
	result BLOB,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	expires_at TEXT NOT NULL
);`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("queue: initialize sqlite schema: %w", err)
	}

	q := &SQLiteQueue{db: db}
	if err := q.prepareStatements(); err != nil {
		_ = q.Close()
		return nil, err
	}
	return q, nil
}

// Enqueue durably persists op inside a transaction before returning.
func (q *SQLiteQueue) Enqueue(ctx context.Context, op *Operation) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	normalized, err := normalizeOperation(op)
	if err != nil {
		return err
	}

	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("queue: begin enqueue tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	stmt := tx.StmtContext(ctx, q.insertStmt)
	defer stmt.Close()

	if _, err := stmt.ExecContext(
		ctx,
		normalized.ID,
		normalized.AgentID,
		normalized.AdapterName,
		normalized.Params,
		normalized.Status,
		normalized.Result,
		timeText(normalized.CreatedAt),
		timeText(normalized.UpdatedAt),
		timeText(normalized.ExpiresAt),
	); err != nil {
		return fmt.Errorf("queue: enqueue %q: %w", normalized.ID, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("queue: commit enqueue %q: %w", normalized.ID, err)
	}
	return nil
}

// Dequeue returns the next pending operation for agentID in FIFO order and
// marks it running as part of the dequeue transaction.
func (q *SQLiteQueue) Dequeue(ctx context.Context, agentID string) (*Operation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("queue: begin dequeue tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	selectStmt := tx.StmtContext(ctx, q.dequeueSelectStmt)
	defer selectStmt.Close()

	row := selectStmt.QueryRowContext(ctx, agentID, StatusPending, timeText(time.Now().UTC()))
	op, err := scanOperation(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("queue: dequeue select: %w", err)
	}

	now := time.Now().UTC()
	updateStmt := tx.StmtContext(ctx, q.dequeueMarkRunningStmt)
	defer updateStmt.Close()

	res, err := updateStmt.ExecContext(ctx, StatusRunning, timeText(now), op.ID, StatusPending)
	if err != nil {
		return nil, fmt.Errorf("queue: mark running %q: %w", op.ID, err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("queue: read dequeue rows affected: %w", err)
	}
	if rows == 0 {
		return nil, ErrNotFound
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("queue: commit dequeue %q: %w", op.ID, err)
	}

	op.Status = StatusRunning
	op.UpdatedAt = now
	return op, nil
}

// UpdateStatus updates the operation status and result bytes.
func (q *SQLiteQueue) UpdateStatus(ctx context.Context, opID string, status string, result []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	res, err := q.updateStmt.ExecContext(ctx, status, cloneBytes(result), timeText(time.Now().UTC()), opID)
	if err != nil {
		return fmt.Errorf("queue: update status %q: %w", opID, err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("queue: read update rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// Get retrieves an operation by ID.
func (q *SQLiteQueue) Get(ctx context.Context, opID string) (*Operation, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	row := q.getStmt.QueryRowContext(ctx, opID)
	op, err := scanOperation(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("queue: get %q: %w", opID, err)
	}
	return op, nil
}

// PruneExpired deletes operations whose ExpiresAt is in the past.
func (q *SQLiteQueue) PruneExpired(ctx context.Context) (int, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}

	res, err := q.pruneStmt.ExecContext(ctx, timeText(time.Now().UTC()))
	if err != nil {
		return 0, fmt.Errorf("queue: prune expired: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("queue: read prune rows affected: %w", err)
	}
	return int(rows), nil
}

// Close closes prepared statements and the backing database connection.
func (q *SQLiteQueue) Close() error {
	var firstErr error
	closeOne := func(err error) {
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	if q.insertStmt != nil {
		closeOne(q.insertStmt.Close())
	}
	if q.dequeueSelectStmt != nil {
		closeOne(q.dequeueSelectStmt.Close())
	}
	if q.dequeueMarkRunningStmt != nil {
		closeOne(q.dequeueMarkRunningStmt.Close())
	}
	if q.updateStmt != nil {
		closeOne(q.updateStmt.Close())
	}
	if q.getStmt != nil {
		closeOne(q.getStmt.Close())
	}
	if q.pruneStmt != nil {
		closeOne(q.pruneStmt.Close())
	}
	if q.db != nil {
		closeOne(q.db.Close())
	}
	return firstErr
}

func (q *SQLiteQueue) prepareStatements() error {
	var err error

	q.insertStmt, err = q.db.Prepare(`
INSERT INTO operations (
	id, agent_id, adapter_name, params, status, result, created_at, updated_at, expires_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
	if err != nil {
		return fmt.Errorf("queue: prepare insert: %w", err)
	}

	q.dequeueSelectStmt, err = q.db.Prepare(`
SELECT id, agent_id, adapter_name, params, status, result, created_at, updated_at, expires_at
FROM operations
WHERE agent_id = ? AND status = ? AND (expires_at = '0001-01-01T00:00:00Z' OR expires_at > ?)
ORDER BY created_at ASC, id ASC
LIMIT 1
`)
	if err != nil {
		return fmt.Errorf("queue: prepare dequeue select: %w", err)
	}

	q.dequeueMarkRunningStmt, err = q.db.Prepare(`
UPDATE operations
SET status = ?, updated_at = ?
WHERE id = ? AND status = ?
`)
	if err != nil {
		return fmt.Errorf("queue: prepare dequeue update: %w", err)
	}

	q.updateStmt, err = q.db.Prepare(`
UPDATE operations
SET status = ?, result = ?, updated_at = ?
WHERE id = ?
`)
	if err != nil {
		return fmt.Errorf("queue: prepare update: %w", err)
	}

	q.getStmt, err = q.db.Prepare(`
SELECT id, agent_id, adapter_name, params, status, result, created_at, updated_at, expires_at
FROM operations
WHERE id = ?
`)
	if err != nil {
		return fmt.Errorf("queue: prepare get: %w", err)
	}

	q.pruneStmt, err = q.db.Prepare(`
DELETE FROM operations
WHERE expires_at <= ?
`)
	if err != nil {
		return fmt.Errorf("queue: prepare prune: %w", err)
	}

	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanOperation(scanner rowScanner) (*Operation, error) {
	var (
		op                   Operation
		params               []byte
		result               []byte
		createdAtText        string
		updatedAtText        string
		expiresAtText        string
	)

	if err := scanner.Scan(
		&op.ID,
		&op.AgentID,
		&op.AdapterName,
		&params,
		&op.Status,
		&result,
		&createdAtText,
		&updatedAtText,
		&expiresAtText,
	); err != nil {
		return nil, err
	}

	createdAt, err := parseTime(createdAtText)
	if err != nil {
		return nil, fmt.Errorf("queue: parse created_at: %w", err)
	}
	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return nil, fmt.Errorf("queue: parse updated_at: %w", err)
	}
	expiresAt, err := parseTime(expiresAtText)
	if err != nil {
		return nil, fmt.Errorf("queue: parse expires_at: %w", err)
	}

	op.Params = cloneBytes(params)
	op.Result = cloneBytes(result)
	op.CreatedAt = createdAt
	op.UpdatedAt = updatedAt
	op.ExpiresAt = expiresAt

	return &op, nil
}

func timeText(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

func parseTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, value)
}
