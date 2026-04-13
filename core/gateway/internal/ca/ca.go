// Package ca defines the certificate authority abstraction used by the protocol
// gateway to issue and verify agent certificates for mutual TLS.
package ca

import (
	"context"
	"time"
)

// CSRRequest describes signing inputs for an agent certificate. The gateway uses
// it to bind an agent identity to issued credentials.
type CSRRequest struct {
	// AgentName is the logical agent identifier, typically used as the leaf
	// certificate common name.
	AgentName string
	// PublicKeyPEM carries the agent's public key in PEM form when the caller
	// submits a CSR-style request. Concrete CA implementations may embed this
	// key or ignore it depending on issuance policy.
	PublicKeyPEM []byte
	// RequestedDNSNames lists DNS subject alternative names to place on the
	// issued certificate.
	RequestedDNSNames []string
}

// Certificate is an issued credential bundle returned by a CAProvider.
type Certificate struct {
	// CertPEM holds the PEM-encoded X.509 certificate.
	CertPEM []byte
	// KeyPEM holds the PEM-encoded private key when the CA generated the key
	// material (for example, self-signed development issuers). It may be empty
	// when the caller supplied its own key elsewhere.
	KeyPEM []byte
	// ExpiresAt is the certificate NotAfter instant in UTC.
	ExpiresAt time.Time
	// Fingerprint is the SHA-256 digest of the DER-encoded certificate,
	// represented as a lowercase hex string for stable revocation lookups.
	Fingerprint string
}

// CAProvider issues TLS client and server certificates, validates presented
// chains, rotates authority keys, and tracks revocations for the gateway.
type CAProvider interface {
	// SignCSR validates the request and returns a new certificate. Implementations
	// decide whether the CSR public key, naming, and extensions are honored.
	SignCSR(ctx context.Context, csr *CSRRequest) (*Certificate, error)

	// VerifyCert checks that certPEM parses, chains to a trusted issuer, is
	// within its validity window, and is not revoked.
	VerifyCert(ctx context.Context, certPEM []byte) error

	// RotateCA replaces the active signing material. External integrations that
	// delegate rotation may implement this as a no-op.
	RotateCA(ctx context.Context) error

	// Revoke records a certificate fingerprint so VerifyCert rejects it.
	Revoke(ctx context.Context, fingerprint string) error

	// Close releases resources held by the provider.
	Close() error
}
