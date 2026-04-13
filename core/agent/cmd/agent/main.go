package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/TBD_PROJECT_NAME/core/agent/internal/dispatcher"
	"github.com/TBD_PROJECT_NAME/core/protocol/mvp"
)

// main registers this process with the gateway and loops: poll for work, execute, submit results.
func main() {
	gateway := flag.String("gateway", "http://localhost:8080", "gateway base URL")
	agentName := flag.String("agent-name", "local-agent", "agent name for registration")
	kubeconfig := flag.String("kubeconfig", "", "path to kubeconfig (empty = env/default)")
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	client := &http.Client{Timeout: 30 * time.Second}

	agentID, agentToken, err := register(ctx, client, *gateway, *agentName)
	if err != nil {
		log.Fatalf("registration failed: %v", err)
	}
	log.Printf("registered as agent_id=%s", agentID)

	disp := dispatcher.New(*kubeconfig)

	backoff := 2 * time.Second
	for {
		select {
		case <-ctx.Done():
			log.Println("shutting down")
			return
		default:
		}

		cmd, err := poll(ctx, client, *gateway, agentID, agentToken)
		if err != nil {
			log.Printf("poll error: %v; retrying in %s", err, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			if backoff < 30*time.Second {
				backoff *= 2
			}
			continue
		}
		backoff = 2 * time.Second

		if cmd == nil {
			continue
		}

		log.Printf("executing op=%s adapter=%s", cmd.OperationID, cmd.AdapterName)
		result := execute(ctx, disp, cmd)

		if err := submitResult(ctx, client, *gateway, agentToken, result); err != nil {
			log.Printf("submit-result failed for op=%s: %v", cmd.OperationID, err)
		}
	}
}

// register POSTs to the gateway and returns the assigned agent ID and auth token.
func register(ctx context.Context, client *http.Client, gateway, agentName string) (string, string, error) {
	body, err := json.Marshal(mvp.RegisterRequest{AgentName: agentName})
	if err != nil {
		log.Printf("register: json.Marshal: %v", err)
		return "", "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, gateway+"/register", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("register returned %d", resp.StatusCode)
	}
	var rr mvp.RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&rr); err != nil {
		return "", "", err
	}
	return rr.AgentID, rr.AgentToken, nil
}

// poll GETs the next command for this agent using agent_id + auth token.
func poll(ctx context.Context, client *http.Client, gateway, agentID, agentToken string) (*mvp.Command, error) {
	base, err := url.Parse(strings.TrimRight(gateway, "/"))
	if err != nil {
		return nil, err
	}
	pollURL := base.JoinPath("poll")
	q := url.Values{}
	q.Set("agent_id", agentID)
	pollURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pollURL.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Agent-Token", agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("poll returned %d", resp.StatusCode)
	}

	var cmd mvp.Command
	if err := json.NewDecoder(resp.Body).Decode(&cmd); err != nil {
		return nil, err
	}
	return &cmd, nil
}

// execute runs the dispatcher for the command and builds a Result.
func execute(ctx context.Context, disp *dispatcher.Dispatcher, cmd *mvp.Command) *mvp.Result {
	data, err := disp.Execute(ctx, cmd.AdapterName, cmd.Params)
	r := &mvp.Result{OperationID: cmd.OperationID}
	if err != nil {
		r.Error = err.Error()
	} else {
		r.OK = true
		r.ResultJSON = data
	}
	return r
}

// submitResult POSTs the execution result to the gateway with auth token.
func submitResult(ctx context.Context, client *http.Client, gateway, agentToken string, result *mvp.Result) error {
	body, err := json.Marshal(result)
	if err != nil {
		log.Printf("submit-result: json.Marshal: %v", err)
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, gateway+"/submit-result", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Token", agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Gateway returns 204 No Content on successful submit. Accept any 2xx.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("submit-result returned %d: %s", resp.StatusCode, raw)
	}
	return nil
}
