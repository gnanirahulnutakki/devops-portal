package mcpclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func TestCallToolLegacyMessagesPOST(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/messages" {
			t.Fatalf("path = %q, want /messages", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer ghp_legacytoken" {
			t.Fatalf("authorization header = %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("content-type header = %q", got)
		}

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Method != "tools/call" {
			t.Fatalf("method = %q, want tools/call", req.Method)
		}

		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		rawParams, err := json.Marshal(req.Params)
		if err != nil {
			t.Fatalf("marshal params: %v", err)
		}
		if err := json.Unmarshal(rawParams, &params); err != nil {
			t.Fatalf("unmarshal params: %v", err)
		}
		if params.Name != "issues/list" {
			t.Fatalf("tool name = %q", params.Name)
		}
		if params.Arguments["owner"] != "octo" {
			t.Fatalf("owner arg = %#v", params.Arguments["owner"])
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jsonRPCResponse{
			JSONRPC: jsonRPCVersion,
			ID:      json.RawMessage(`"legacy-1"`),
			Result:  json.RawMessage(`{"ok":true,"transport":"legacy"}`),
		})
	}))
	defer server.Close()

	got, err := CallTool(context.Background(), map[string]any{
		"server_url": server.URL + "/messages",
		"schema_uri": allowedSchemaURI,
		"credential": "ghp_legacytoken",
		"tool_name":  "issues/list",
		"arguments": map[string]any{
			"owner": "octo",
		},
	})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}

	assertJSONEqual(t, got, `{"ok":true,"transport":"legacy"}`)
}

func TestCallToolStreamableHTTPReturnsSingleSSEEventWithoutSession(t *testing.T) {
	var requests int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.URL.Path != "/" {
			t.Fatalf("path = %q, want /", r.URL.Path)
		}
		if got := r.Header.Get("Accept"); got != "application/json, text/event-stream" {
			t.Fatalf("accept header = %q", got)
		}
		if got := r.Header.Get("Mcp-Protocol-Version"); got != mcpProtocolVersion {
			t.Fatalf("protocol version header = %q", got)
		}

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Method != "initialize" {
			t.Fatalf("first method = %q, want initialize", req.Method)
		}

		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "event: message\n")
		fmt.Fprint(w, `data: {"jsonrpc":"2.0","id":"direct-1","result":{"ok":true,"transport":"sse-direct"}}`+"\n\n")
	}))
	defer server.Close()

	got, err := CallTool(context.Background(), map[string]any{
		"server_url": server.URL,
		"schema_uri": allowedSchemaURI,
		"credential": "ghp_streamtoken",
		"tool_name":  "issues/list",
		"arguments": map[string]any{
			"owner": "octo",
		},
	})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}

	assertJSONEqual(t, got, `{"ok":true,"transport":"sse-direct"}`)
}

func TestCallToolStreamableHTTPInitializeThenCallUsesSession(t *testing.T) {
	var requests int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++

		if r.URL.Path != "/" {
			t.Fatalf("path = %q, want /", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer ghp_streamtoken" {
			t.Fatalf("authorization header = %q", got)
		}

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		switch requests {
		case 1:
			if req.Method != "initialize" {
				t.Fatalf("first method = %q, want initialize", req.Method)
			}
			if got := r.Header.Get("Mcp-Session-Id"); got != "" {
				t.Fatalf("first request session id = %q, want empty", got)
			}

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Mcp-Session-Id", "session-123")
			fmt.Fprint(w, "event: message\n")
			fmt.Fprint(w, `data: {"jsonrpc":"2.0","id":"init-1","result":{"protocolVersion":"2025-03-26","capabilities":{}}}`+"\n\n")
		case 2:
			if req.Method != "tools/call" {
				t.Fatalf("second method = %q, want tools/call", req.Method)
			}
			if got := r.Header.Get("Mcp-Session-Id"); got != "session-123" {
				t.Fatalf("second request session id = %q, want session-123", got)
			}

			var params struct {
				Name      string         `json:"name"`
				Arguments map[string]any `json:"arguments"`
			}
			rawParams, err := json.Marshal(req.Params)
			if err != nil {
				t.Fatalf("marshal params: %v", err)
			}
			if err := json.Unmarshal(rawParams, &params); err != nil {
				t.Fatalf("unmarshal params: %v", err)
			}
			if params.Name != "issues/list" {
				t.Fatalf("tool name = %q", params.Name)
			}

			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, "event: message\n")
			fmt.Fprint(w, `data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}`+"\n\n")
			fmt.Fprint(w, "event: message\n")
			fmt.Fprint(w, `data: {"jsonrpc":"2.0","id":"call-1","result":{"ok":true,"transport":"streamable","session":"session-123"}}`+"\n\n")
		default:
			t.Fatalf("unexpected request %d", requests)
		}
	}))
	defer server.Close()

	got, err := CallTool(context.Background(), map[string]any{
		"server_url": server.URL + "/",
		"schema_uri": allowedSchemaURI,
		"credential": "ghp_streamtoken",
		"tool_name":  "issues/list",
		"arguments": map[string]any{
			"owner": "octo",
		},
	})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2", requests)
	}

	assertJSONEqual(t, got, `{"ok":true,"transport":"streamable","session":"session-123"}`)
}

func TestCallToolStreamableHTTPContentTypeDrivesJSONParsing(t *testing.T) {
	var requests int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++

		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		switch requests {
		case 1:
			if req.Method != "initialize" {
				t.Fatalf("first method = %q, want initialize", req.Method)
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Mcp-Session-Id", "json-session")
			_ = json.NewEncoder(w).Encode(jsonRPCResponse{
				JSONRPC: jsonRPCVersion,
				ID:      json.RawMessage(`"init-json"`),
				Result:  json.RawMessage(`{"protocolVersion":"2025-03-26","capabilities":{}}`),
			})
		case 2:
			if req.Method != "tools/call" {
				t.Fatalf("second method = %q, want tools/call", req.Method)
			}
			if got := r.Header.Get("Mcp-Session-Id"); got != "json-session" {
				t.Fatalf("session id = %q, want json-session", got)
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(jsonRPCResponse{
				JSONRPC: jsonRPCVersion,
				ID:      json.RawMessage(`"call-json"`),
				Result:  json.RawMessage(`{"ok":true,"transport":"json-streamable"}`),
			})
		default:
			t.Fatalf("unexpected request %d", requests)
		}
	}))
	defer server.Close()

	got, err := CallTool(context.Background(), map[string]any{
		"server_url": server.URL,
		"schema_uri": allowedSchemaURI,
		"credential": "ghp_jsontoken",
		"tool_name":  "issues/list",
		"arguments":  json.RawMessage(`{"owner":"octo"}`),
	})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2", requests)
	}

	assertJSONEqual(t, got, `{"ok":true,"transport":"json-streamable"}`)
}

func TestCallToolRejectsUnlistedSchemaURI(t *testing.T) {
	for _, schema := range []string{
		"",
		"mcp://tools/call/v1.1",
		"mcp://prompts/get/v1.0",
		"http://evil.example.com/schema",
		"javascript:alert(1)",
	} {
		_, err := CallTool(context.Background(), map[string]any{
			"schema_uri": schema,
			"server_url": "http://example.invalid:8080",
			"tool_name":  "list_issues",
			"arguments":  map[string]any{},
			"credential": "ghp_x",
		})
		if err == nil || !strings.Contains(err.Error(), "schema_uri not in allow-list") {
			t.Errorf("schema_uri=%q: expected allow-list rejection, got: %v", schema, err)
		}
	}
}

func TestCallToolRejectsNonHTTPServerURL(t *testing.T) {
	for _, srv := range []string{
		"file:///tmp/socket",
		"unix:///var/run/mcp.sock",
		"ftp://example.com:21",
		"javascript:alert(1)",
	} {
		_, err := CallTool(context.Background(), map[string]any{
			"schema_uri": allowedSchemaURI,
			"server_url": srv,
			"tool_name":  "list_issues",
			"arguments":  map[string]any{},
			"credential": "ghp_x",
		})
		if err == nil {
			t.Errorf("server_url=%q: expected rejection, got nil error", srv)
			continue
		}
		msg := err.Error()
		if !strings.Contains(msg, "http") || !strings.Contains(msg, "server_url") {
			t.Errorf("server_url=%q: expected error mentioning http and server_url, got: %v", srv, err)
		}
	}
}

func TestCallToolRequiredFields(t *testing.T) {
	cases := []struct {
		name   string
		params map[string]any
		want   string
	}{
		{"missing-server-url", map[string]any{"schema_uri": allowedSchemaURI, "tool_name": "x", "arguments": map[string]any{}, "credential": "ghp_x"}, "server_url"},
		{"missing-tool-name", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "http://x", "arguments": map[string]any{}, "credential": "ghp_x"}, "tool_name"},
		{"missing-credential", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "http://x", "tool_name": "y", "arguments": map[string]any{}}, "credential is required"},
		{"empty-server-url", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "  ", "tool_name": "y", "arguments": map[string]any{}, "credential": "ghp_x"}, "server_url"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := CallTool(context.Background(), c.params)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Errorf("expected error containing %q, got: %v", c.want, err)
			}
		})
	}
}

func TestRedactStripsBearerFromMessages(t *testing.T) {
	got := redact("server said ghp_realtoken123 is invalid", "ghp_realtoken123")
	if strings.Contains(got, "ghp_realtoken123") {
		t.Errorf("redact left token in message: %q", got)
	}
	if !strings.Contains(got, "[redacted]") {
		t.Errorf("redact did not insert placeholder: %q", got)
	}
}

func assertJSONEqual(t *testing.T, got json.RawMessage, want string) {
	t.Helper()

	var gotValue any
	if err := json.Unmarshal(got, &gotValue); err != nil {
		t.Fatalf("unmarshal got JSON: %v; got %s", err, string(got))
	}

	var wantValue any
	if err := json.Unmarshal([]byte(want), &wantValue); err != nil {
		t.Fatalf("unmarshal want JSON: %v", err)
	}

	if !reflect.DeepEqual(gotValue, wantValue) {
		t.Fatalf("JSON mismatch:\n got: %s\nwant: %s", string(got), want)
	}
}
