package ca

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestCertManagerSignCSRHappyPath(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)

	var created certManagerCertificateRequestResource
	var certBundle []byte

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/apis/cert-manager.io/v1/namespaces/test-ns/certificaterequests":
			if err := json.NewDecoder(r.Body).Decode(&created); err != nil {
				t.Errorf("decode create body: %v", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			csrPEM := providerM14DecodePossiblyBase64PEM(created.Spec.Request)
			leafPEM := testM14IssueFromCSR(t, csrPEM, caCert, caKey)
			certBundle = append(append([]byte(nil), leafPEM...), caPEM...)

			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Metadata: certManagerMetadata{Name: "req-1"},
			})
		case r.Method == http.MethodGet && r.URL.Path == "/apis/cert-manager.io/v1/namespaces/test-ns/certificaterequests/req-1":
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Status: certManagerCertificateRequestStatus{
					Conditions:  []certManagerCondition{{Type: "Ready", Status: "True"}},
					Certificate: base64.StdEncoding.EncodeToString(certBundle),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cm := testM14CertManagerCA(t, server.URL)
	keyPEM := testM14PrivateKeyPEM(t)

	cert, err := cm.SignCSR(context.Background(), &CSRRequest{
		AgentName:         "agent-1",
		PublicKeyPEM:      keyPEM,
		RequestedDNSNames: []string{"agent-1.example.test"},
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if len(cert.CertPEM) == 0 {
		t.Fatalf("SignCSR() returned empty certificate")
	}
	if cert.Fingerprint == "" {
		t.Fatalf("SignCSR() returned empty fingerprint")
	}
	if !bytes.Equal(cert.CertPEM, certBundle) {
		t.Fatalf("SignCSR() did not read status.certificate correctly")
	}

	if created.Spec.IssuerRef.Name != "test-issuer" {
		t.Fatalf("issuer name = %q", created.Spec.IssuerRef.Name)
	}
	if created.Spec.IssuerRef.Kind != "Issuer" {
		t.Fatalf("issuer kind = %q", created.Spec.IssuerRef.Kind)
	}
	if created.Spec.IssuerRef.Group != "cert-manager.io" {
		t.Fatalf("issuer group = %q", created.Spec.IssuerRef.Group)
	}

	if err := cm.VerifyCert(context.Background(), cert.CertPEM); err != nil {
		t.Fatalf("VerifyCert() error = %v", err)
	}
}

func TestCertManagerSignCSRTimeout(t *testing.T) {
	var polls atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Metadata: certManagerMetadata{Name: "req-timeout"},
			})
		case http.MethodGet:
			polls.Add(1)
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Status: certManagerCertificateRequestStatus{
					Conditions: []certManagerCondition{{Type: "Ready", Status: "False", Reason: "Pending"}},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cm := testM14CertManagerCA(t, server.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := cm.SignCSR(ctx, &CSRRequest{
		AgentName:    "agent-timeout",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err == nil {
		t.Fatalf("SignCSR() error = nil")
	}
	if time.Since(start) > time.Second {
		t.Fatalf("SignCSR() did not honor context timeout")
	}
	if polls.Load() == 0 {
		t.Fatalf("expected at least one poll")
	}
}

func TestCertManagerSignCSRAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer server.Close()

	cm := testM14CertManagerCA(t, server.URL)

	_, err := cm.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-error",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err == nil {
		t.Fatalf("SignCSR() error = nil")
	}
	if !strings.Contains(err.Error(), "certmanager-ca: create CertificateRequest") {
		t.Fatalf("error did not wrap create context: %v", err)
	}
}

func TestCertManagerReadsRawStatusCertificate(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	var certBundle []byte

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var created certManagerCertificateRequestResource
			if err := json.NewDecoder(r.Body).Decode(&created); err != nil {
				t.Errorf("decode create body: %v", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			leafPEM := testM14IssueFromCSR(t, providerM14DecodePossiblyBase64PEM(created.Spec.Request), caCert, caKey)
			certBundle = append(append([]byte(nil), leafPEM...), caPEM...)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Metadata: certManagerMetadata{Name: "req-raw"},
			})
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Status: certManagerCertificateRequestStatus{
					Conditions:  []certManagerCondition{{Type: "Ready", Status: "True"}},
					Certificate: string(certBundle),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cm := testM14CertManagerCA(t, server.URL)
	cert, err := cm.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-raw",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}
	if !bytes.Equal(bytes.TrimSpace(cert.CertPEM), bytes.TrimSpace(certBundle)) {
		t.Fatalf("status.certificate content not preserved")
	}
}

func TestCertManagerVerifyRejectsRevokedFingerprint(t *testing.T) {
	caCert, caKey, caPEM := testM14RootCA(t)
	var certBundle []byte

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var created certManagerCertificateRequestResource
			if err := json.NewDecoder(r.Body).Decode(&created); err != nil {
				t.Errorf("decode create body: %v", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			leafPEM := testM14IssueFromCSR(t, providerM14DecodePossiblyBase64PEM(created.Spec.Request), caCert, caKey)
			certBundle = append(append([]byte(nil), leafPEM...), caPEM...)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Metadata: certManagerMetadata{Name: "req-revoke"},
			})
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(certManagerCertificateRequestResource{
				Status: certManagerCertificateRequestStatus{
					Conditions:  []certManagerCondition{{Type: "Ready", Status: "True"}},
					Certificate: base64.StdEncoding.EncodeToString(certBundle),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cm := testM14CertManagerCA(t, server.URL)
	cert, err := cm.SignCSR(context.Background(), &CSRRequest{
		AgentName:    "agent-revoke",
		PublicKeyPEM: testM14PrivateKeyPEM(t),
	})
	if err != nil {
		t.Fatalf("SignCSR() error = %v", err)
	}

	if err := cm.Revoke(context.Background(), cert.Fingerprint); err != nil {
		t.Fatalf("Revoke() error = %v", err)
	}
	if err := cm.VerifyCert(context.Background(), cert.CertPEM); err == nil {
		t.Fatalf("VerifyCert() accepted revoked certificate")
	}
}

func testM14CertManagerCA(t *testing.T, apiServer string) *CertManagerCA {
	t.Helper()

	cm, err := NewCertManagerCA(CertManagerCAConfig{
		Namespace:           "test-ns",
		IssuerName:          "test-issuer",
		IssuerKind:          "Issuer",
		KubernetesAPIServer: apiServer,
		KubernetesToken:     "test-token",
		Duration:            time.Hour,
	})
	if err != nil {
		t.Fatalf("NewCertManagerCA() error = %v", err)
	}

	return cm
}

func testM14RootCA(t *testing.T) (*x509.Certificate, *ecdsa.PrivateKey, []byte) {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate ca key: %v", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		t.Fatalf("generate ca serial: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Minute),
		NotAfter:              time.Now().Add(24 * time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, template, key.Public(), key)
	if err != nil {
		t.Fatalf("create ca cert: %v", err)
	}

	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatalf("parse ca cert: %v", err)
	}

	return cert, key, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

func testM14IssueFromCSR(t *testing.T, csrPEM []byte, caCert *x509.Certificate, caKey *ecdsa.PrivateKey) []byte {
	t.Helper()

	block, _ := pem.Decode(csrPEM)
	if block == nil {
		t.Fatalf("decode csr PEM failed")
	}

	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		t.Fatalf("parse csr: %v", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		t.Fatalf("generate serial: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber: serial,
		Subject:      csr.Subject,
		DNSNames:     csr.DNSNames,
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
	}

	der, err := x509.CreateCertificate(rand.Reader, template, caCert, csr.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create leaf cert: %v", err)
	}

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

func testM14IssueLeaf(t *testing.T, commonName string, caCert *x509.Certificate, caKey *ecdsa.PrivateKey) ([]byte, []byte) {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate leaf key: %v", err)
	}

	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatalf("marshal leaf key: %v", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		t.Fatalf("generate serial: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: commonName},
		DNSNames:     []string{commonName + ".example.test"},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
	}

	der, err := x509.CreateCertificate(rand.Reader, template, caCert, key.Public(), caKey)
	if err != nil {
		t.Fatalf("create leaf cert: %v", err)
	}

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
}

func testM14PrivateKeyPEM(t *testing.T) []byte {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	der, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}

	return pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: der})
}
