package mcpclient

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

const (
	jsonRPCVersion     = "2.0"
	mcpProtocolVersion = "2025-03-26"
	mcpClientName      = "mcp-client-adapter"
	mcpClientVersion   = "1.0.0"

	allowedSchemaURI = "mcp://tools/call/v1.0"

	operationTimeout = 30 * time.Second
	maxResponseBytes = 10 << 20
)

type transportMode int

const (
	modeLegacyPOST transportMode = iota
	modeStreamableHTTP
)

type jsonRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      string `json:"id,omitempty"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc,omitempty"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func CallTool(ctx context.Context, params map[string]any) (json.RawMessage, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	ctx, cancel := context.WithTimeout(ctx, operationTimeout)
	defer cancel()

	if params == nil {
		return nil, newErr("validate params", "params are required")
	}

	schemaURI, _ := params["schema_uri"].(string)
	if schemaURI != allowedSchemaURI {
		return nil, newErr("validate schema_uri", "schema_uri not in allow-list")
	}

	serverURL, err := requiredString(params, "server_url")
	if err != nil {
		return nil, err
	}

	toolName, err := requiredString(params, "tool_name")
	if err != nil {
		return nil, err
	}

	credential, err := credentialString(params)
	if err != nil {
		return nil, err
	}

	arguments, err := argumentsRawMessage(params)
	if err != nil {
		return nil, err
	}

	endpoint, mode, err := pickTransport(serverURL)
	if err != nil {
		return nil, err
	}

	bearerToken, err := dereferenceCredential(ctx, credential)
	if err != nil {
		return nil, wrapErr("dereference credential", err)
	}
	bearerToken = normalizeBearerToken(bearerToken)
	if bearerToken == "" {
		return nil, newErr("dereference credential", "credential resolved to an empty bearer token")
	}

	callReq := jsonRPCRequest{
		JSONRPC: jsonRPCVersion,
		ID:      newUUID(),
		Method:  "tools/call",
		Params: map[string]any{
			"name":      toolName,
			"arguments": arguments,
		},
	}

	switch mode {
	case modeLegacyPOST:
		return doLegacyPOST(ctx, endpoint, bearerToken, callReq)
	case modeStreamableHTTP:
		return doStreamableHTTP(ctx, endpoint, bearerToken, toolName, arguments)
	default:
		return nil, newErr("pick transport", "unsupported transport mode")
	}
}

func pickTransport(serverURL string) (endpoint string, mode transportMode, err error) {
	raw := strings.TrimSpace(serverURL)
	if raw == "" {
		return "", modeLegacyPOST, newErr("pick transport", "server_url is required")
	}

	u, parseErr := url.Parse(raw)
	if parseErr != nil || u.Scheme == "" || u.Host == "" {
		return "", modeLegacyPOST, newErr("pick transport", "server_url must be an absolute http or https URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", modeLegacyPOST, newErr("pick transport", "server_url must use http or https")
	}

	u.Fragment = ""
	u.Path = cleanURLPath(u.Path)

	if hasMessagesPathComponent(u.Path) {
		return u.String(), modeLegacyPOST, nil
	}

	if u.Path == "" {
		u.Path = "/"
	}
	return u.String(), modeStreamableHTTP, nil
}

func doLegacyPOST(ctx context.Context, endpoint, bearerToken string, request jsonRPCRequest) (json.RawMessage, error) {
	payload, err := postJSONRPC(ctx, endpoint, bearerToken, request, "")
	if err != nil {
		return nil, wrapErr("legacy post", err)
	}

	result, err := resultFromJSONRPC(payload, bearerToken)
	if err != nil {
		return nil, wrapErr("legacy post result", err)
	}
	return result, nil
}

func doStreamableHTTP(ctx context.Context, endpoint, bearerToken, toolName string, arguments json.RawMessage) (json.RawMessage, error) {
	initializeReq := jsonRPCRequest{
		JSONRPC: jsonRPCVersion,
		ID:      newUUID(),
		Method:  "initialize",
		Params: map[string]any{
			"protocolVersion": mcpProtocolVersion,
			"capabilities":   map[string]any{},
			"clientInfo": map[string]any{
				"name":    mcpClientName,
				"version": mcpClientVersion,
			},
		},
	}

	initializePayload, sessionID, err := postJSONRPCWithSession(ctx, endpoint, bearerToken, initializeReq, "")
	if err != nil {
		return nil, wrapErr("streamable initialize", err)
	}

	if sessionID == "" {
		result, err := resultFromJSONRPC(initializePayload, bearerToken)
		if err != nil {
			return nil, wrapErr("streamable first response", err)
		}
		return result, nil
	}

	if _, err := resultFromJSONRPC(initializePayload, bearerToken); err != nil {
		return nil, wrapErr("streamable initialize result", err)
	}

	callReq := jsonRPCRequest{
		JSONRPC: jsonRPCVersion,
		ID:      newUUID(),
		Method:  "tools/call",
		Params: map[string]any{
			"name":      toolName,
			"arguments": arguments,
		},
	}

	callPayload, _, err := postJSONRPCWithSession(ctx, endpoint, bearerToken, callReq, sessionID)
	if err != nil {
		return nil, wrapErr("streamable tools call", err)
	}

	result, err := resultFromJSONRPC(callPayload, bearerToken)
	if err != nil {
		return nil, wrapErr("streamable tools call result", err)
	}
	return result, nil
}

func postJSONRPC(ctx context.Context, endpoint, bearerToken string, request jsonRPCRequest, sessionID string) (json.RawMessage, error) {
	payload, _, err := postJSONRPCWithSession(ctx, endpoint, bearerToken, request, sessionID)
	return payload, err
}

func postJSONRPCWithSession(ctx context.Context, endpoint, bearerToken string, request jsonRPCRequest, sessionID string) (json.RawMessage, string, error) {
	body, err := json.Marshal(request)
	if err != nil {
		return nil, "", wrapErr("marshal json-rpc request", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", newErr("build http request", "invalid endpoint URL")
	}

	setMCPHeaders(httpReq, bearerToken, sessionID)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, "", wrapErr("post json-rpc request", err)
	}
	defer resp.Body.Close()

	payload, err := readResponsePayload(resp)
	if err != nil {
		return nil, "", err
	}

	return payload, resp.Header.Get("Mcp-Session-Id"), nil
}

func readResponsePayload(resp *http.Response) (json.RawMessage, error) {
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, newErr("http response", fmt.Sprintf("unexpected HTTP status %d", resp.StatusCode))
	}

	if isEventStream(resp.Header.Get("Content-Type")) {
		payload, err := parseSSEResponse(resp.Body)
		if err != nil {
			return nil, err
		}
		return payload, nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return nil, wrapErr("read json response", err)
	}
	if len(body) > maxResponseBytes {
		return nil, newErr("read json response", "response body exceeds limit")
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, newErr("read json response", "empty response body")
	}

	return json.RawMessage(body), nil
}

func parseSSEResponse(body io.Reader) (json.RawMessage, error) {
	reader := bufio.NewReader(body)
	var dataLines []string
	var firstData json.RawMessage
	var total int

	emit := func() (json.RawMessage, bool) {
		if len(dataLines) == 0 {
			return nil, false
		}

		payload := strings.TrimSpace(strings.Join(dataLines, "\n"))
		dataLines = nil
		if payload == "" {
			return nil, false
		}

		raw := json.RawMessage([]byte(payload))
		if firstData == nil {
			firstData = append(json.RawMessage(nil), raw...)
		}

		if looksLikeJSONRPCResponse(raw) {
			return append(json.RawMessage(nil), raw...), true
		}

		return nil, false
	}

	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			total += len(line)
			if total > maxResponseBytes {
				return nil, newErr("parse sse response", "response body exceeds limit")
			}

			line = strings.TrimRight(line, "\r\n")
			switch {
			case line == "":
				if payload, ok := emit(); ok {
					return payload, nil
				}
			case strings.HasPrefix(line, "data:"):
				dataLines = append(dataLines, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
			}
		}

		if err != nil {
			if errors.Is(err, io.EOF) {
				if payload, ok := emit(); ok {
					return payload, nil
				}
				if firstData != nil {
					return firstData, nil
				}
				return nil, newErr("parse sse response", "no data event found")
			}
			return nil, wrapErr("parse sse response", err)
		}
	}
}

func resultFromJSONRPC(payload json.RawMessage, bearerToken string) (json.RawMessage, error) {
	var response jsonRPCResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return nil, wrapErr("parse json-rpc response", err)
	}

	if response.Error != nil {
		message := redact(response.Error.Message, bearerToken)
		if message == "" {
			message = "json-rpc error"
		}
		return nil, wrapErr("json-rpc error", fmt.Errorf("code %d: %s", response.Error.Code, message))
	}

	if len(response.Result) == 0 {
		return nil, newErr("parse json-rpc response", "missing result")
	}

	return append(json.RawMessage(nil), response.Result...), nil
}

func looksLikeJSONRPCResponse(payload json.RawMessage) bool {
	var envelope struct {
		ID     json.RawMessage `json:"id"`
		Method string          `json:"method"`
		Result json.RawMessage `json:"result"`
		Error  json.RawMessage `json:"error"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return false
	}
	return len(envelope.Result) > 0 || len(envelope.Error) > 0 || (len(envelope.ID) > 0 && envelope.Method == "")
}

func setMCPHeaders(req *http.Request, bearerToken, sessionID string) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Authorization", "Bearer "+bearerToken)
	req.Header.Set("Mcp-Protocol-Version", mcpProtocolVersion)
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
}

func isEventStream(contentType string) bool {
	if contentType == "" {
		return false
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err == nil {
		return strings.EqualFold(mediaType, "text/event-stream")
	}

	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "text/event-stream")
}

func cleanURLPath(p string) string {
	if p == "" {
		return ""
	}
	return path.Clean("/" + strings.TrimPrefix(p, "/"))
}

func hasMessagesPathComponent(p string) bool {
	for _, component := range strings.Split(strings.Trim(p, "/"), "/") {
		if component == "messages" {
			return true
		}
	}
	return false
}

func credentialString(params map[string]any) (string, error) {
	for _, key := range []string{"credential", "credential_ref", "token_ref", "bearer_token", "github_token"} {
		if _, ok := params[key]; ok {
			return requiredString(params, key)
		}
	}
	return "", newErr("validate credential", "credential is required")
}

func argumentsRawMessage(params map[string]any) (json.RawMessage, error) {
	value, ok := params["arguments"]
	if !ok || value == nil {
		return json.RawMessage(`{}`), nil
	}

	switch typed := value.(type) {
	case json.RawMessage:
		if len(bytes.TrimSpace(typed)) == 0 {
			return json.RawMessage(`{}`), nil
		}
		if !json.Valid(typed) {
			return nil, newErr("validate arguments", "arguments must be valid JSON")
		}
		return append(json.RawMessage(nil), typed...), nil
	case []byte:
		raw := bytes.TrimSpace(typed)
		if len(raw) == 0 {
			return json.RawMessage(`{}`), nil
		}
		if !json.Valid(raw) {
			return nil, newErr("validate arguments", "arguments must be valid JSON")
		}
		return append(json.RawMessage(nil), raw...), nil
	case string:
		raw := []byte(strings.TrimSpace(typed))
		if len(raw) == 0 {
			return json.RawMessage(`{}`), nil
		}
		if !json.Valid(raw) {
			return nil, newErr("validate arguments", "arguments string must contain valid JSON")
		}
		return append(json.RawMessage(nil), raw...), nil
	default:
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, wrapErr("validate arguments", err)
		}
		return json.RawMessage(raw), nil
	}
}

func requiredString(params map[string]any, key string) (string, error) {
	value, ok := params[key]
	if !ok {
		return "", newErr("validate "+key, "missing required string")
	}

	stringValue, ok := value.(string)
	if !ok {
		return "", newErr("validate "+key, "must be a string")
	}

	stringValue = strings.TrimSpace(stringValue)
	if stringValue == "" {
		return "", newErr("validate "+key, "must not be empty")
	}

	return stringValue, nil
}

func dereferenceCredential(ctx context.Context, credential string) (string, error) {
	if !strings.HasPrefix(credential, "k8s://") {
		return credential, nil
	}

	ref, err := url.Parse(credential)
	if err != nil {
		return "", newErr("parse credential reference", "invalid k8s credential reference")
	}
	if ref.Scheme != "k8s" || ref.Host != "secret" {
		return "", newErr("parse credential reference", "credential reference must use k8s://secret/<name>?key=<key>")
	}

	name := strings.TrimPrefix(ref.Path, "/")
	if name == "" {
		return "", newErr("parse credential reference", "secret name is required")
	}
	name, err = url.PathUnescape(name)
	if err != nil {
		return "", newErr("parse credential reference", "invalid secret name")
	}

	key := ref.Query().Get("key")
	if key == "" {
		return "", newErr("parse credential reference", "secret key is required")
	}

	namespace := ref.Query().Get("namespace")
	if namespace == "" {
		namespace = currentNamespace()
	}

	return readKubernetesSecret(ctx, namespace, name, key)
}

func readKubernetesSecret(ctx context.Context, namespace, name, key string) (string, error) {
	host := os.Getenv("KUBERNETES_SERVICE_HOST")
	port := os.Getenv("KUBERNETES_SERVICE_PORT")
	if host == "" {
		return "", newErr("read kubernetes secret", "KUBERNETES_SERVICE_HOST is not set")
	}
	if port == "" {
		port = "443"
	}

	serviceAccountToken, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token")
	if err != nil {
		return "", wrapErr("read kubernetes service account token", err)
	}

	roots, err := x509.SystemCertPool()
	if err != nil || roots == nil {
		roots = x509.NewCertPool()
	}
	if ca, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"); err == nil {
		roots.AppendCertsFromPEM(ca)
	}

	apiURL := url.URL{
		Scheme: "https",
		Host:   net.JoinHostPort(host, port),
		Path:   "/api/v1/namespaces/" + url.PathEscape(namespace) + "/secrets/" + url.PathEscape(name),
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL.String(), nil)
	if err != nil {
		return "", newErr("build kubernetes secret request", "invalid kubernetes API URL")
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(serviceAccountToken)))
	req.Header.Set("Accept", "application/json")

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS12,
				RootCAs:    roots,
			},
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", wrapErr("read kubernetes secret", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", newErr("read kubernetes secret", fmt.Sprintf("unexpected HTTP status %d", resp.StatusCode))
	}

	var secret struct {
		Data map[string]string `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&secret); err != nil {
		return "", wrapErr("decode kubernetes secret", err)
	}

	encoded, ok := secret.Data[key]
	if !ok {
		return "", newErr("read kubernetes secret", "requested key not found")
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", wrapErr("decode kubernetes secret key", err)
	}

	return string(decoded), nil
}

func currentNamespace() string {
	for _, env := range []string{"POD_NAMESPACE", "NAMESPACE"} {
		if namespace := strings.TrimSpace(os.Getenv(env)); namespace != "" {
			return namespace
		}
	}

	if namespace, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); err == nil {
		if trimmed := strings.TrimSpace(string(namespace)); trimmed != "" {
			return trimmed
		}
	}

	return "default"
}

func newUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func normalizeBearerToken(token string) string {
	token = strings.TrimSpace(token)
	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		return strings.TrimSpace(token[len("bearer "):])
	}
	return token
}

func redact(value, secret string) string {
	if secret == "" {
		return value
	}
	return strings.ReplaceAll(value, secret, "[redacted]")
}

func wrapErr(context string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("mcp-client: %s: %w", context, err)
}

func newErr(context, message string) error {
	return wrapErr(context, errors.New(message))
}
