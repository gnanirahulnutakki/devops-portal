package ca

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"sync"
	"time"
)

const (
	selfSignedRootValidity = 10 * 365 * 24 * time.Hour
	leafValidity           = 24 * time.Hour
)

// SelfSignedCA is a development-only CA that generates an ephemeral root
// certificate in memory. It must not be used for production traffic.
type SelfSignedCA struct {
	mu sync.RWMutex

	caCert *x509.Certificate
	caKey  *ecdsa.PrivateKey

	revoked map[string]struct{}
}

// NewSelfSignedCA creates a new in-memory ECDSA P-256 root used to sign leaf
// certificates. The root is valid for ten years.
func NewSelfSignedCA() (*SelfSignedCA, error) {
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate CA key: %w", err)
	}

	serial, err := randomSerial()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "TBD_PROJECT_NAME dev self-signed CA",
			Organization: []string{"TBD_PROJECT_NAME"},
		},
		NotBefore:             now,
		NotAfter:              now.Add(selfSignedRootValidity),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            1,
	}

	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &caKey.PublicKey, caKey)
	if err != nil {
		return nil, fmt.Errorf("create CA certificate: %w", err)
	}

	caCert, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, fmt.Errorf("parse CA certificate: %w", err)
	}

	return &SelfSignedCA{
		caCert:  caCert,
		caKey:   caKey,
		revoked: make(map[string]struct{}),
	}, nil
}

// SignCSR issues a new ECDSA P-256 leaf certificate using AgentName and
// RequestedDNSNames from csr. For this development issuer, a fresh leaf key
// pair is generated and PublicKeyPEM is ignored.
func (s *SelfSignedCA) SignCSR(ctx context.Context, csr *CSRRequest) (*Certificate, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	return s.signCSR(csr, now, now.Add(leafValidity))
}

func (s *SelfSignedCA) signCSR(csr *CSRRequest, notBefore, notAfter time.Time) (*Certificate, error) {
	if csr == nil {
		return nil, fmt.Errorf("csr is nil")
	}
	if csr.AgentName == "" {
		return nil, fmt.Errorf("agent name is required")
	}

	s.mu.RLock()
	caCert := s.caCert
	caKey := s.caKey
	s.mu.RUnlock()

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate leaf key: %w", err)
	}

	serial, err := randomSerial()
	if err != nil {
		return nil, err
	}

	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   csr.AgentName,
			Organization: []string{"TBD_PROJECT_NAME agent"},
		},
		DNSNames:  append([]string(nil), csr.RequestedDNSNames...),
		NotBefore: notBefore,
		NotAfter:  notAfter,
		KeyUsage:  x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage: []x509.ExtKeyUsage{
			x509.ExtKeyUsageClientAuth,
			x509.ExtKeyUsageServerAuth,
		},
	}

	der, err := x509.CreateCertificate(rand.Reader, tmpl, caCert, &leafKey.PublicKey, caKey)
	if err != nil {
		return nil, fmt.Errorf("create leaf certificate: %w", err)
	}

	leafCert, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, fmt.Errorf("parse leaf certificate: %w", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM, err := marshalECPrivateKey(leafKey)
	if err != nil {
		return nil, err
	}

	return &Certificate{
		CertPEM:     certPEM,
		KeyPEM:      keyPEM,
		ExpiresAt:   leafCert.NotAfter.UTC(),
		Fingerprint: certFingerprint(leafCert.Raw),
	}, nil
}

// VerifyCert ensures the PEM certificate is issued by this CA, is currently
// valid, and has not been revoked.
func (s *SelfSignedCA) VerifyCert(ctx context.Context, certPEM []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	block, _ := pem.Decode(certPEM)
	if block == nil || block.Type != "CERTIFICATE" {
		return fmt.Errorf("invalid PEM certificate")
	}

	leaf, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("parse certificate: %w", err)
	}

	s.mu.RLock()
	caCert := s.caCert
	revoked := s.revoked
	s.mu.RUnlock()

	fp := certFingerprint(leaf.Raw)
	if _, ok := revoked[fp]; ok {
		return fmt.Errorf("certificate revoked")
	}

	now := time.Now()
	if now.Before(leaf.NotBefore) || !now.Before(leaf.NotAfter) {
		return fmt.Errorf("certificate outside validity window")
	}

	roots := x509.NewCertPool()
	roots.AddCert(caCert)
	if _, err := leaf.Verify(x509.VerifyOptions{
		Roots:       roots,
		CurrentTime: now,
	}); err != nil {
		return fmt.Errorf("verify chain: %w", err)
	}

	return nil
}

// RotateCA replaces the in-memory root key and certificate. Previously issued
// certificates will no longer verify.
func (s *SelfSignedCA) RotateCA(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("generate CA key: %w", err)
	}

	serial, err := randomSerial()
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "TBD_PROJECT_NAME dev self-signed CA",
			Organization: []string{"TBD_PROJECT_NAME"},
		},
		NotBefore:             now,
		NotAfter:              now.Add(selfSignedRootValidity),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            1,
	}

	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &caKey.PublicKey, caKey)
	if err != nil {
		return fmt.Errorf("create CA certificate: %w", err)
	}

	caCert, err := x509.ParseCertificate(der)
	if err != nil {
		return fmt.Errorf("parse CA certificate: %w", err)
	}

	s.mu.Lock()
	s.caCert = caCert
	s.caKey = caKey
	s.mu.Unlock()

	return nil
}

// Revoke records a leaf fingerprint so VerifyCert rejects it.
func (s *SelfSignedCA) Revoke(ctx context.Context, fingerprint string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if fingerprint == "" {
		return fmt.Errorf("fingerprint is required")
	}

	s.mu.Lock()
	s.revoked[fingerprint] = struct{}{}
	s.mu.Unlock()
	return nil
}

// Close releases resources for the self-signed CA. The implementation is a
// no-op because all state is in-memory.
func (s *SelfSignedCA) Close() error {
	return nil
}

func certFingerprint(der []byte) string {
	sum := sha256.Sum256(der)
	return hex.EncodeToString(sum[:])
}

func randomSerial() (*big.Int, error) {
	serialLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serial, err := rand.Int(rand.Reader, serialLimit)
	if err != nil {
		return nil, fmt.Errorf("generate serial: %w", err)
	}
	return serial, nil
}

func marshalECPrivateKey(key *ecdsa.PrivateKey) ([]byte, error) {
	der, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return nil, fmt.Errorf("marshal EC private key: %w", err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: der}), nil
}
