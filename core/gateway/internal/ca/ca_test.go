package ca

import (
	"context"
	"testing"
	"time"
)

func TestSelfSignedCA_SignAndVerify(t *testing.T) {
	t.Parallel()

	ca, err := NewSelfSignedCA()
	if err != nil {
		t.Fatalf("NewSelfSignedCA: %v", err)
	}
	t.Cleanup(func() { _ = ca.Close() })

	t.Run("valid_chain", func(t *testing.T) {
		t.Parallel()

		cert, err := ca.SignCSR(context.Background(), &CSRRequest{
			AgentName:         "agent-one",
			RequestedDNSNames: []string{"agent-one.local"},
		})
		if err != nil {
			t.Fatalf("SignCSR: %v", err)
		}
		if len(cert.CertPEM) == 0 || len(cert.KeyPEM) == 0 {
			t.Fatal("expected cert and key PEM")
		}
		if cert.Fingerprint == "" {
			t.Fatal("expected fingerprint")
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err != nil {
			t.Fatalf("VerifyCert: %v", err)
		}
	})
}

func TestSelfSignedCA_Revoke(t *testing.T) {
	t.Parallel()

	ca, err := NewSelfSignedCA()
	if err != nil {
		t.Fatalf("NewSelfSignedCA: %v", err)
	}
	t.Cleanup(func() { _ = ca.Close() })

	t.Run("revoked_fails_verification", func(t *testing.T) {
		t.Parallel()

		cert, err := ca.SignCSR(context.Background(), &CSRRequest{AgentName: "revoke-me"})
		if err != nil {
			t.Fatalf("SignCSR: %v", err)
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err != nil {
			t.Fatalf("VerifyCert before revoke: %v", err)
		}

		if err := ca.Revoke(context.Background(), cert.Fingerprint); err != nil {
			t.Fatalf("Revoke: %v", err)
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err == nil {
			t.Fatal("expected verification failure after revoke")
		}
	})
}

func TestSelfSignedCA_ExpiredCert(t *testing.T) {
	t.Parallel()

	ca, err := NewSelfSignedCA()
	if err != nil {
		t.Fatalf("NewSelfSignedCA: %v", err)
	}
	t.Cleanup(func() { _ = ca.Close() })

	t.Run("not_after_in_past", func(t *testing.T) {
		t.Parallel()

		now := time.Now().UTC()
		pastEnd := now.Add(-1 * time.Hour)
		pastStart := pastEnd.Add(-1 * time.Hour)

		cert, err := ca.signCSR(&CSRRequest{AgentName: "expired-agent"}, pastStart, pastEnd)
		if err != nil {
			t.Fatalf("signCSR: %v", err)
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err == nil {
			t.Fatal("expected verification failure for expired certificate")
		}
	})
}

func TestSelfSignedCA_RotateCA(t *testing.T) {
	t.Parallel()

	ca, err := NewSelfSignedCA()
	if err != nil {
		t.Fatalf("NewSelfSignedCA: %v", err)
	}
	t.Cleanup(func() { _ = ca.Close() })

	t.Run("old_leaf_invalid_after_rotation", func(t *testing.T) {
		t.Parallel()

		cert, err := ca.SignCSR(context.Background(), &CSRRequest{AgentName: "pre-rotate"})
		if err != nil {
			t.Fatalf("SignCSR: %v", err)
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err != nil {
			t.Fatalf("VerifyCert before rotate: %v", err)
		}

		if err := ca.RotateCA(context.Background()); err != nil {
			t.Fatalf("RotateCA: %v", err)
		}

		if err := ca.VerifyCert(context.Background(), cert.CertPEM); err == nil {
			t.Fatal("expected verification failure for cert signed by old CA")
		}
	})
}
