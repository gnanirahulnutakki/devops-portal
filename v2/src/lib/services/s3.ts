// =============================================================================
// S3 Browser Service
// Signed URL generation and file operations
// =============================================================================

import { getS3Credentials } from './integration-credentials';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  isDirectory: boolean;
}

export interface S3ListResult {
  objects: S3Object[];
  prefixes: string[]; // "directories"
  continuationToken?: string;
  isTruncated: boolean;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  contentType?: string;
  contentDisposition?: string;
}

// =============================================================================
// Configuration Check
// =============================================================================

export function isS3Configured(_organizationId: string): boolean {
  // For now, check env vars - org-specific check would need async
  return !!(
    process.env.S3_BUCKET &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

// =============================================================================
// AWS Signature V4 Implementation (No SDK dependency)
// =============================================================================

async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function formatDate(date: Date): { dateStamp: string; amzDate: string } {
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return { dateStamp, amzDate };
}

// =============================================================================
// Signed URL Generation
// =============================================================================

export async function generateSignedUrl(
  organizationId: string,
  key: string,
  method: 'GET' | 'PUT' = 'GET',
  options: SignedUrlOptions = {}
): Promise<string> {
  const creds = await getS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const { bucket, region, accessKeyId, secretAccessKey, endpoint } = creds;
  const expiresIn = options.expiresIn ?? 3600;

  // Build host
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;

  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';

  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);

  // Normalize key (remove leading slash)
  const normalizedKey = key.replace(/^\/+/, '');

  // Build canonical query string for pre-signed URL
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  };

  if (options.contentType && method === 'PUT') {
    queryParams['Content-Type'] = options.contentType;
  }

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  // Canonical request
  const canonicalUri = '/' + normalizedKey.split('/').map(encodeURIComponent).join('/');
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method,
    canonicalUri,
    sortedParams,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  // Calculate signature
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  // Build final URL
  const baseUrl = endpoint || `https://${host}`;
  const url = `${baseUrl}/${normalizedKey}?${sortedParams}&X-Amz-Signature=${signature}`;

  return url;
}

// =============================================================================
// List Objects (using XML API)
// =============================================================================

export async function listObjects(
  organizationId: string,
  prefix: string = '',
  continuationToken?: string,
  maxKeys: number = 100
): Promise<S3ListResult> {
  const creds = await getS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const { bucket, region, accessKeyId, secretAccessKey, endpoint } = creds;

  // Build list request URL
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;

  const queryParams: Record<string, string> = {
    'list-type': '2',
    'max-keys': maxKeys.toString(),
    delimiter: '/',
  };

  if (prefix) {
    queryParams.prefix = prefix;
  }

  if (continuationToken) {
    queryParams['continuation-token'] = continuationToken;
  }

  const queryString = Object.entries(queryParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Sign the request
  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = '/';
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Make request
  const baseUrl = endpoint || `https://${host}`;
  const response = await fetch(`${baseUrl}/?${queryString}`, {
    method: 'GET',
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': authorization,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, text }, 'S3 list objects failed');
    throw new Error(`S3 list failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseListObjectsResponse(xml);
}

function parseListObjectsResponse(xml: string): S3ListResult {
  // Simple XML parsing (production should use a proper XML parser)
  const objects: S3Object[] = [];
  const prefixes: string[] = [];

  // Extract <Contents> elements
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentsRegex.exec(xml)) !== null) {
    const content = match[1];
    const key = content.match(/<Key>(.*?)<\/Key>/)?.[1] || '';
    const size = parseInt(content.match(/<Size>(.*?)<\/Size>/)?.[1] || '0', 10);
    const lastModified = content.match(/<LastModified>(.*?)<\/LastModified>/)?.[1];
    const etag = content.match(/<ETag>(.*?)<\/ETag>/)?.[1]?.replace(/"/g, '');

    objects.push({
      key,
      size,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
      etag,
      isDirectory: false,
    });
  }

  // Extract <CommonPrefixes> elements (directories)
  const prefixRegex = /<CommonPrefixes>\s*<Prefix>(.*?)<\/Prefix>\s*<\/CommonPrefixes>/g;
  while ((match = prefixRegex.exec(xml)) !== null) {
    prefixes.push(match[1]);
  }

  // Check for truncation
  const isTruncated = xml.includes('<IsTruncated>true</IsTruncated>');
  const continuationToken = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1];

  return {
    objects,
    prefixes,
    continuationToken,
    isTruncated,
  };
}

// =============================================================================
// Delete Object
// =============================================================================

export async function deleteObject(
  organizationId: string,
  key: string
): Promise<void> {
  const creds = await getS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const { bucket, region, accessKeyId, secretAccessKey, endpoint } = creds;

  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;

  const normalizedKey = key.replace(/^\/+/, '');
  const canonicalUri = '/' + normalizedKey.split('/').map(encodeURIComponent).join('/');

  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const baseUrl = endpoint || `https://${host}`;
  const response = await fetch(`${baseUrl}${canonicalUri}`, {
    method: 'DELETE',
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Authorization': authorization,
    },
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    logger.error({ status: response.status, text, key }, 'S3 delete failed');
    throw new Error(`S3 delete failed: ${response.status}`);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtension(key: string): string {
  const parts = key.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getMimeType(key: string): string {
  const ext = getFileExtension(key);
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
