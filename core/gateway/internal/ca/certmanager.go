package ca

import (
	"bytes"
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	certManagerDefaultIssuerGroup = "cert-manager.io"
	certManagerDefaultTimeout     = 30 * time.Second
	certManagerDefaultPoll        = time.Second
	providerM14DefaultDuration    = 24 * time.Hour

	kubernetesSATokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	kubernetesSACertPath  = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
)

var (
	providerM14ErrInvalidConfig  = errors.New("invalid ca provider configuration")
	providerM14ErrInvalidRequest = errors.New("invalid ca provider request")
	providerM14ErrRevoked        = errors.New("certificate revoked")
)

type caProviderLogger interface {
	Debugf(format string, args ...any)
}

type CertManagerCAConfig struct {
	Namespace           string
	IssuerName          string
	IssuerKind          string
	IssuerGroup         string
	Duration            time.Duration
	KubernetesAPIServer string
	KubernetesToken     string
	KubernetesCABundle  []byte
	Logger              caProviderLogger
}

type CertManagerCA struct {
	namespace   string
	issuerName  string
	issuerKind  string
	issuerGroup string
	duration    time.Duration
	apiServer   string
	token       string
	client      *http.Client
	logger      caProviderLogger

	mu        sync.RWMutex
	revoked   map[string]struct{}
	trustPEM  []byte
	trustPool *x509.CertPool
}

func NewCertManagerCA(cfg CertManagerCAConfig) (*CertManagerCA, error) {
	namespace := strings.TrimSpace(cfg.Namespace)
	if namespace == "" {
		return nil, fmt.Errorf("certmanager-ca: validate namespace: %w", providerM14ErrInvalidConfig)
	}

	issuerName := strings.TrimSpace(cfg.IssuerName)
	if issuerName == "" {
		return nil, fmt.Errorf("certmanager-ca: validate issuer name: %w", providerM14ErrInvalidConfig)
	}

	issuerKind := strings.TrimSpace(cfg.IssuerKind)
	if issuerKind != "Issuer" && issuerKind != "ClusterIssuer" {
		return nil, fmt.Errorf("certmanager-ca: validate issuer kind: %w", providerM14ErrInvalidConfig)
	}

	issuerGroup := strings.TrimSpace(cfg.IssuerGroup)
	if issuerGroup == "" {
		issuerGroup = certManagerDefaultIssuerGroup
	}

	duration := cfg.Duration
	if duration <= 0 {
		duration = providerM14DefaultDuration
	}

	apiServerProvided := strings.TrimSpace(cfg.KubernetesAPIServer) != ""
	apiServer := strings.TrimRight(strings.TrimSpace(cfg.KubernetesAPIServer), "/")
	if apiServer == "" {
		host := os.Getenv("KUBERNETES_SERVICE_HOST")
		port := os.Getenv("KUBERNETES_SERVICE_PORT")
		if host == "" || port == "" {
			return nil, fmt.Errorf("certmanager-ca: detect kubernetes api server: %w", providerM14ErrInvalidConfig)
		}
		apiServer = "https://" + net.JoinHostPort(host, port)
	}

	token := strings.TrimSpace(cfg.KubernetesToken)
	if token == "" {
		tokenBytes, err := os.ReadFile(kubernetesSATokenPath)
		if err != nil && !apiServerProvided {
			return nil, fmt.Errorf("certmanager-ca: read service account token: %w", err)
		}
		token = strings.TrimSpace(string(tokenBytes))
	}

	caBundle := cfg.KubernetesCABundle
	if len(caBundle) == 0 && !apiServerProvided && strings.HasPrefix(apiServer, "https://") {
		var err error
		caBundle, err = os.ReadFile(kubernetesSACertPath)
		if err != nil {
			return nil, fmt.Errorf("certmanager-ca: read service account ca bundle: %w", err)
		}
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	if len(caBundle) > 0 {
		roots := x509.NewCertPool()
		if !roots.AppendCertsFromPEM(caBundle) {
			return nil, fmt.Errorf("certmanager-ca: parse kubernetes ca bundle: %w", providerM14ErrInvalidConfig)
		}
		transport.TLSClientConfig = &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}
	}

	return &CertManagerCA{
		namespace:   namespace,
		issuerName:  issuerName,
		issuerKind:  issuerKind,
		issuerGroup: issuerGroup,
		duration:    duration,
		apiServer:   apiServer,
		token:       token,
		client:      &http.Client{Transport: transport, Timeout: certManagerDefaultTimeout + 5*time.Second},
		logger:      cfg.Logger,
		revoked:     make(map[string]struct{}),
	}, nil
}

func (c *CertManagerCA) SignCSR(ctx context.Context, csr *CSRRequest) (*Certificate, error) {
	if csr == nil {
		return nil, fmt.Errorf("certmanager-ca: validate csr request: %w", providerM14ErrInvalidRequest)
	}

	csrPEM, keyPEM, err := providerM14BuildCSRFromRequest(csr)
	if err != nil {
		return nil, fmt.Errorf("certmanager-ca: build csr: %w", err)
	}

	name, err := c.createCertificateRequest(ctx, csr, csrPEM)
	if err != nil {
		return nil, fmt.Errorf("certmanager-ca: create CertificateRequest: %w", err)
	}

	certPEM, err := c.waitCertificateRequestReady(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("certmanager-ca: wait for CertificateRequest ready: %w", err)
	}

	cert, err := providerM14CertificateFromPEM(certPEM, keyPEM)
	if err != nil {
		return nil, fmt.Errorf("certmanager-ca: parse issued certificate: %w", err)
	}

	if trustPEM := providerM14TrustPEMFromIssued(certPEM); len(trustPEM) > 0 {
		if err := c.setTrustPEM(trustPEM); err != nil {
			return nil, fmt.Errorf("certmanager-ca: initialize trust bundle: %w", err)
		}
	}

	return cert, nil
}

func (c *CertManagerCA) VerifyCert(ctx context.Context, certPEM []byte) error {
	certs, _, err := providerM14ParsePEMCertificates(certPEM)
	if err != nil {
		return fmt.Errorf("certmanager-ca: parse certificate: %w", err)
	}

	fingerprint := providerM14Fingerprint(certs[0])
	if c.isRevoked(fingerprint) {
		return fmt.Errorf("certmanager-ca: verify certificate: %w", providerM14ErrRevoked)
	}

	roots, err := c.trustPoolForVerify(ctx)
	if err != nil {
		return fmt.Errorf("certmanager-ca: load issuer ca bundle: %w", err)
	}

	if err := providerM14VerifyCertificateBundle(certPEM, roots, time.Now()); err != nil {
		return fmt.Errorf("certmanager-ca: verify certificate chain: %w", err)
	}

	return nil
}

func (c *CertManagerCA) RotateCA(ctx context.Context) error {
	return nil
}

func (c *CertManagerCA) Revoke(ctx context.Context, fingerprint string) error {
	normalized := providerM14NormalizeFingerprint(fingerprint)
	if normalized == "" {
		return fmt.Errorf("certmanager-ca: revoke certificate: %w", providerM14ErrInvalidRequest)
	}

	c.mu.Lock()
	c.revoked[normalized] = struct{}{}
	c.mu.Unlock()

	return nil
}

func (c *CertManagerCA) Close() error {
	return nil
}

func (c *CertManagerCA) createCertificateRequest(ctx context.Context, csr *CSRRequest, csrPEM []byte) (string, error) {
	body := certManagerCertificateRequestResource{
		APIVersion: "cert-manager.io/v1",
		Kind:       "CertificateRequest",
		Metadata: certManagerMetadata{
			GenerateName: providerM14KubeGenerateName(csr.AgentName),
			Namespace:   c.namespace,
		},
		Spec: certManagerCertificateRequestSpec{
			Request:  base64.StdEncoding.EncodeToString(csrPEM),
			Duration: c.duration.String(),
			Usages: []string{
				"digital signature",
				"key encipherment",
				"server auth",
				"client auth",
			},
			IssuerRef: certManagerIssuerRef{
				Name:  c.issuerName,
				Kind:  c.issuerKind,
				Group: c.issuerGroup,
			},
		},
	}

	var created certManagerCertificateRequestResource
	if err := c.doKubeJSON(ctx, http.MethodPost, c.certificateRequestsURL(), body, &created); err != nil {
		return "", err
	}

	if created.Metadata.Name == "" {
		return "", fmt.Errorf("missing CertificateRequest metadata.name: %w", providerM14ErrInvalidRequest)
	}

	return created.Metadata.Name, nil
}

func (c *CertManagerCA) waitCertificateRequestReady(ctx context.Context, name string) ([]byte, error) {
	waitCtx, cancel := context.WithTimeout(ctx, certManagerDefaultTimeout)
	defer cancel()

	ticker := time.NewTicker(certManagerDefaultPoll)
	defer ticker.Stop()

	for {
		certPEM, ready, err := c.readCertificateRequest(waitCtx, name)
		if err != nil {
			return nil, err
		}
		if ready {
			return certPEM, nil
		}

		select {
		case <-waitCtx.Done():
			return nil, waitCtx.Err()
		case <-ticker.C:
		}
	}
}

func (c *CertManagerCA) readCertificateRequest(ctx context.Context, name string) ([]byte, bool, error) {
	var resource certManagerCertificateRequestResource
	if err := c.doKubeJSON(ctx, http.MethodGet, c.certificateRequestURL(name), nil, &resource); err != nil {
		return nil, false, err
	}

	for _, condition := range resource.Status.Conditions {
		if condition.Type == "Ready" && condition.Status == "True" {
			certPEM := providerM14DecodePossiblyBase64PEM(resource.Status.Certificate)
			if len(certPEM) == 0 {
				return nil, false, fmt.Errorf("ready CertificateRequest missing status.certificate: %w", providerM14ErrInvalidRequest)
			}
			return certPEM, true, nil
		}

		if condition.Status == "True" && (condition.Type == "Denied" || condition.Type == "Failed" || condition.Type == "InvalidRequest") {
			return nil, false, fmt.Errorf("CertificateRequest terminal condition %s: %w", condition.Type, providerM14ErrInvalidRequest)
		}

		if condition.Type == "Ready" && condition.Status == "False" && (condition.Reason == "Denied" || condition.Reason == "Failed") {
			return nil, false, fmt.Errorf("CertificateRequest not ready: %s: %w", condition.Reason, providerM14ErrInvalidRequest)
		}
	}

	return nil, false, nil
}

func (c *CertManagerCA) trustPoolForVerify(ctx context.Context) (*x509.CertPool, error) {
	c.mu.RLock()
	if c.trustPool != nil {
		pool := c.trustPool.Clone()
		c.mu.RUnlock()
		return pool, nil
	}
	c.mu.RUnlock()

	pemBytes, err := c.fetchIssuerCABundle(ctx)
	if err != nil {
		return nil, err
	}

	if err := c.setTrustPEM(pemBytes); err != nil {
		return nil, err
	}

	c.mu.RLock()
	pool := c.trustPool.Clone()
	c.mu.RUnlock()
	return pool, nil
}

func (c *CertManagerCA) fetchIssuerCABundle(ctx context.Context) ([]byte, error) {
	var resource map[string]any
	if err := c.doKubeJSON(ctx, http.MethodGet, c.issuerURL(), nil, &resource); err != nil {
		return nil, err
	}

	if pemBytes := providerM14FindCertificatePEM(resource["status"]); len(pemBytes) > 0 {
		return pemBytes, nil
	}
	if pemBytes := providerM14FindCertificatePEM(resource["spec"]); len(pemBytes) > 0 {
		return pemBytes, nil
	}

	return nil, fmt.Errorf("issuer ca bundle not found: %w", providerM14ErrInvalidConfig)
}

func (c *CertManagerCA) setTrustPEM(pemBytes []byte) error {
	pool, err := providerM14BuildCertPool(pemBytes)
	if err != nil {
		return err
	}

	c.mu.Lock()
	c.trustPEM = append([]byte(nil), pemBytes...)
	c.trustPool = pool
	c.mu.Unlock()
	return nil
}

func (c *CertManagerCA) isRevoked(fingerprint string) bool {
	c.mu.RLock()
	_, revoked := c.revoked[providerM14NormalizeFingerprint(fingerprint)]
	c.mu.RUnlock()
	return revoked
}

func (c *CertManagerCA) certificateRequestsURL() string {
	return c.apiServer + "/apis/cert-manager.io/v1/namespaces/" + url.PathEscape(c.namespace) + "/certificaterequests"
}

func (c *CertManagerCA) certificateRequestURL(name string) string {
	return c.certificateRequestsURL() + "/" + url.PathEscape(name)
}

func (c *CertManagerCA) issuerURL() string {
	name := url.PathEscape(c.issuerName)
	if c.issuerKind == "ClusterIssuer" {
		return c.apiServer + "/apis/cert-manager.io/v1/clusterissuers/" + name
	}
	return c.apiServer + "/apis/cert-manager.io/v1/namespaces/" + url.PathEscape(c.namespace) + "/issuers/" + name
}

func (c *CertManagerCA) doKubeJSON(ctx context.Context, method, endpoint string, payload any, out any) error {
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

	req.Header.Set("Accept", "application/json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.client.Do(req)
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

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode response body: %w", err)
	}

	return nil
}

type certManagerCertificateRequestResource struct {
	APIVersion string                              `json:"apiVersion,omitempty"`
	Kind       string                              `json:"kind,omitempty"`
	Metadata   certManagerMetadata                 `json:"metadata,omitempty"`
	Spec       certManagerCertificateRequestSpec    `json:"spec,omitempty"`
	Status     certManagerCertificateRequestStatus  `json:"status,omitempty"`
}

type certManagerMetadata struct {
	Name         string `json:"name,omitempty"`
	Namespace    string `json:"namespace,omitempty"`
	GenerateName string `json:"generateName,omitempty"`
}

type certManagerCertificateRequestSpec struct {
	Request   string               `json:"request"`
	Duration  string               `json:"duration,omitempty"`
	Usages    []string             `json:"usages,omitempty"`
	IssuerRef certManagerIssuerRef `json:"issuerRef"`
}

type certManagerIssuerRef struct {
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Group string `json:"group,omitempty"`
}

type certManagerCertificateRequestStatus struct {
	Conditions  []certManagerCondition `json:"conditions,omitempty"`
	Certificate string                 `json:"certificate,omitempty"`
}

type certManagerCondition struct {
	Type    string `json:"type,omitempty"`
	Status  string `json:"status,omitempty"`
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

type providerM14HTTPStatusError struct {
	StatusCode int
	Body       string
}

func (e providerM14HTTPStatusError) Error() string {
	if strings.TrimSpace(e.Body) == "" {
		return fmt.Sprintf("http status %d", e.StatusCode)
	}
	return fmt.Sprintf("http status %d: %s", e.StatusCode, strings.TrimSpace(e.Body))
}

func providerM14ReadErrorBody(r io.Reader) string {
	data, _ := io.ReadAll(io.LimitReader(r, 4096))
	return strings.TrimSpace(string(data))
}

func providerM14BuildCSRFromRequest(req *CSRRequest) ([]byte, []byte, error) {
	if req == nil || strings.TrimSpace(req.AgentName) == "" {
		return nil, nil, providerM14ErrInvalidRequest
	}

	if len(req.PublicKeyPEM) == 0 {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, nil, err
		}

		csrPEM, err := providerM14CreateCSR(req, key)
		if err != nil {
			return nil, nil, err
		}

		keyDER, err := x509.MarshalECPrivateKey(key)
		if err != nil {
			return nil, nil, err
		}

		return csrPEM, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), nil
	}

	if signer, err := providerM14ParsePrivateKeyPEM(req.PublicKeyPEM); err == nil {
		csrPEM, err := providerM14CreateCSR(req, signer)
		return csrPEM, nil, err
	}

	pub, err := providerM14ParsePublicKeyPEM(req.PublicKeyPEM)
	if err != nil {
		return nil, nil, err
	}

	ephemeral, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}

	// The fixed interface can carry public-key PEM but not a private signer.
	// This preserves the requested public key in the CSR; CAs that enforce
	// CSR proof-of-possession must be given private-key PEM instead.
	csrPEM, err := providerM14CreateCSR(req, providerM14PublicKeyCSRSigner{publicKey: pub, signer: ephemeral})
	return csrPEM, nil, err
}

func providerM14CreateCSR(req *CSRRequest, signer crypto.Signer) ([]byte, error) {
	template := &x509.CertificateRequest{
		Subject:  pkix.Name{CommonName: strings.TrimSpace(req.AgentName)},
		DNSNames: providerM14CleanStrings(req.RequestedDNSNames),
	}

	der, err := x509.CreateCertificateRequest(rand.Reader, template, signer)
	if err != nil {
		return nil, err
	}

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: der}), nil
}

type providerM14PublicKeyCSRSigner struct {
	publicKey crypto.PublicKey
	signer    crypto.Signer
}

func (s providerM14PublicKeyCSRSigner) Public() crypto.PublicKey {
	return s.publicKey
}

func (s providerM14PublicKeyCSRSigner) Sign(rand io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	return s.signer.Sign(rand, digest, opts)
}

func providerM14ParsePrivateKeyPEM(pemBytes []byte) (crypto.Signer, error) {
	rest := pemBytes
	for {
		block, next := pem.Decode(rest)
		if block == nil {
			break
		}
		rest = next

		switch block.Type {
		case "EC PRIVATE KEY":
			key, err := x509.ParseECPrivateKey(block.Bytes)
			if err == nil {
				return key, nil
			}
		case "RSA PRIVATE KEY":
			key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
			if err == nil {
				return key, nil
			}
		case "PRIVATE KEY":
			key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
			if err == nil {
				if signer, ok := key.(crypto.Signer); ok {
					return signer, nil
				}
			}
		}
	}

	return nil, errors.New("no private key PEM block found")
}

func providerM14ParsePublicKeyPEM(pemBytes []byte) (crypto.PublicKey, error) {
	rest := pemBytes
	for {
		block, next := pem.Decode(rest)
		if block == nil {
			break
		}
		rest = next

		switch block.Type {
		case "PUBLIC KEY":
			pub, err := x509.ParsePKIXPublicKey(block.Bytes)
			if err == nil {
				return pub, nil
			}
		case "RSA PUBLIC KEY":
			pub, err := x509.ParsePKCS1PublicKey(block.Bytes)
			if err == nil {
				return pub, nil
			}
		case "CERTIFICATE":
			cert, err := x509.ParseCertificate(block.Bytes)
			if err == nil {
				return cert.PublicKey, nil
			}
		case "EC PRIVATE KEY", "RSA PRIVATE KEY", "PRIVATE KEY":
			signer, err := providerM14ParsePrivateKeyPEM(pemBytes)
			if err == nil {
				return signer.Public(), nil
			}
		default:
			pub, err := x509.ParsePKIXPublicKey(block.Bytes)
			if err == nil {
				return pub, nil
			}
			if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
				return key, nil
			}
		}
	}

	return nil, errors.New("no public key PEM block found")
}

func providerM14CertificateFromPEM(certPEM, keyPEM []byte) (*Certificate, error) {
	certs, _, err := providerM14ParsePEMCertificates(certPEM)
	if err != nil {
		return nil, err
	}

	return &Certificate{
		CertPEM:     append([]byte(nil), certPEM...),
		KeyPEM:      append([]byte(nil), keyPEM...),
		ExpiresAt:   certs[0].NotAfter,
		Fingerprint: providerM14Fingerprint(certs[0]),
	}, nil
}

func providerM14VerifyCertificateBundle(certPEM []byte, roots *x509.CertPool, now time.Time) error {
	if roots == nil {
		return errors.New("missing trust roots")
	}

	certs, _, err := providerM14ParsePEMCertificates(certPEM)
	if err != nil {
		return err
	}

	intermediates := x509.NewCertPool()
	for _, cert := range certs[1:] {
		intermediates.AddCert(cert)
	}

	_, err = certs[0].Verify(x509.VerifyOptions{
		Roots:         roots,
		Intermediates: intermediates,
		CurrentTime:   now,
		KeyUsages:     []x509.ExtKeyUsage{x509.ExtKeyUsageAny},
	})
	return err
}

func providerM14ParsePEMCertificates(certPEM []byte) ([]*x509.Certificate, [][]byte, error) {
	var certs []*x509.Certificate
	var blocks [][]byte

	rest := certPEM
	for {
		block, next := pem.Decode(rest)
		if block == nil {
			break
		}
		rest = next

		if block.Type != "CERTIFICATE" {
			continue
		}

		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, nil, err
		}

		certs = append(certs, cert)
		blocks = append(blocks, pem.EncodeToMemory(&pem.Block{
			Type:    block.Type,
			Headers: block.Headers,
			Bytes:    block.Bytes,
		}))
	}

	if len(certs) == 0 {
		return nil, nil, errors.New("no certificates found")
	}

	return certs, blocks, nil
}

func providerM14BuildCertPool(certPEM []byte) (*x509.CertPool, error) {
	if _, _, err := providerM14ParsePEMCertificates(certPEM); err != nil {
		return nil, err
	}

	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(certPEM) {
		return nil, errors.New("failed to append certificates to pool")
	}

	return pool, nil
}

func providerM14TrustPEMFromIssued(certPEM []byte) []byte {
	certs, blocks, err := providerM14ParsePEMCertificates(certPEM)
	if err != nil {
		return nil
	}

	if len(blocks) > 1 {
		return bytes.Join(blocks[1:], nil)
	}

	if certs[0].IsCA {
		return blocks[0]
	}

	return nil
}

func providerM14Fingerprint(cert *x509.Certificate) string {
	sum := sha256.Sum256(cert.Raw)
	return hex.EncodeToString(sum[:])
}

func providerM14NormalizeFingerprint(fingerprint string) string {
	fingerprint = strings.ToLower(strings.TrimSpace(fingerprint))
	fingerprint = strings.ReplaceAll(fingerprint, ":", "")
	return fingerprint
}

func providerM14DecodePossiblyBase64PEM(value string) []byte {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	if strings.Contains(value, "-----BEGIN ") {
		return []byte(value)
	}

	compact := strings.Map(func(r rune) rune {
		switch r {
		case ' ', '\n', '\r', '\t':
			return -1
		default:
			return r
		}
	}, value)

	decoded, err := base64.StdEncoding.DecodeString(compact)
	if err == nil && len(decoded) > 0 {
		return decoded
	}

	return []byte(value)
}

func providerM14FindCertificatePEM(value any) []byte {
	switch typed := value.(type) {
	case nil:
		return nil
	case string:
		pemBytes := providerM14DecodePossiblyBase64PEM(typed)
		if _, _, err := providerM14ParsePEMCertificates(pemBytes); err == nil {
			return pemBytes
		}
	case map[string]any:
		for _, key := range []string{"caBundle", "certificate", "ca", "tls.crt"} {
			if pemBytes := providerM14FindCertificatePEM(typed[key]); len(pemBytes) > 0 {
				return pemBytes
			}
		}
		for _, nested := range typed {
			if pemBytes := providerM14FindCertificatePEM(nested); len(pemBytes) > 0 {
				return pemBytes
			}
		}
	case []any:
		for _, nested := range typed {
			if pemBytes := providerM14FindCertificatePEM(nested); len(pemBytes) > 0 {
				return pemBytes
			}
		}
	}
	return nil
}

func providerM14CleanStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func providerM14KubeGenerateName(agentName string) string {
	name := strings.ToLower(strings.TrimSpace(agentName))
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}

	clean := strings.Trim(b.String(), "-")
	if clean == "" {
		clean = "agent"
	}
	if len(clean) > 40 {
		clean = strings.Trim(clean[:40], "-")
	}
	if clean == "" {
		clean = "agent"
	}

	return "mcp-" + clean + "-"
}

var _ CAProvider = (*CertManagerCA)(nil)
