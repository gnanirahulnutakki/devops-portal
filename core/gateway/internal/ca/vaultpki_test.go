package ca

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestVaultPKISignCSRWithProvidedPublicKeyCallsSign(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	var signCalled atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/pki_int/sign/mcp-role" {
			http.NotFound(w, r)
			return
		}
		signCalled.Add(1)

		if got := r.Header.Get("X-Vault-Token"); got != "test-token" {
			t.Errorf("X-Vault-Token = %q", got)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		csrPEM, ok := body["csr"].(string)
		if !ok || csrPEM == "" {
			t.Errorf("missing csr in request body")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		leafPEM := testM14IssueFromCSR(t, []byte(csrPEM), caCert, caKey)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"certificate": string(leafPEM),
				"ca_chain":    []string{string(caPEM)},
				"expiration":   time.Now().Add(time.Hour).Unix(),
			},
		})
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	cert, err := vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:         "agent-sign",
		PublicKeyPEM:      testM14PrivateKeyPEM(t),
		RequestedDNSNames: []string{"agent-sign.example.test"},
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if cert.Fingerprint == "" {
		t.Fatalf("empty fingerprint")
	}
	if signCalled.Load() != 1 {
		t.Fatalf("sign endpoint calls = %d", signCalled.Load())
	}
}

func TestVaultPKISignCSRWithoutPublicKeyCallsIssue(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	leafPEM, keyPEM := testM14IssueLeaf(t, "agent-issue", caCert, caKey)
	var issueCalled atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/pki_int/issue/mcp-role" {
			http.NotFound(w, r)
			return
		}
		issueCalled.Add(1)

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if body["common_name"] != "agent-issue" {
			t.Errorf("common_name = %v", body["common_name"])
		}
		if body["alt_names"] != "agent-issue.example.test" {
			t.Errorf("alt_names = %v", body["alt_names"])
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"certificate": string(leafPEM),
				"private_key": string(keyPEM),
				"ca_chain":    []string{string(caPEM)},
				"expiration":   time.Now().Add(time.Hour).Unix(),
			},
		})
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	cert, err := vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:         "agent-issue",
		RequestedDNSNames: []string{"agent-issue.example.test"},
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if len(cert.KeyPEM) == 0 {
		t.Fatalf("expected Vault-generated private key")
	}
	if issueCalled.Load() != 1 {
		t.Fatalf("issue endpoint calls = %d", issueCalled.Load())
	}
}

func TestVaultPKIErrorWrapped(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "permission denied", http.StatusForbidden)
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	_, err := vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-error",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err == nil {
		t.Fatalf("SignCSR() error = nil")
	}
	if !strings.Contains(err.Error(), "vault-pki: sign certificate") {
		t.Fatalf("error did not wrap sign context: %v", err)
	}
	if strings.Contains(err.Error(), "test-token") {
		t.Fatalf("error leaked token: %v", err)
	}
}

func TestVaultPKITokenFromEnv(t *testing.T) {
	t.Setenv("VAULT_TOKEN", "env-token")

	caCert, caKey, caPEM := testM14RootCA(t)
	var sawEnvToken atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Vault-Token") == "env-token" {
			sawEnvToken.Store(true)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		leafPEM := testM14IssueFromCSR(t, []byte(body["csr"].(string)), caCert, caKey)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"certificate": string(leafPEM),
				"ca_chain":    []string{string(caPEM)},
			},
		})
	}))
	defer server.Close()

	vault, err := NewVaultPKICA(VaultPKIConfig{
		Address: server.URL,
		Mount:   "pki_int",
		Role:    "mcp-role",
	})
	if err != nil {
		t.Fatalf("NewVaultPKICA() error = %v", err)
	}

	_, err = vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-env",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if !sawEnvToken.Load() {
		t.Fatalf("server did not see env token")
	}
}

func TestVaultPKINamespaceHeader(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	var sawNamespace atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Vault-Namespace") == "admin/team-a" {
			sawNamespace.Store(true)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		leafPEM := testM14IssueFromCSR(t, []byte(body["csr"].(string)), caCert, caKey)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"certificate": string(leafPEM),
				"ca_chain":    []string{string(caPEM)},
			},
		})
	}))
	defer server.Close()

	vault, err := NewVaultPKICA(VaultPKIConfig{
		Address:   server.URL,
		Mount:     "pki_int",
		Role:      "mcp-role",
		Token:     "test-token",
		Namespace: "admin/team-a",
	})
	if err != nil {
		t.Fatalf("NewVaultPKICA() error = %v", err)
	}

	_, err = vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-ns",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if !sawNamespace.Load() {
		t.Fatalf("server did not see namespace header")
	}
}

func TestVaultPKIRevokeCallsEndpointAndAddsLocalRevocation(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	var revokeCalled atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/pki_int/sign/mcp-role":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			leafPEM := testM14IssueFromCSR(t, []byte(body["csr"].(string)), caCert, caKey)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{
					"certificate": string(leafPEM),
					"ca_chain":    []string{string(caPEM)},
				},
			})
		case "/v1/pki_int/revoke":
			revokeCalled.Add(1)
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Errorf("decode revoke body: %v", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if strings.TrimSpace(body["certificate"].(string)) == "" {
				t.Errorf("empty certificate in revoke request")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	cert, err := vault.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-revoke",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}

	if err := vault.Revoke(context.Background(), cert.Fingerprint); err != nil {
		t.Fatalf("Revoke() error = %v", err)
	}
	if revokeCalled.Load() != 1 {
		t.Fatalf("revoke endpoint calls = %d", revokeCalled.Load())
	}
	if err := vault.VerifyCert(context.Background(), cert.CertPEM); err == nil {
		t.Fatalf("VerifyCert() accepted revoked certificate")
	}
}

func TestVaultPKIVerifyCertFetchesCABundle(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	leafPEM, _ := testM14IssueLeaf(t, "agent-verify", caCert, caKey)
	var fetchedCA atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/pki_int/ca/pem" {
			http.NotFound(w, r)
			return
		}
		fetchedCA.Add(1)
		w.Header().Set("Content-Type", "application/pem-certificate-chain")
		_, _ = w.Write(caPEM)
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	if err := vault.VerifyCert(context.Background(), leafPEM); err != nil {
		t.Fatalf("VerifyCert() error = %v", err)
	}
	if fetchedCA.Load() != 1 {
		t.Fatalf("ca bundle fetches = %d", fetchedCA.Load())
	}
}

func TestVaultPKIRotateCACallsEndpoint(t *testing.T) {
	var rotateCalled atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/pki_int/root/rotate/internal" {
			http.NotFound(w, r)
			return
		}
		rotateCalled.Add(1)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	vault := testM14VaultPKI(t, server.URL)

	if err := vault.RotateCA(context.Background()); err != nil {
		t.Fatalf("RotateCA() error = %v", err)
	}
	if rotateCalled.Load() != 1 {
		t.Fatalf("rotate endpoint calls = %d", rotateCalled.Load())
	}
}

func testM14VaultPKI(t *testing.T, address string) *VaultPKICA {
	t.Helper()

	vault, err := NewVaultPKICA(VaultPKIConfig{
		Address:     address,
		Mount:       "pki_int",
		Role:        "mcp-role",
		Token:       "test-token",
		Duration:    time.Hour,
		HTTPTimeout: 5 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewVaultPKICA() error = %v", err)
	}

	return vault
}
