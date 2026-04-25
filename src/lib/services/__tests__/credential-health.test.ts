import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../credential-health';

describe('sanitizeError', () => {
  it('redacts bearer tokens', () => {
    const out = sanitizeError(new Error('Unauthorized: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef.xyz'));
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts token= and apikey= parameters', () => {
    expect(sanitizeError('Auth failed: token=abc123defGHI')).toBe('Auth failed: token=[REDACTED]');
    expect(sanitizeError('Rejected: apikey=sk-1234567890')).toBe('Rejected: apikey=[REDACTED]');
  });

  it('redacts password=', () => {
    expect(sanitizeError('connection refused password=supersecret hostname=x')).toContain('password=[REDACTED]');
  });

  it('redacts IPv4 addresses (defense in depth — private and public alike)', () => {
    const out = sanitizeError('failed to connect to 10.0.3.14:8080');
    expect(out).toBe('failed to connect to [INTERNAL_IP]');
    const out2 = sanitizeError('timeout on 203.0.113.42');
    expect(out2).toContain('[INTERNAL_IP]');
  });

  it('truncates long messages to 500 characters', () => {
    const long = 'x'.repeat(1000);
    expect(sanitizeError(long).length).toBe(500);
  });

  it('handles non-Error values', () => {
    expect(sanitizeError('a plain string')).toBe('a plain string');
    expect(sanitizeError({ toString: () => 'stringified' })).toBe('stringified');
    expect(sanitizeError(null)).toBe('null');
  });

  it('does not leak the secret even when it appears mid-sentence', () => {
    const msg =
      'curl -H "Authorization: Bearer eyMySecretToken" https://10.1.2.3/api';
    const out = sanitizeError(msg);
    expect(out).not.toContain('eyMySecretToken');
    expect(out).not.toContain('10.1.2.3');
  });
});
