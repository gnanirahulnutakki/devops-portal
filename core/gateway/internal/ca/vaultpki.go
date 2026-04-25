package ca

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type VaultPKIConfig struct {
	Address     string
	Mount       string
	Role        string
	Token       string
	Namespace   string
	Duration    time.Duration
	CABundlePEM []byte
	TLSConfig   *tls.Config
	HTTPTimeout time.Duration
	Logger      caProviderLogger
}

type VaultPKICA struct {
	address   string
	mount     string
	role      string
	token     string
	namespace string
	duration  time.Duration
	client    *http.Client
	logger    caProviderLogger

	mu        sync.RWMutex
	revoked   map[string]struct{}
	issued    map[string][]byte
	trustPEM  []byte
	trustPool *x509.CertPool
}

func NewVaultPKICA(cfg VaultPKIConfig) (*VaultPKICA, error) {
	address := strings.TrimRight(strings.TrimSpace(cfg.Address), "/")
	if address == "" {
		return nil, fmt.Errorf("vault-pki: validate address: %w", providerM14ErrInvalidConfig)
	}
	parsed, err := url.Parse(address)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("vault-pki: validate address: %w", providerM14ErrInvalidConfig)
	}

	mount := strings.Trim(strings.TrimSpace(cfg.Mount), "/")
	if mount == "" {
		return nil, fmt.Errorf("vault-pki: validate mount: %w", providerM14ErrInvalidConfig)
	}

	role := strings.TrimSpace(cfg.Role)
	if role == "" {
		return nil, fmt.Errorf("vault-pki: validate role: %w", providerM14ErrInvalidConfig)
	}

	token := strings.TrimSpace(cfg.Token)
	if token == "" {
		token = strings.TrimSpace(os.Getenv("VAULT_TOKEN"))
	}
	if token == "" {
		return nil, fmt.Errorf("vault-pki: load token: %w", providerM14ErrInvalidConfig)
	}

	duration := cfg.Duration
	if duration <= 0 {
		duration = providerM14DefaultDuration
	}

	timeout := cfg.HTTPTimeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	if cfg.TLSConfig != nil {
		transport.TLSClientConfig = cfg.TLSConfig.Clone()
	}

	var trustPEM []byte
	var trustPool *x509.CertPool
	if len(cfg.CABundlePEM) > 0 {
		trustPool, err = providerM14BuildCertPool(cfg.CABundlePEM)
		if err != nil {
			return nil, fmt.Errorf("vault-pki: parse ca bundle: %w", err)
		}
		trustPEM = append([]byte(nil), cfg.CABundlePEM...)
	}

	return &VaultPKICA{
		address:   address,
		mount:     mount,
		role:      role,
		token:     token,
		namespace: strings.TrimSpace(cfg.Namespace),
		duration:  duration,
		client:    &http.Client{Transport: transport, Timeout: timeout},
		logger:    cfg.Logger,
		revoked:   make(map[string]struct{}),
		issued:    make(map[string][]byte),
		trustPEM:  trustPEM,
		trustPool: trustPool,
	}, nil
}

func (v *VaultPKICA) SignCSR(ctx context.Context, csr *CSRRequest) (*Certificate, error) {
	if csr == nil || strings.TrimSpace(csr.AgentName) == "" {
		return nil, fmt.Errorf("vault-pki: validate csr request: %w", providerM14ErrInvalidRequest)
	}

	var endpoint string
	var payload map[string]any

	if len(csr.PublicKeyPEM) > 0 {
		csrPEM, _, err := providerM14BuildCSRFromRequest(csr)
		if err != nil {
			return nil, fmt.Errorf("vault-pki: build csr: %w", err)
		}

		endpoint = v.endpoint("sign", v.role)
		payload = map[string]any{
			"csr": string(csrPEM),
			"ttl": v.duration.String(),
		}
	} else {
		endpoint = v.endpoint("issue", v.role)
		payload = map[string]any{
			"common_name": strings.TrimSpace(csr.AgentName),
			"ttl":         v.duration.String(),
		}
		if dns := providerM14CleanStrings(csr.RequestedDNSNames); len(dns) > 0 {
			payload["alt_names"] = strings.Join(dns, ",")
		}
	}

	var response vaultPKIResponse
	if err := v.doVaultJSON(ctx, http.MethodPost, endpoint, payload, &response); err != nil {
		return nil, fmt.Errorf("vault-pki: sign certificate: %w", err)
	}

	certPEM, keyPEM, chainPEM, err := providerM14VaultCertificateData(response.Data)
	if err != nil {
		return nil, fmt.Errorf("vault-pki: parse sign response: %w", err)
	}

	cert, err := providerM14CertificateFromPEM(certPEM, keyPEM)
	if err != nil {
		return nil, fmt.Errorf("vault-pki: parse issued certificate: %w", err)
	}

	v.rememberIssued(cert.Fingerprint, cert.CertPEM)

	if len(chainPEM) > 0 {
		if err := v.setTrustPEM(chainPEM); err != nil {
			return nil, fmt.Errorf("vault-pki: initialize trust bundle: %w", err)
		}
	}

	return cert, nil
}

func (v *VaultPKICA) VerifyCert(ctx context.Context, certPEM []byte) error {
	certs, _, err := providerM14ParsePEMCertificates(certPEM)
	if err != nil {
		return fmt.Errorf("vault-pki: parse certificate: %w", err)
	}

	fingerprint := providerM14Fingerprint(certs[0])
	if v.isRevoked(fingerprint) {
		return fmt.Errorf("vault-pki: verify certificate: %w", providerM14ErrRevoked)
	}

	roots, err := v.trustPoolForVerify(ctx)
	if err != nil {
		return fmt.Errorf("vault-pki: load ca bundle: %w", err)
	}

	if err := providerM14VerifyCertificateBundle(certPEM, roots, time.Now()); err != nil {
		return fmt.Errorf("vault-pki: verify certificate chain: %w", err)
	}

	return nil
}

func (v *VaultPKICA) RotateCA(ctx context.Context) error {
	err := v.doVaultJSON(ctx, http.MethodPost, v.endpoint("root", "rotate", "internal"), map[string]any{}, nil)
	if err == nil {
		return nil
	}

	var statusErr providerM14HTTPStatusError
	if errors.As(err, &statusErr) && (statusErr.StatusCode == http.StatusForbidden || statusErr.StatusCode == http.StatusNotFound) {
		return nil
	}

	return fmt.Errorf("vault-pki: rotate ca: %w", err)
}

func (v *VaultPKICA) Revoke(ctx context.Context, fingerprint string) error {
	normalized := providerM14NormalizeFingerprint(fingerprint)
	if normalized == "" {
		return fmt.Errorf("vault-pki: revoke certificate: %w", providerM14ErrInvalidRequest)
	}

	v.mu.Lock()
	certPEM := append([]byte(nil), v.issued[normalized]...)
	v.revoked[normalized] = struct{}{}
	v.mu.Unlock()

	certificate := string(certPEM)
	if certificate == "" {
		certificate = fingerprint
	}

	payload := map[string]any{"certificate": certificate}
	if err := v.doVaultJSON(ctx, http.MethodPost, v.endpoint("revoke"), payload, nil); err != nil {
		return fmt.Errorf("vault-pki: revoke certificate: %w", err)
	}

	return nil
}

func (v *VaultPKICA) Close() error {
	return nil
}

func (v *VaultPKICA) rememberIssued(fingerprint string, certPEM []byte) {
	v.mu.Lock()
	v.issued[providerM14NormalizeFingerprint(fingerprint)] = append([]byte(nil), certPEM...)
	v.mu.Unlock()
}

func (v *VaultPKICA) isRevoked(fingerprint string) bool {
	v.mu.RLock()
	_, revoked := v.revoked[providerM14NormalizeFingerprint(fingerprint)]
	v.mu.RUnlock()
	return revoked
}

func (v *VaultPKICA) trustPoolForVerify(ctx context.Context) (*x509.CertPool, error) {
	v.mu.RLock()
	if v.trustPool != nil {
		pool := v.trustPool.Clone()
		v.mu.RUnlock()
		return pool, nil
	}
	v.mu.RUnlock()

	pemBytes, err := v.fetchCABundle(ctx)
	if err != nil {
		return nil, err
	}

	if err := v.setTrustPEM(pemBytes); err != nil {
		return nil, err
	}

	v.mu.RLock()
	pool := v.trustPool.Clone()
	v.mu.RUnlock()
	return pool, nil
}

func (v *VaultPKICA) setTrustPEM(pemBytes []byte) error {
	pool, err := providerM14BuildCertPool(pemBytes)
	if err != nil {
		return err
	}

	v.mu.Lock()
	v.trustPEM = append([]byte(nil), pemBytes...)
	v.trustPool = pool
	v.mu.Unlock()
	return nil
}

func (v *VaultPKICA) fetchCABundle(ctx context.Context) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.endpoint("ca", "pem"), nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	v.decorateRequest(req, false)

	resp, err := v.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, providerM14HTTPStatusError{StatusCode: resp.StatusCode, Body: providerM14ReadErrorBody(resp.Body)}
	}

	pemBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}
	if _, _, err := providerM14ParsePEMCertificates(pemBytes); err != nil {
		return nil, fmt.Errorf("parse ca pem: %w", err)
	}

	return pemBytes, nil
}

func (v *VaultPKICA) doVaultJSON(ctx context.Context, method, endpoint string, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode request body: %w", err)
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	v.decorateRequest(req, payload != nil)

	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return providerM14HTTPStatusError{StatusCode: resp.StatusCode, Body: providerM14ReadErrorBody(resp.Body)}
	}

	if out == nil {
		return nil
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("decode response body: %w", err)
	}

	return nil
}

func (v *VaultPKICA) decorateRequest(req *http.Request, hasJSONBody bool) {
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Vault-Token", v.token)
	if v.namespace != "" {
		req.Header.Set("X-Vault-Namespace", v.namespace)
	}
	if hasJSONBody {
		req.Header.Set("Content-Type", "application/json")
	}
}

func (v *VaultPKICA) endpoint(parts ...string) string {
	all := []string{"v1"}
	all = append(all, providerM14VaultPathParts(v.mount)...)
	for _, part := range parts {
		all = append(all, providerM14VaultPathParts(part)...)
	}

	escaped := make([]string, 0, len(all))
	for _, part := range all {
		if part == "" {
			continue
		}
		escaped = append(escaped, url.PathEscape(part))
	}

	return v.address + "/" + strings.Join(escaped, "/")
}

func providerM14VaultPathParts(value string) []string {
	raw := strings.Split(strings.Trim(value, "/"), "/")
	parts := make([]string, 0, len(raw))
	for _, part := range raw {
		if part != "" {
			parts = append(parts, part)
		}
	}
	return parts
}

type vaultPKIResponse struct {
	Data map[string]any `json:"data"`
}

func providerM14VaultCertificateData(data map[string]any) ([]byte, []byte, []byte, error) {
	certString, ok := data["certificate"].(string)
	if !ok || strings.TrimSpace(certString) == "" {
		return nil, nil, nil, errors.New("missing certificate")
	}

	certPEM := []byte(providerM14EnsureTrailingNewline(certString))

	var keyPEM []byte
	if keyString, ok := data["private_key"].(string); ok && strings.TrimSpace(keyString) != "" {
		keyPEM = []byte(providerM14EnsureTrailingNewline(keyString))
	}

	chainPEM := providerM14VaultCAChainPEM(data["ca_chain"])
	if len(chainPEM) > 0 {
		certPEM = append(certPEM, chainPEM...)
	}

	if expiration := providerM14VaultExpiration(data["expiration"]); !expiration.IsZero() {
		if certs, _, err := providerM14ParsePEMCertificates(certPEM); err == nil && expiration.Before(certs[0].NotAfter) {
			_ = expiration
		}
	}

	return certPEM, keyPEM, chainPEM, nil
}

func providerM14VaultCAChainPEM(value any) []byte {
	var out []byte

	switch typed := value.(type) {
	case string:
		if strings.TrimSpace(typed) != "" {
			out = append(out, []byte(providerM14EnsureTrailingNewline(typed))...)
		}
	case []any:
		for _, item := range typed {
			if chainCert, ok := item.(string); ok && strings.TrimSpace(chainCert) != "" {
				out = append(out, []byte(providerM14EnsureTrailingNewline(chainCert))...)
			}
		}
	case []string:
		for _, chainCert := range typed {
			if strings.TrimSpace(chainCert) != "" {
				out = append(out, []byte(providerM14EnsureTrailingNewline(chainCert))...)
			}
		}
	}

	return out
}

func providerM14VaultExpiration(value any) time.Time {
	switch typed := value.(type) {
	case json.Number:
		seconds, err := typed.Int64()
		if err == nil && seconds > 0 {
			return time.Unix(seconds, 0)
		}
	case float64:
		if typed > 0 {
			return time.Unix(int64(typed), 0)
		}
	case string:
		if seconds, err := strconv.ParseInt(typed, 10, 64); err == nil && seconds > 0 {
			return time.Unix(seconds, 0)
		}
		if parsed, err := time.Parse(time.RFC3339, typed); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

func providerM14EnsureTrailingNewline(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return value + "\n"
}

var _ CAProvider = (*VaultPKICA)(nil)
