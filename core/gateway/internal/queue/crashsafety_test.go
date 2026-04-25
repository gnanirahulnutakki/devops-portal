package queue

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	crashChildEnv        = "Q_CRASH_TEST_CHILD"
	crashDBEnv           = "Q_CRASH_TEST_DB"
	crashWorkloadEnv     = "Q_CRASH_TEST_WORKLOAD"
	crashEnqueueOpsEnv   = "Q_CRASH_TEST_ENQUEUE_OPS"
	crashDequeueOpsEnv   = "Q_CRASH_TEST_DEQUEUE_OPS"
	crashPayloadBytesEnv = "Q_CRASH_TEST_PAYLOAD_BYTES"
	crashReadyAfterEnv   = "Q_CRASH_TEST_READY_AFTER"

	crashAgentID       = "agent-crash-safety"
	crashAdapterName   = "adapter-crash-safety"
	crashPayloadMarker = "queue-crash-safety-payload-v1"
)

func TestMain(m *testing.M) {
	if os.Getenv(crashChildEnv) == "1" {
		runCrashChild()
		return
	}

	os.Exit(m.Run())
}

func TestCrashSafety_NoLostAccepts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping SQLite crash-safety integration test in short mode")
	}

	dbPath := newCrashTestDB(t, "no-lost-accepts")
	const enqueueOps = 10

	child, ready := startCrashChild(t, dbPath, map[string]string{
		crashWorkloadEnv:   "no_lost_accepts",
		crashEnqueueOpsEnv: strconv.Itoa(enqueueOps),
	})
	t.Log(ready)

	child.kill(t)

	q := openSQLiteQueueForTest(t, dbPath)
	defer closeSQLiteQueueForTest(t, q)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for i := 0; i < enqueueOps; i++ {
		id := operationID("accept", i)

		op, err := q.Get(ctx, id)
		if err != nil {
			t.Errorf("Get(%q) after SIGKILL returned error: %v", id, err)
			continue
		}
		if op == nil {
			t.Errorf("Get(%q) after SIGKILL returned nil operation", id)
			continue
		}
		if op.Status != StatusPending {
			t.Errorf("operation %q status after restart = %q, want %q", id, op.Status, StatusPending)
		}
		if err := validateCrashPayload(op.ID, op.Params); err != nil {
			t.Errorf("operation %q has invalid params after restart: %v", id, err)
		}
	}
}

func TestCrashSafety_NoDoubleDispatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping SQLite crash-safety integration test in short mode")
	}

	dbPath := newCrashTestDB(t, "no-double-dispatch")
	const enqueueOps = 5
	const dequeueOps = 3

	child, ready := startCrashChild(t, dbPath, map[string]string{
		crashWorkloadEnv:   "double_dispatch",
		crashEnqueueOpsEnv: strconv.Itoa(enqueueOps),
		crashDequeueOpsEnv: strconv.Itoa(dequeueOps),
	})
	t.Log(ready)

	runningIDs := parseReadyList(t, ready, "running")
	if len(runningIDs) != dequeueOps {
		t.Fatalf("child reported %d running operations, want %d: %q", len(runningIDs), dequeueOps, ready)
	}

	child.kill(t)

	q := openSQLiteQueueForTest(t, dbPath)
	defer closeSQLiteQueueForTest(t, q)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dequeued := dequeueAvailable(t, ctx, q, crashAgentID, enqueueOps+1)
	if got, want := len(dequeued), enqueueOps-dequeueOps; got != want {
		t.Errorf("Dequeue after restart returned %d operations, want %d pending operations", got, want)
	}

	running := make(map[string]bool, len(runningIDs))
	for _, id := range runningIDs {
		running[id] = true
	}

	seen := make(map[string]bool, len(dequeued))
	for _, op := range dequeued {
		if op == nil {
			t.Errorf("Dequeue after restart returned nil operation")
			continue
		}
		if seen[op.ID] {
			t.Errorf("Dequeue after restart returned duplicate operation %q", op.ID)
		}
		seen[op.ID] = true

		if running[op.ID] {
			t.Errorf("operation %q was already running before SIGKILL and was dispatched again after restart", op.ID)
		}
	}
}

func TestCrashSafety_NoPartialWrites(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping SQLite crash-safety integration test in short mode")
	}

	dbPath := newCrashTestDB(t, "no-partial-writes")

	child, ready := startCrashChild(t, dbPath, map[string]string{
		crashWorkloadEnv:     "partial_writes",
		crashEnqueueOpsEnv:   "5000",
		crashPayloadBytesEnv: "4096",
		crashReadyAfterEnv:   "5",
	})
	t.Log(ready)

	time.Sleep(50 * time.Millisecond)
	child.kill(t)

	q := openSQLiteQueueForTest(t, dbPath)
	closeSQLiteQueueForTest(t, q)

	rows := readQueueRows(t, dbPath)
	if len(rows) < 5 {
		t.Fatalf("only %d rows were committed before SIGKILL, want at least 5; inspect retained DB at %s", len(rows), dbPath)
	}

	validateRawQueueRows(t, rows)
}

func TestCrashSafety_RecoveryAfterCrashedTransaction(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping SQLite crash-safety integration test in short mode")
	}

	dbPath := newCrashTestDB(t, "crashed-transaction")

	child, ready := startCrashChild(t, dbPath, map[string]string{
		crashWorkloadEnv:     "crashed_transaction",
		crashEnqueueOpsEnv:   "10000",
		crashPayloadBytesEnv: "16384",
		crashReadyAfterEnv:   "5",
	})
	t.Log(ready)

	time.Sleep(50 * time.Millisecond)
	child.kill(t)

	checkpoint := checkpointSQLite(t, dbPath)
	if checkpoint.busy != 0 {
		t.Errorf("PRAGMA wal_checkpoint(TRUNCATE) reported busy=%d, want 0", checkpoint.busy)
	}
	t.Logf("WAL checkpoint result: busy=%d log=%d checkpointed=%d", checkpoint.busy, checkpoint.log, checkpoint.checkpointed)

	integrityCheckSQLite(t, dbPath)

	count := countQueueRows(t, dbPath)
	rows := readQueueRows(t, dbPath)
	if count != len(rows) {
		t.Errorf("sqlite COUNT(*) = %d, but row iteration returned %d rows", count, len(rows))
	}
	if count < 5 {
		t.Fatalf("only %d rows were committed before SIGKILL, want at least 5; inspect retained DB at %s", count, dbPath)
	}

	validateRawQueueRows(t, rows)

	q := openSQLiteQueueForTest(t, dbPath)
	defer closeSQLiteQueueForTest(t, q)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	probe := makeTestOperation("restart-probe", 0, 1024)
	if err := q.Enqueue(ctx, probe); err != nil {
		t.Fatalf("Enqueue after WAL recovery failed: %v", err)
	}
	got, err := q.Get(ctx, probe.ID)
	if err != nil {
		t.Fatalf("Get(%q) after WAL recovery failed: %v", probe.ID, err)
	}
	if got == nil {
		t.Fatalf("Get(%q) after WAL recovery returned nil operation", probe.ID)
	}
	if got.Status != StatusPending {
		t.Errorf("restart probe status = %q, want %q", got.Status, StatusPending)
	}
}

func runCrashChild() {
	if err := runCrashChildE(); err != nil {
		fmt.Fprintf(os.Stderr, "CHILD_ERROR: %v\n", err)
		_ = os.Stderr.Sync()
		os.Exit(2)
	}
}

func runCrashChildE() error {
	dbPath := os.Getenv(crashDBEnv)
	if dbPath == "" {
		return fmt.Errorf("%s is required", crashDBEnv)
	}

	workload := os.Getenv(crashWorkloadEnv)
	if workload == "" {
		return fmt.Errorf("%s is required", crashWorkloadEnv)
	}

	q, err := Open(dbPath)
	if err != nil {
		return fmt.Errorf("open sqlite queue: %w", err)
	}
	defer func() {
		_ = q.Close()
	}()

	ctx := context.Background()

	switch workload {
	case "no_lost_accepts":
		n, err := childIntEnv(crashEnqueueOpsEnv, 10)
		if err != nil {
			return err
		}
		for i := 0; i < n; i++ {
			if err := q.Enqueue(ctx, makeTestOperation("accept", i, 1024)); err != nil {
				return fmt.Errorf("enqueue accept op %d: %w", i, err)
			}
		}
		childReady("workload=no_lost_accepts enqueued=%d", n)
		time.Sleep(time.Hour)
		return nil

	case "double_dispatch":
		enqueueOps, err := childIntEnv(crashEnqueueOpsEnv, 5)
		if err != nil {
			return err
		}
		dequeueOps, err := childIntEnv(crashDequeueOpsEnv, 3)
		if err != nil {
			return err
		}
		if dequeueOps > enqueueOps {
			return fmt.Errorf("dequeue ops %d exceeds enqueue ops %d", dequeueOps, enqueueOps)
		}

		for i := 0; i < enqueueOps; i++ {
			if err := q.Enqueue(ctx, makeTestOperation("dispatch", i, 1024)); err != nil {
				return fmt.Errorf("enqueue dispatch op %d: %w", i, err)
			}
		}

		runningIDs := make([]string, 0, dequeueOps)
		for i := 0; i < dequeueOps; i++ {
			op, err := q.Dequeue(ctx, crashAgentID)
			if err != nil {
				return fmt.Errorf("dequeue dispatch op %d: %w", i, err)
			}
			if op == nil {
				return fmt.Errorf("dequeue dispatch op %d returned nil", i)
			}
			runningIDs = append(runningIDs, op.ID)
		}

		childReady(
			"workload=double_dispatch enqueued=%d dequeued=%d running=%s",
			enqueueOps,
			dequeueOps,
			strings.Join(runningIDs, ","),
		)
		time.Sleep(time.Hour)
		return nil

	case "partial_writes":
		return runLoopingEnqueueWorkload(ctx, q, "partial", "partial_writes")

	case "crashed_transaction":
		return runLoopingEnqueueWorkload(ctx, q, "txn", "crashed_transaction")

	default:
		return fmt.Errorf("unknown workload %q", workload)
	}
}

func runLoopingEnqueueWorkload(ctx context.Context, q DurableQueue, prefix, workload string) error {
	n, err := childIntEnv(crashEnqueueOpsEnv, 5000)
	if err != nil {
		return err
	}
	payloadBytes, err := childIntEnv(crashPayloadBytesEnv, 4096)
	if err != nil {
		return err
	}
	readyAfter, err := childIntEnv(crashReadyAfterEnv, 5)
	if err != nil {
		return err
	}
	if readyAfter <= 0 {
		return fmt.Errorf("%s must be positive", crashReadyAfterEnv)
	}

	readyPrinted := false
	for i := 0; i < n; i++ {
		if err := q.Enqueue(ctx, makeTestOperation(prefix, i, payloadBytes)); err != nil {
			return fmt.Errorf("enqueue %s op %d: %w", workload, i, err)
		}
		if !readyPrinted && i+1 >= readyAfter {
			childReady(
				"workload=%s committed_before_ready=%d max_enqueues=%d payload_bytes=%d",
				workload,
				i+1,
				n,
				payloadBytes,
			)
			readyPrinted = true
		}
	}

	if !readyPrinted {
		childReady(
			"workload=%s committed_before_ready=%d max_enqueues=%d payload_bytes=%d completed=true",
			workload,
			n,
			n,
			payloadBytes,
		)
	}

	time.Sleep(time.Hour)
	return nil
}

func childReady(format string, args ...interface{}) {
	fmt.Fprintf(os.Stdout, "CHILD_READY: "+format+"\n", args...)
	_ = os.Stdout.Sync()
}

func childIntEnv(name string, fallback int) (int, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback, nil
	}

	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s=%q is not an integer: %w", name, raw, err)
	}
	if n < 0 {
		return 0, fmt.Errorf("%s=%d must be non-negative", name, n)
	}
	return n, nil
}

type crashChild struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	stderr *bytes.Buffer
	done   chan error

	mu      sync.Mutex
	waited  bool
	waitErr error
}

func startCrashChild(t *testing.T, dbPath string, vars map[string]string) (*crashChild, string) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^$")
	cmd.Env = makeCrashChildEnv(dbPath, vars)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		t.Fatalf("create child stdout pipe: %v", err)
	}

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		cancel()
		t.Fatalf("start crash child: %v", err)
	}

	child := &crashChild{
		cmd:    cmd,
		cancel: cancel,
		stderr: &stderr,
		done:   make(chan error, 1),
	}

	go func() {
		child.done <- cmd.Wait()
	}()

	readyCh := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "CHILD_READY:") {
				select {
				case readyCh <- line:
				default:
				}
			}
		}
	}()

	t.Cleanup(func() {
		child.killIfRunning()
	})

	select {
	case ready := <-readyCh:
		return child, ready

	case err := <-child.done:
		child.markWaited(err)
		t.Fatalf("crash child exited before READY: err=%v stderr=%s", err, child.stderr.String())

	case <-time.After(10 * time.Second):
		child.killIfRunning()
		t.Fatalf("timed out waiting for crash child READY; stderr=%s", child.stderr.String())
	}

	panic("unreachable")
}

func (c *crashChild) kill(t *testing.T) {
	t.Helper()

	if c.hasExited() {
		t.Fatalf("crash child exited before SIGKILL: err=%v stderr=%s", c.cachedWaitErr(), c.stderr.String())
	}

	if err := c.cmd.Process.Kill(); err != nil && !c.hasExited() {
		t.Fatalf("SIGKILL crash child: %v stderr=%s", err, c.stderr.String())
	}

	err, ok := c.wait(5 * time.Second)
	if !ok {
		t.Fatalf("timed out waiting for SIGKILLed child to exit; stderr=%s", c.stderr.String())
	}
	if err == nil {
		t.Fatalf("crash child exited cleanly after SIGKILL; expected killed process")
	}
}

func (c *crashChild) killIfRunning() {
	if c.hasExited() {
		return
	}

	c.cancel()
	_, _ = c.wait(5 * time.Second)
}

func (c *crashChild) wait(timeout time.Duration) (error, bool) {
	c.mu.Lock()
	if c.waited {
		err := c.waitErr
		c.mu.Unlock()
		return err, true
	}
	c.mu.Unlock()

	select {
	case err := <-c.done:
		c.markWaited(err)
		return c.cachedWaitErr(), true

	case <-time.After(timeout):
		return nil, false
	}
}

func (c *crashChild) markWaited(err error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.waited {
		return
	}
	c.waited = true
	c.waitErr = err
}

func (c *crashChild) hasExited() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.waited {
		return true
	}
	return c.cmd.ProcessState != nil && c.cmd.ProcessState.Exited()
}

func (c *crashChild) cachedWaitErr() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.waitErr
}

func makeCrashChildEnv(dbPath string, vars map[string]string) []string {
	env := make([]string, 0, len(os.Environ())+len(vars)+2)
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "Q_CRASH_TEST_") {
			continue
		}
		env = append(env, kv)
	}

	env = append(env,
		crashChildEnv+"=1",
		crashDBEnv+"="+dbPath,
	)

	for key, value := range vars {
		env = append(env, key+"="+value)
	}

	return env
}

func newCrashTestDB(t *testing.T, name string) string {
	t.Helper()

	dir, err := os.MkdirTemp("", "queue-crash-"+name+"-")
	if err != nil {
		t.Fatalf("create temp dir for crash test: %v", err)
	}

	dbPath := filepath.Join(dir, "queue.db")
	t.Cleanup(func() {
		if t.Failed() {
			t.Logf("crash-safety SQLite database retained for inspection: %s", dbPath)
			return
		}
		if err := os.RemoveAll(dir); err != nil {
			t.Errorf("remove temp dir %q: %v", dir, err)
		}
	})

	return dbPath
}

func openSQLiteQueueForTest(t *testing.T, dbPath string) *SQLiteQueue {
	t.Helper()

	q, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open SQLite queue %q: %v", dbPath, err)
	}
	return q
}

func closeSQLiteQueueForTest(t *testing.T, q *SQLiteQueue) {
	t.Helper()

	if err := q.Close(); err != nil {
		t.Errorf("close SQLite queue: %v", err)
	}
}

func dequeueAvailable(t *testing.T, ctx context.Context, q DurableQueue, agentID string, max int) []*Operation {
	t.Helper()

	var out []*Operation
	for i := 0; i < max; i++ {
		op, err := q.Dequeue(ctx, agentID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return out
			}
			t.Fatalf("Dequeue(%q) after restart failed at attempt %d: %v", agentID, i+1, err)
		}
		if op == nil {
			return out
		}
		out = append(out, op)
	}

	return out
}

func parseReadyList(t *testing.T, readyLine, key string) []string {
	t.Helper()

	for _, field := range strings.Fields(readyLine) {
		value, ok := strings.CutPrefix(field, key+"=")
		if !ok {
			continue
		}
		if value == "" {
			return nil
		}
		return strings.Split(value, ",")
	}

	t.Fatalf("READY line %q does not contain %s=", readyLine, key)
	return nil
}

type crashPayload struct {
	Marker string `json:"marker"`
	Prefix string `json:"prefix"`
	Index  int    `json:"index"`
	Pad    string `json:"pad"`
	SHA256 string `json:"sha256"`
}

func makeTestOperation(prefix string, index int, payloadBytes int) *Operation {
	now := time.Now().UTC()

	return &Operation{
		ID:          operationID(prefix, index),
		AgentID:     crashAgentID,
		AdapterName: crashAdapterName,
		Params:      makeCrashPayload(prefix, index, payloadBytes),
		Status:      StatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
		ExpiresAt:   now.Add(time.Hour),
	}
}

func operationID(prefix string, index int) string {
	return fmt.Sprintf("%s-%06d", prefix, index)
}

func makeCrashPayload(prefix string, index int, payloadBytes int) []byte {
	if payloadBytes < 0 {
		payloadBytes = 0
	}

	seed := fmt.Sprintf("%s:%06d:", prefix, index)
	var pad strings.Builder
	for pad.Len() < payloadBytes {
		pad.WriteString(seed)
	}

	padText := pad.String()
	if len(padText) > payloadBytes {
		padText = padText[:payloadBytes]
	}

	payload := crashPayload{
		Marker: crashPayloadMarker,
		Prefix: prefix,
		Index:  index,
		Pad:    padText,
	}
	payload.SHA256 = payloadChecksum(payload.Marker, payload.Prefix, payload.Index, payload.Pad)

	out, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return out
}

func validateCrashPayload(id string, raw []byte) error {
	if len(raw) == 0 {
		return fmt.Errorf("empty params")
	}

	var payload crashPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return fmt.Errorf("params JSON did not parse: %w", err)
	}

	if payload.Marker != crashPayloadMarker {
		return fmt.Errorf("marker = %q, want %q", payload.Marker, crashPayloadMarker)
	}

	prefix, index, err := parseOperationID(id)
	if err != nil {
		return err
	}
	if payload.Prefix != prefix {
		return fmt.Errorf("payload prefix = %q, want %q from id %q", payload.Prefix, prefix, id)
	}
	if payload.Index != index {
		return fmt.Errorf("payload index = %d, want %d from id %q", payload.Index, index, id)
	}

	wantChecksum := payloadChecksum(payload.Marker, payload.Prefix, payload.Index, payload.Pad)
	if payload.SHA256 != wantChecksum {
		return fmt.Errorf("payload checksum = %q, want %q", payload.SHA256, wantChecksum)
	}

	return nil
}

func parseOperationID(id string) (string, int, error) {
	pos := strings.LastIndex(id, "-")
	if pos <= 0 || pos == len(id)-1 {
		return "", 0, fmt.Errorf("operation id %q does not match <prefix>-<index>", id)
	}

	index, err := strconv.Atoi(id[pos+1:])
	if err != nil {
		return "", 0, fmt.Errorf("operation id %q has invalid numeric suffix: %w", id, err)
	}

	return id[:pos], index, nil
}

func payloadChecksum(marker string, prefix string, index int, pad string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(marker))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(prefix))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(strconv.Itoa(index)))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(pad))
	return hex.EncodeToString(h.Sum(nil))
}

type rawQueueRow struct {
	ID        string
	Status    string
	HasStatus bool
	Params    []byte
}

func validateRawQueueRows(t *testing.T, rows []rawQueueRow) {
	t.Helper()

	for _, row := range rows {
		if row.ID == "" {
			t.Errorf("raw queue row has empty id")
			continue
		}
		if !row.HasStatus {
			t.Errorf("raw queue row %q has NULL status", row.ID)
			continue
		}
		if row.Status != StatusPending {
			t.Errorf("raw queue row %q status = %q, want %q", row.ID, row.Status, StatusPending)
		}
		if row.Params == nil {
			t.Errorf("raw queue row %q has NULL params", row.ID)
			continue
		}
		if err := validateCrashPayload(row.ID, row.Params); err != nil {
			t.Errorf("raw queue row %q has invalid params: %v", row.ID, err)
		}
	}
}

func readQueueRows(t *testing.T, dbPath string) []rawQueueRow {
	t.Helper()

	db := openRawSQLite(t, dbPath)
	defer func() {
		if err := db.Close(); err != nil {
			t.Errorf("close raw sqlite db: %v", err)
		}
	}()

	table := findQueueTable(t, db)
	query := fmt.Sprintf("SELECT id, status, params FROM %s ORDER BY id", quoteSQLiteIdent(table))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sqlRows, err := db.QueryContext(ctx, query)
	if err != nil {
		t.Fatalf("query raw queue rows from %s: %v", table, err)
	}
	defer func() {
		if err := sqlRows.Close(); err != nil {
			t.Errorf("close raw queue rows: %v", err)
		}
	}()

	var out []rawQueueRow
	for sqlRows.Next() {
		var id sql.NullString
		var status sql.NullString
		var params []byte

		if err := sqlRows.Scan(&id, &status, &params); err != nil {
			t.Fatalf("scan raw queue row: %v", err)
		}

		out = append(out, rawQueueRow{
			ID:        id.String,
			Status:    status.String,
			HasStatus: status.Valid,
			Params:    append([]byte(nil), params...),
		})
	}
	if err := sqlRows.Err(); err != nil {
		t.Fatalf("iterate raw queue rows: %v", err)
	}

	return out
}

func countQueueRows(t *testing.T, dbPath string) int {
	t.Helper()

	db := openRawSQLite(t, dbPath)
	defer func() {
		if err := db.Close(); err != nil {
			t.Errorf("close raw sqlite db: %v", err)
		}
	}()

	table := findQueueTable(t, db)
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", quoteSQLiteIdent(table))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var count int
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		t.Fatalf("count queue rows in %s: %v", table, err)
	}
	return count
}

type checkpointResult struct {
	busy        int
	log         int
	checkpointed int
}

func checkpointSQLite(t *testing.T, dbPath string) checkpointResult {
	t.Helper()

	db := openRawSQLite(t, dbPath)
	defer func() {
		if err := db.Close(); err != nil {
			t.Errorf("close raw sqlite db: %v", err)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var result checkpointResult
	if err := db.QueryRowContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)").Scan(
		&result.busy,
		&result.log,
		&result.checkpointed,
	); err != nil {
		t.Fatalf("manual WAL checkpoint failed: %v", err)
	}

	return result
}

func integrityCheckSQLite(t *testing.T, dbPath string) {
	t.Helper()

	db := openRawSQLite(t, dbPath)
	defer func() {
		if err := db.Close(); err != nil {
			t.Errorf("close raw sqlite db: %v", err)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, "PRAGMA integrity_check")
	if err != nil {
		t.Fatalf("PRAGMA integrity_check failed: %v", err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close integrity_check rows: %v", err)
		}
	}()

	var results []string
	for rows.Next() {
		var result string
		if err := rows.Scan(&result); err != nil {
			t.Fatalf("scan integrity_check result: %v", err)
		}
		results = append(results, result)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate integrity_check results: %v", err)
	}

	if len(results) != 1 || results[0] != "ok" {
		t.Fatalf("PRAGMA integrity_check returned %v, want [ok]", results)
	}
}

func openRawSQLite(t *testing.T, dbPath string) *sql.DB {
	t.Helper()

	driver := registeredSQLiteDriver(t)
	db, err := sql.Open(driver, dbPath)
	if err != nil {
		t.Fatalf("open raw sqlite database with driver %q: %v", driver, err)
	}
	db.SetMaxOpenConns(1)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		t.Fatalf("ping raw sqlite database with driver %q: %v", driver, err)
	}

	return db
}

func registeredSQLiteDriver(t *testing.T) string {
	t.Helper()

	drivers := sql.Drivers()
	for _, want := range []string{"sqlite", "sqlite3"} {
		for _, got := range drivers {
			if got == want {
				return got
			}
		}
	}

	for _, got := range drivers {
		if strings.Contains(strings.ToLower(got), "sqlite") {
			return got
		}
	}

	t.Fatalf("no registered sqlite database/sql driver found; registered drivers: %v", drivers)
	return ""
}

func findQueueTable(t *testing.T, db *sql.DB) string {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, `
		SELECT name
		FROM sqlite_master
		WHERE type = 'table'
		  AND name NOT LIKE 'sqlite_%'
		ORDER BY name
	`)
	if err != nil {
		t.Fatalf("query sqlite_master for queue table: %v", err)
	}

	var tableNames []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			_ = rows.Close()
			t.Fatalf("scan sqlite table name: %v", err)
		}
		tableNames = append(tableNames, name)
	}
	if err := rows.Close(); err != nil {
		t.Fatalf("close sqlite_master rows: %v", err)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate sqlite table names: %v", err)
	}

	for _, name := range tableNames {
		if tableHasColumns(t, db, name, "id", "status", "params") {
			return name
		}
	}

	t.Fatalf("could not find queue table with id/status/params columns; tables=%v", tableNames)
	return ""
}

func tableHasColumns(t *testing.T, db *sql.DB, table string, required ...string) bool {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := fmt.Sprintf("PRAGMA table_info(%s)", quoteSQLiteIdent(table))
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		t.Fatalf("query table_info for %q: %v", table, err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close table_info rows for %q: %v", table, err)
		}
	}()

	columns := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var primaryKey int

		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			t.Fatalf("scan table_info for %q: %v", table, err)
		}
		columns[strings.ToLower(name)] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info for %q: %v", table, err)
	}

	for _, column := range required {
		if !columns[strings.ToLower(column)] {
			return false
		}
	}
	return true
}

func quoteSQLiteIdent(ident string) string {
	return `"` + strings.ReplaceAll(ident, `"`, `""`) + `"`
}
