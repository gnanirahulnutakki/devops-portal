package mcpclient

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	allowedSchemaURI        = "mcp://tools/call/v1.0"
	mcpMessagesPath         = "/messages"
	serviceAccountNamespace = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
)

type jsonRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  callToolParam `json:"params"`
}

type callToolParam struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type jsonRPCResponse struct {
	Result json.RawMessage `json:"result,omitempty"`
	Error  *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// CallTool invokes an MCP tool over the HTTP JSON-RPC transport.
func CallTool(ctx context.Context, params map[string]any) ([]byte, error) {
	if schemaURI, _ := params["schema_uri"].(string); schemaURI != allowedSchemaURI {
		return nil, errors.New("mcp-client: schema_uri not in allow-list")
	}

	serverURL, err := requiredString(params, "server_url")
	if err != nil {
		return nil, err
	}

	toolName, err := requiredString(params, "tool_name")
	if err != nil {
		return nil, err
	}

	arguments, ok := params["arguments"].(map[string]any)
	if !ok {
		return nil, errors.New("mcp-client: arguments is required")
	}

	endpoint, err := messagesEndpoint(serverURL)
	if err != nil {
		return nil, fmt.Errorf("mcp-client: validate server_url: %w", err)
	}

	var bearerToken string
	if credentialURI, ok := params["credential_uri"].(string); ok && credentialURI != "" {
		bearerToken, err = dereferenceCredential(ctx, credentialURI)
		if err != nil {
			return nil, err
		}
	}

	requestID, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("mcp-client: generate request id: %w", err)
	}

	body, err := json.Marshal(jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      requestID,
		Method:  "tools/call",
		Params: callToolParam{
			Name:      toolName,
			Arguments: arguments,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("mcp-client: encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("mcp-client: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+bearerToken)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mcp-client: post tools/call request: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("mcp-client: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("mcp-client: transport returned status %d", resp.StatusCode)
	}

	var rpcResp jsonRPCResponse
	if err := json.Unmarshal(responseBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("mcp-client: decode response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("mcp-client: json-rpc error code=%d message=%s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	if len(rpcResp.Result) == 0 {
		return nil, errors.New("mcp-client: json-rpc response missing result")
	}

	return []byte(rpcResp.Result), nil
}

func requiredString(params map[string]any, key string) (string, error) {
	value, ok := params[key].(string)
	if !ok || strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("mcp-client: %s is required", key)
	}
	return value, nil
}

func messagesEndpoint(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("server_url must use http or https")
	}
	if parsed.Host == "" {
		return "", errors.New("server_url must include host")
	}

	parsed.Path = path.Join(parsed.Path, mcpMessagesPath)
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String(), nil
}

func dereferenceCredential(ctx context.Context, credentialURI string) (string, error) {
	parsed, err := url.Parse(credentialURI)
	if err != nil {
		return "", fmt.Errorf("mcp-client: parse credential_uri: %w", err)
	}
	if parsed.Scheme != "k8s" {
		return "", errors.New("mcp-client: unsupported credential scheme; only k8s:// is supported in v0.1")
	}
	if parsed.Host != "secret" {
		return "", errors.New("mcp-client: credential_uri must use k8s://secret/<name>?key=<key>")
	}

	secretName := strings.TrimPrefix(parsed.Path, "/")
	secretKey := parsed.Query().Get("key")
	if secretName == "" || secretKey == "" {
		return "", errors.New("mcp-client: credential_uri must use k8s://secret/<name>?key=<key>")
	}

	namespace, err := currentNamespace()
	if err != nil {
		return "", fmt.Errorf("mcp-client: resolve credential namespace: %w", err)
	}

	cfg, err := rest.InClusterConfig()
	if err != nil {
		return "", fmt.Errorf("mcp-client: create in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return "", fmt.Errorf("mcp-client: create kubernetes client: %w", err)
	}

	secret, err := clientset.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("mcp-client: read kubernetes secret: %w", err)
	}

	value, ok := secret.Data[secretKey]
	if !ok {
		return "", errors.New("mcp-client: credential key not found in kubernetes secret")
	}
	if len(value) == 0 {
		return "", errors.New("mcp-client: credential key is empty")
	}

	return string(value), nil
}

func currentNamespace() (string, error) {
	data, err := os.ReadFile(serviceAccountNamespace)
	if err != nil {
		return "", err
	}

	namespace := strings.TrimSpace(string(data))
	if namespace == "" {
		return "", errors.New("service account namespace is empty")
	}

	return namespace, nil
}

func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	encoded := make([]byte, 36)
	hex.Encode(encoded[0:8], b[0:4])
	encoded[8] = '-'
	hex.Encode(encoded[9:13], b[4:6])
	encoded[13] = '-'
	hex.Encode(encoded[14:18], b[6:8])
	encoded[18] = '-'
	hex.Encode(encoded[19:23], b[8:10])
	encoded[23] = '-'
	hex.Encode(encoded[24:36], b[10:16])

	return string(encoded), nil
}
