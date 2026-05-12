package envelope_test

import (
	"crypto/ed25519"
	"testing"
	"time"

	"github.com/gnanirahulnutakki/devops-portal/agent/pkg/envelope"
	agentv1 "github.com/gnanirahulnutakki/devops-portal/agent/proto/devops_portal/agent/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// =============================================================================
// Test Fixtures
// =============================================================================

func mustGenerateKeys(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := envelope.GenerateKeyPair()
	if err != nil {
		t.Fatalf("generate key pair: %v", err)
	}
	return pub, priv
}

func mustCreateSigner(t *testing.T, kid string) (*envelope.Signer, ed25519.PublicKey) {
	t.Helper()
	pub, priv := mustGenerateKeys(t)
	return envelope.NewSigner(priv, kid), pub
}

func mustCreateVerifier(t *testing.T, kid string, pubkey ed25519.PublicKey, skew time.Duration) *envelope.Verifier {
	t.Helper()
	v := envelope.NewVerifier(skew)
	v.AddTrustedKey(kid, pubkey)
	return v
}

func simpleArgs() *agentv1.K8SListRequest {
	return &agentv1.K8SListRequest{
		Namespace: "default",
	}
}

// =============================================================================
// Sign + Verify Round-Trip Tests
// =============================================================================

func TestSignAndVerify(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify: %v", err)
	}
}

func TestVerifyWithDifferentArgsFails(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	signedArgs := &agentv1.K8SListRequest{Namespace: "default"}
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", signedArgs)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Verify with different args
	differentArgs := &agentv1.K8SListRequest{Namespace: "kube-system"}
	if err := verifier.Verify(env, differentArgs); err == nil {
		t.Fatal("expected args_hash mismatch error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyWithTamperedCommandIDFails(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Tamper with command_id
	env.CommandId = "cmd-002"

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected signature verification to fail after tampering, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyWithTamperedIntentFails(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Tamper with intent
	env.Intent = "ListNodes"

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected signature verification to fail after intent tampering, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyWithTamperedClusterIDFails(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Tamper with cluster_id
	env.ClusterId = "cluster-2"

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected signature verification to fail after cluster_id tampering, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

// =============================================================================
// Validation Rule Tests
// =============================================================================

func TestVerifyInvalidVersion(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	env.V = 2

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected version error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyEmptyUserID(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected empty user_id error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyEmptyTenantID(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected empty tenant_id error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyEmptyClusterID(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected empty cluster_id error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyEmptyIntent(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected empty intent error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyEmptySignature(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	env.Sig = ""

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected empty signature error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyInvalidSignaturePrefix(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	env.Sig = "rsa256:base64stuff"

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected invalid signature prefix error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyUnknownIssuerKID(t *testing.T) {
	signer, _ := mustCreateSigner(t, "issuer-1")
	// Verifier only knows issuer-2
	pubkey2, _ := mustGenerateKeys(t)
	verifier := mustCreateVerifier(t, "issuer-2", pubkey2, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected unknown issuer_kid error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyWrongKey(t *testing.T) {
	signer, _ := mustCreateSigner(t, "issuer-1")
	// Verifier has a different key for issuer-1
	wrongPubkey, _ := mustGenerateKeys(t)
	verifier := mustCreateVerifier(t, "issuer-1", wrongPubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected signature verification to fail with wrong key, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

// =============================================================================
// Clock Skew Tests
// =============================================================================

func TestVerifyClockSkewAcceptable(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	// 30-second skew window
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 30*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify within skew: %v", err)
	}
}

func TestVerifyClockSkewExceeded(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	// 1-nanosecond skew window — anything will fail
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 1*time.Nanosecond)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected clock skew error, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

func TestVerifyOldEnvelopeFails(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 1*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Artificially backdate the envelope
	env.IssuedAt = time.Now().UTC().Add(-5 * time.Minute).Format(time.RFC3339Nano)

	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected old envelope to fail clock skew, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}

// =============================================================================
// Replay Detection Tests
// =============================================================================

func TestVerifyReplayDetected(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()
	env, err := signer.Sign("cmd-replay-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// First verify succeeds
	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("first verify: %v", err)
	}

	// Second verify with same command_id fails (replay)
	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected replay error on second verify, got nil")
	} else {
		t.Logf("expected replay error: %v", err)
	}
}

func TestVerifyDifferentCommandIDNotReplay(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	args := simpleArgs()

	// First envelope
	env1, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign first: %v", err)
	}
	if err := verifier.Verify(env1, args); err != nil {
		t.Fatalf("verify first: %v", err)
	}

	// Second envelope with different command_id
	env2, err := signer.Sign("cmd-002", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign second: %v", err)
	}
	if err := verifier.Verify(env2, args); err != nil {
		t.Fatalf("verify second: %v", err)
	}
}

// =============================================================================
// Key Parsing Tests
// =============================================================================

func TestParsePublicKeyHex(t *testing.T) {
	pub, _ := mustGenerateKeys(t)
	hex := envelope.PublicKeyToHex(pub)

	parsed, err := envelope.ParsePublicKey(hex)
	if err != nil {
		t.Fatalf("parse hex key: %v", err)
	}
	if string(parsed) != string(pub) {
		t.Error("hex round-trip mismatch")
	}
}

func TestParsePublicKeyBase64(t *testing.T) {
	pub, _ := mustGenerateKeys(t)
	b64 := envelope.PublicKeyToBase64(pub)

	parsed, err := envelope.ParsePublicKey(b64)
	if err != nil {
		t.Fatalf("parse base64 key: %v", err)
	}
	if string(parsed) != string(pub) {
		t.Error("base64 round-trip mismatch")
	}
}

func TestParsePublicKeyInvalid(t *testing.T) {
	_, err := envelope.ParsePublicKey("not-a-key")
	if err == nil {
		t.Fatal("expected error for invalid key, got nil")
	}
}

// =============================================================================
// Complex Args Tests
// =============================================================================

func TestVerifyWithComplexArgs(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	// Complex ArgoCD list request with filters
	args := &agentv1.ArgoListAppsRequest{
		Project:  "default",
		Selector: "app=guestbook",
	}

	env, err := signer.Sign("cmd-complex-001", "user-1", "tenant-1", "cluster-1", "ArgoListApplications", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify complex args: %v", err)
	}
}

func TestVerifyWithTimestampArgs(t *testing.T) {
	signer, pubkey := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey, 60*time.Second)

	// Prometheus query with timestamp
	args := &agentv1.PromQueryRequest{
		Query: "up",
		Time:  timestamppb.New(time.Now()),
	}

	env, err := signer.Sign("cmd-ts-001", "user-1", "tenant-1", "cluster-1", "PromQuery", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify timestamp args: %v", err)
	}
}

// =============================================================================
// Multiple Keys / Key Rotation Tests
// =============================================================================

func TestVerifyMultipleTrustedKeys(t *testing.T) {
	signer1, pubkey1 := mustCreateSigner(t, "issuer-1")
	pubkey2, _ := mustGenerateKeys(t)

	verifier := envelope.NewVerifier(60 * time.Second)
	verifier.AddTrustedKey("issuer-1", pubkey1)
	verifier.AddTrustedKey("issuer-2", pubkey2)

	args := simpleArgs()
	env, err := signer1.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify with multiple keys: %v", err)
	}
}

func TestVerifyAfterKeyRotation(t *testing.T) {
	signer1, pubkey1 := mustCreateSigner(t, "issuer-1")
	verifier := mustCreateVerifier(t, "issuer-1", pubkey1, 60*time.Second)

	args := simpleArgs()
	env, err := signer1.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// Verify with old key succeeds
	if err := verifier.Verify(env, args); err != nil {
		t.Fatalf("verify with old key: %v", err)
	}

	// Rotate key
	signer2, pubkey2 := mustCreateSigner(t, "issuer-1")
	verifier.RemoveTrustedKey("issuer-1")
	verifier.AddTrustedKey("issuer-1", pubkey2)

	// Old envelope now fails
	if err := verifier.Verify(env, args); err == nil {
		t.Fatal("expected error after key rotation, got nil")
	} else {
		t.Logf("expected error after rotation: %v", err)
	}

	// New envelope with new key succeeds
	env2, err := signer2.Sign("cmd-002", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err != nil {
		t.Fatalf("sign with new key: %v", err)
	}
	if err := verifier.Verify(env2, args); err != nil {
		t.Fatalf("verify with new key: %v", err)
	}
}

// =============================================================================
// Signer Without Key Tests
// =============================================================================

func TestSignWithoutPrivateKey(t *testing.T) {
	signer := envelope.NewSigner(nil, "issuer-bad")

	args := simpleArgs()
	_, err := signer.Sign("cmd-001", "user-1", "tenant-1", "cluster-1", "ListPods", args)
	if err == nil {
		t.Fatal("expected error when signing without private key, got nil")
	} else {
		t.Logf("expected error: %v", err)
	}
}
