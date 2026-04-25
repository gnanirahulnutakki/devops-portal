package mcpclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCallTool_RejectsUnlistedSchemaURI(t *testing.T) {
	cases := []string{
		"",
		"mcp://tools/call/v1.1",
		"mcp://prompts/get/v1.0",
		"http://evil.example.com/schema",
		"javascript:alert(1)",
	}
	for _, schema := range cases {
		_, err := CallTool(context.Background(), map[string]any{
			"schema_uri":  schema,
			"server_url":  "http://example.invalid:8080",
			"tool_name":   "list-issues",
			"arguments":   map[string]any{},
		})
		if err == nil || !strings.Contains(err.Error(), "schema_uri not in allow-list") {
			t.Errorf("schema_uri=%q: expected allow-list rejection, got: %v", schema, err)
		}
	}
}

func TestCallTool_RejectsUnsupportedCredentialScheme(t *testing.T) {
	cases := []string{
		"vault://data/something#scope=read",
		"https://example.com/secret",
		"file:///etc/passwd",
	}
	for _, credURI := range cases {
		_, err := CallTool(context.Background(), map[string]any{
			"schema_uri":     allowedSchemaURI,
			"server_url":     "http://example.invalid:8080",
			"tool_name":      "list-issues",
			"arguments":      map[string]any{},
			"credential_uri": credURI,
		})
		if err == nil || !strings.Contains(err.Error(), "unsupported credential scheme") {
			t.Errorf("credential_uri=%q: expected scheme rejection, got: %v", credURI, err)
		}
	}
}

func TestCallTool_RejectsNonHTTPServerURL(t *testing.T) {
	cases := []string{
		"file:///tmp/socket",
		"unix:///var/run/mcp.sock",
		"ftp://example.com:21",
		"javascript:alert(1)",
	}
	for _, srv := range cases {
		_, err := CallTool(context.Background(), map[string]any{
			"schema_uri": allowedSchemaURI,
			"server_url": srv,
			"tool_name":  "list-issues",
			"arguments":  map[string]any{},
		})
		if err == nil || !strings.Contains(err.Error(), "must use http or https") {
			t.Errorf("server_url=%q: expected http/https rejection, got: %v", srv, err)
		}
	}
}

func TestCallTool_RequiredFields(t *testing.T) {
	cases := []struct {
		name   string
		params map[string]any
		want   string
	}{
		{"missing-server-url", map[string]any{"schema_uri": allowedSchemaURI, "tool_name": "x", "arguments": map[string]any{}}, "server_url is required"},
		{"missing-tool-name", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "http://x", "arguments": map[string]any{}}, "tool_name is required"},
		{"missing-arguments", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "http://x", "tool_name": "y"}, "arguments is required"},
		{"empty-server-url", map[string]any{"schema_uri": allowedSchemaURI, "server_url": "  ", "tool_name": "y", "arguments": map[string]any{}}, "server_url is required"},
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

func TestCallTool_HappyPath_NoCredentials(t *testing.T) {
	mcpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/messages" {
			t.Errorf("expected POST to /messages, got %s", r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %q", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("Authorization") != "" {
			t.Error("expected no Authorization header when no credential_uri given")
		}
		var req jsonRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req.JSONRPC != "2.0" || req.Method != "tools/call" {
			t.Errorf("bad request shape: %+v", req)
		}
		if req.Params.Name != "list-issues" {
			t.Errorf("expected tool name list-issues, got %q", req.Params.Name)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":"x","result":{"content":[{"type":"text","text":"ok"}]}}`))
	}))
	defer mcpServer.Close()

	out, err := CallTool(context.Background(), map[string]any{
		"schema_uri": allowedSchemaURI,
		"server_url": mcpServer.URL,
		"tool_name":  "list-issues",
		"arguments":  map[string]any{"owner": "kubernetes", "repo": "kubernetes"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(string(out), "content") {
		t.Errorf("expected result to contain MCP CallToolResult content, got: %s", out)
	}
}

func TestCallTool_PropagatesJSONRPCError(t *testing.T) {
	mcpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":"x","error":{"code":-32601,"message":"method not found"}}`))
	}))
	defer mcpServer.Close()

	_, err := CallTool(context.Background(), map[string]any{
		"schema_uri": allowedSchemaURI,
		"server_url": mcpServer.URL,
		"tool_name":  "missing-tool",
		"arguments":  map[string]any{},
	})
	if err == nil {
		t.Fatal("expected error from json-rpc error response, got nil")
	}
	if !strings.Contains(err.Error(), "method not found") {
		t.Errorf("expected error to contain MCP error message, got: %v", err)
	}
	if !strings.Contains(err.Error(), "-32601") {
		t.Errorf("expected error to contain MCP error code, got: %v", err)
	}
}

func TestMessagesEndpoint_Variants(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"http://github-mcp:8080", "http://github-mcp:8080/messages"},
		{"http://github-mcp.svc:8080/", "http://github-mcp.svc:8080/messages"},
		{"https://example.com/api", "https://example.com/api/messages"},
		{"http://x:8080?keep=1", "http://x:8080/messages"},
	}
	for _, c := range cases {
		got, err := messagesEndpoint(c.in)
		if err != nil {
			t.Errorf("%q: unexpected error %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("%q: got %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNewUUID_FormatAndUniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		got, err := newUUID()
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 36 {
			t.Errorf("expected 36-char UUID, got %d: %q", len(got), got)
		}
		if got[14] != '4' {
			t.Errorf("expected version-4 UUID, byte 14 is %q in %q", got[14], got)
		}
		v := got[19]
		if v != '8' && v != '9' && v != 'a' && v != 'b' {
			t.Errorf("expected RFC4122 variant, byte 19 is %q in %q", v, got)
		}
		if seen[got] {
			t.Errorf("duplicate UUID generated: %q", got)
		}
		seen[got] = true
	}
}
