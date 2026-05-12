package envelope

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	agentv1 "github.com/gnanirahulnutakki/devops-portal/agent/proto/devops_portal/agent/v1"
	"google.golang.org/protobuf/proto"
)

// =============================================================================
// Replay Cache
// =============================================================================

type replayEntry struct {
	commandID string
	expiresAt time.Time
}

type replayCache struct {
	mu      sync.RWMutex
	entries map[string]time.Time // command_id → expires_at
	ttl     time.Duration
}

func newReplayCache(ttl time.Duration) *replayCache {
	c := &replayCache{
		entries: make(map[string]time.Time),
		ttl:     ttl,
	}
	go c.gc()
	return c
}

func (c *replayCache) add(commandID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.entries[commandID]; exists {
		return false // replay detected
	}

	c.entries[commandID] = time.Now().Add(c.ttl)
	return true
}

func (c *replayCache) gc() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for id, expires := range c.entries {
			if now.After(expires) {
				delete(c.entries, id)
			}
		}
		c.mu.Unlock()
	}
}

// =============================================================================
// Signer
// =============================================================================

type Signer struct {
	privateKey ed25519.PrivateKey
	kid        string
}

func NewSigner(privateKey ed25519.PrivateKey, kid string) *Signer {
	return &Signer{
		privateKey: privateKey,
		kid:        kid,
	}
}

// GenerateKeyPair creates a new Ed25519 key pair for issuer signing
func GenerateKeyPair() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	return ed25519.GenerateKey(nil)
}

// canonicalEnvelope returns the canonical bytes for signing (all fields except sig)
func canonicalEnvelope(env *agentv1.Envelope) []byte {
	// Build canonical string: v|command_id|issued_at|user_id|tenant_id|cluster_id|intent|args_hash|issuer_kid
	canonical := fmt.Sprintf(
		"%d|%s|%s|%s|%s|%s|%s|%s|%s",
		env.V,
		env.CommandId,
		env.IssuedAt,
		env.UserId,
		env.TenantId,
		env.ClusterId,
		env.Intent,
		env.ArgsHash,
		env.IssuerKid,
	)
	return []byte(canonical)
}

// canonicalArgs returns the canonical args hash for a protobuf message
func canonicalArgs(msg proto.Message) string {
	b, err := proto.Marshal(msg)
	if err != nil {
		// Fallback: use string representation
		return fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(fmt.Sprintf("%v", msg))))
	}
	h := sha256.Sum256(b)
	return fmt.Sprintf("sha256:%x", h)
}

// Sign creates a signed envelope for the given request
func (s *Signer) Sign(commandID, userID, tenantID, clusterID, intent string, args proto.Message) (*agentv1.Envelope, error) {
	if s.privateKey == nil {
		return nil, fmt.Errorf("signer has no private key")
	}

	issuedAt := time.Now().UTC().Format(time.RFC3339Nano)
	argsHash := canonicalArgs(args)

	env := &agentv1.Envelope{
		V:         1,
		CommandId: commandID,
		IssuedAt:  issuedAt,
		UserId:    userID,
		TenantId:  tenantID,
		ClusterId: clusterID,
		Intent:    intent,
		ArgsHash:  argsHash,
		IssuerKid: s.kid,
	}

	canonical := canonicalEnvelope(env)
	sig := ed25519.Sign(s.privateKey, canonical)
	env.Sig = "ed25519:" + base64.StdEncoding.EncodeToString(sig)

	return env, nil
}

// =============================================================================
// Verifier
// =============================================================================

type Verifier struct {
	trustedKeys map[string]ed25519.PublicKey // kid → pubkey
	replay      *replayCache
	clockSkew   time.Duration
}

func NewVerifier(clockSkew time.Duration) *Verifier {
	return &Verifier{
		trustedKeys: make(map[string]ed25519.PublicKey),
		replay:      newReplayCache(600 * time.Second),
		clockSkew:   clockSkew,
	}
}

func (v *Verifier) AddTrustedKey(kid string, pubkey ed25519.PublicKey) {
	v.trustedKeys[kid] = pubkey
}

func (v *Verifier) RemoveTrustedKey(kid string) {
	delete(v.trustedKeys, kid)
}

// Verify validates an envelope against all 8 rules from the design doc
func (v *Verifier) Verify(env *agentv1.Envelope, requestArgs proto.Message) error {
	// 1. Version must be 1
	if env.V != 1 {
		return fmt.Errorf("invalid version: got %d, want 1", env.V)
	}

	// 2. command_id must not be empty (production should use UUIDv4)
	if env.CommandId == "" {
		return fmt.Errorf("invalid command_id: empty")
	}

	// 3. issued_at must be a valid RFC3339 timestamp
	issuedAt, err := time.Parse(time.RFC3339Nano, env.IssuedAt)
	if err != nil {
		// Try without nanoseconds
		issuedAt, err = time.Parse(time.RFC3339, env.IssuedAt)
		if err != nil {
			return fmt.Errorf("invalid issued_at: %w", err)
		}
	}

	// 4. Clock skew check
	now := time.Now().UTC()
	diff := now.Sub(issuedAt)
	if diff < 0 {
		diff = -diff
	}
	if diff > v.clockSkew {
		return fmt.Errorf("clock skew exceeded: issued_at=%s, now=%s, diff=%s, max=%s",
			env.IssuedAt, now.Format(time.RFC3339Nano), diff, v.clockSkew)
	}

	// 5. user_id, tenant_id, cluster_id must not be empty
	if env.UserId == "" {
		return fmt.Errorf("user_id is empty")
	}
	if env.TenantId == "" {
		return fmt.Errorf("tenant_id is empty")
	}
	if env.ClusterId == "" {
		return fmt.Errorf("cluster_id is empty")
	}

	// 6. intent must not be empty
	if env.Intent == "" {
		return fmt.Errorf("intent is empty")
	}

	// 7. args_hash must match the provided request args
	expectedHash := canonicalArgs(requestArgs)
	if env.ArgsHash != expectedHash {
		return fmt.Errorf("args_hash mismatch: got %s, want %s", env.ArgsHash, expectedHash)
	}

	// 8. Signature verification
	if env.Sig == "" {
		return fmt.Errorf("signature is empty")
	}

	if !strings.HasPrefix(env.Sig, "ed25519:") {
		return fmt.Errorf("invalid signature prefix: expected ed25519:")
	}

	sigB64 := strings.TrimPrefix(env.Sig, "ed25519:")
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return fmt.Errorf("invalid signature base64: %w", err)
	}

	// Find trusted key by issuer_kid
	pubkey, ok := v.trustedKeys[env.IssuerKid]
	if !ok {
		return fmt.Errorf("unknown issuer_kid: %s", env.IssuerKid)
	}

	canonical := canonicalEnvelope(env)
	if !ed25519.Verify(pubkey, canonical, sig) {
		return fmt.Errorf("signature verification failed")
	}

	// 9. Replay check (after signature is valid — prevents replay of valid envelopes)
	if !v.replay.add(env.CommandId) {
		return fmt.Errorf("replay detected: command_id %s already used", env.CommandId)
	}

	return nil
}

// =============================================================================
// Helpers
// =============================================================================

// ParsePublicKey parses an Ed25519 public key from hex or base64
func ParsePublicKey(s string) (ed25519.PublicKey, error) {
	// Try hex first
	if len(s) == 64 {
		b, err := hex.DecodeString(s)
		if err == nil && len(b) == 32 {
			return ed25519.PublicKey(b), nil
		}
	}

	// Try base64
	b, err := base64.StdEncoding.DecodeString(s)
	if err == nil && len(b) == 32 {
		return ed25519.PublicKey(b), nil
	}

	return nil, fmt.Errorf("invalid Ed25519 public key format: expected 32 bytes in hex or base64")
}

// PublicKeyToHex returns the hex encoding of a public key
func PublicKeyToHex(pubkey ed25519.PublicKey) string {
	return hex.EncodeToString(pubkey)
}

// PublicKeyToBase64 returns the base64 encoding of a public key
func PublicKeyToBase64(pubkey ed25519.PublicKey) string {
	return base64.StdEncoding.EncodeToString(pubkey)
}
