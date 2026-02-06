// =============================================================================
// S3 Browser Service
// Signed URL generation and file operations
// =============================================================================

import { XMLParser } from 'fast-xml-parser';
import { getS3Credentials, S3Credentials } from './integration-credentials';
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

interface ExtendedS3Credentials extends S3Credentials {
  sessionToken?: string; // STS session token
  pathStyle?: boolean;   // Force path-style URLs
}

// =============================================================================
// Configuration Check (async - checks both env and org credentials)
// =============================================================================

export async function isS3Configured(organizationId: string): Promise<boolean> {
  const creds = await getS3Credentials(organizationId);
  return creds !== null;
}

// Synchronous check for env-only (quick check, use sparingly)
export function isS3ConfiguredSync(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    (process.env.AWS_REGION || process.env.S3_REGION) &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

// =============================================================================
// Extended Credentials (with STS and path-style support)
// =============================================================================

async function getExtendedS3Credentials(
  organizationId: string
): Promise<ExtendedS3Credentials | null> {
  const baseCreds = await getS3Credentials(organizationId);
  if (!baseCreds) return null;

  return {
    ...baseCreds,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    pathStyle: process.env.S3_PATH_STYLE === 'true' || 
               (baseCreds.endpoint ? isPathStyleEndpoint(baseCreds.endpoint) : false),
  };
}

function isPathStyleEndpoint(endpoint: string): boolean {
  // Common S3-compatible services that use path-style
  const pathStyleHosts = ['minio', 'localstack', 'localhost', '127.0.0.1'];
  const host = new URL(endpoint).hostname.toLowerCase();
  return pathStyleHosts.some(h => host.includes(h));
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

// URI encode for S3 (RFC 3986)
function s3UriEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

// URI encode preserving slashes (for paths)
function s3UriEncodePath(str: string): string {
  return str.split('/').map(segment => s3UriEncode(segment)).join('/');
}

// =============================================================================
// URL Building Helpers
// =============================================================================

function buildS3Url(
  creds: ExtendedS3Credentials,
  key: string
): { baseUrl: string; host: string; canonicalUri: string } {
  const normalizedKey = key.replace(/^\/+/, '');
  
  if (creds.endpoint) {
    // Custom endpoint (MinIO, LocalStack, etc.)
    const endpointUrl = new URL(creds.endpoint);
    const host = endpointUrl.host;
    
    if (creds.pathStyle) {
      // Path-style: http://endpoint/bucket/key
      return {
        baseUrl: `${endpointUrl.protocol}//${host}/${creds.bucket}`,
        host,
        canonicalUri: '/' + creds.bucket + '/' + s3UriEncodePath(normalizedKey),
      };
    } else {
      // Virtual-host style with custom endpoint
      return {
        baseUrl: creds.endpoint,
        host,
        canonicalUri: '/' + s3UriEncodePath(normalizedKey),
      };
    }
  } else {
    // Standard AWS S3 - always virtual-host style
    const host = `${creds.bucket}.s3.${creds.region}.amazonaws.com`;
    return {
      baseUrl: `https://${host}`,
      host,
      canonicalUri: '/' + s3UriEncodePath(normalizedKey),
    };
  }
}

function buildS3ListUrl(creds: ExtendedS3Credentials): { baseUrl: string; host: string; canonicalUri: string } {
  if (creds.endpoint) {
    const endpointUrl = new URL(creds.endpoint);
    const host = endpointUrl.host;
    
    if (creds.pathStyle) {
      return {
        baseUrl: `${endpointUrl.protocol}//${host}/${creds.bucket}`,
        host,
        canonicalUri: '/' + creds.bucket + '/',
      };
    } else {
      return {
        baseUrl: creds.endpoint,
        host,
        canonicalUri: '/',
      };
    }
  } else {
    const host = `${creds.bucket}.s3.${creds.region}.amazonaws.com`;
    return {
      baseUrl: `https://${host}`,
      host,
      canonicalUri: '/',
    };
  }
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
  const creds = await getExtendedS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const expiresIn = options.expiresIn ?? 3600;
  const { baseUrl, host, canonicalUri } = buildS3Url(creds, key);

  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';

  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);

  const credentialScope = `${dateStamp}/${creds.region}/${service}/aws4_request`;
  const credential = `${creds.accessKeyId}/${credentialScope}`;

  // Build signed headers list
  const signedHeadersList = ['host'];
  if (creds.sessionToken) {
    signedHeadersList.push('x-amz-security-token');
  }
  const signedHeaders = signedHeadersList.sort().join(';');

  // Query parameters for presigned URL
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  // Add STS session token if present
  if (creds.sessionToken) {
    queryParams['X-Amz-Security-Token'] = creds.sessionToken;
  }

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((k) => `${s3UriEncode(k)}=${s3UriEncode(queryParams[k])}`)
    .join('&');

  // Build canonical headers
  let canonicalHeaders = `host:${host}\n`;
  if (creds.sessionToken) {
    canonicalHeaders = `host:${host}\nx-amz-security-token:${creds.sessionToken}\n`;
  }

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
  const signingKey = await getSigningKey(creds.secretAccessKey, dateStamp, creds.region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  // Build final URL
  const url = `${baseUrl}${canonicalUri}?${sortedParams}&X-Amz-Signature=${signature}`;

  return url;
}

// =============================================================================
// List Objects (using XML API with proper parsing)
// =============================================================================

export async function listObjects(
  organizationId: string,
  prefix: string = '',
  continuationToken?: string,
  maxKeys: number = 100
): Promise<S3ListResult> {
  const creds = await getExtendedS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const { baseUrl, host, canonicalUri } = buildS3ListUrl(creds);

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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${s3UriEncode(k)}=${s3UriEncode(v)}`)
    .join('&');

  // Sign the request
  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${creds.region}/${service}/aws4_request`;

  // Build signed headers
  const headersToSign: Record<string, string> = {
    'host': host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  
  if (creds.sessionToken) {
    headersToSign['x-amz-security-token'] = creds.sessionToken;
  }

  const signedHeaders = Object.keys(headersToSign).sort().join(';');
  const canonicalHeaders = Object.keys(headersToSign)
    .sort()
    .map(k => `${k}:${headersToSign[k]}\n`)
    .join('');

  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    queryString,
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

  const signingKey = await getSigningKey(creds.secretAccessKey, dateStamp, creds.region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `${algorithm} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Build request headers
  const requestHeaders: Record<string, string> = {
    'Host': host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'Authorization': authorization,
  };
  
  if (creds.sessionToken) {
    requestHeaders['x-amz-security-token'] = creds.sessionToken;
  }

  // Make request
  const response = await fetch(`${baseUrl}?${queryString}`, {
    method: 'GET',
    headers: requestHeaders,
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
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const result = parsed.ListBucketResult || {};

  const objects: S3Object[] = [];
  const prefixes: string[] = [];

  // Handle Contents (can be array or single object)
  const contents = result.Contents;
  if (contents) {
    const contentsArray = Array.isArray(contents) ? contents : [contents];
    for (const item of contentsArray) {
      if (item.Key) {
        objects.push({
          key: String(item.Key),
          size: typeof item.Size === 'number' ? item.Size : parseInt(String(item.Size) || '0', 10),
          lastModified: item.LastModified ? new Date(item.LastModified) : new Date(),
          etag: item.ETag ? String(item.ETag).replace(/"/g, '') : undefined,
          isDirectory: false,
        });
      }
    }
  }

  // Handle CommonPrefixes (directories)
  const commonPrefixes = result.CommonPrefixes;
  if (commonPrefixes) {
    const prefixArray = Array.isArray(commonPrefixes) ? commonPrefixes : [commonPrefixes];
    for (const item of prefixArray) {
      if (item.Prefix) {
        prefixes.push(String(item.Prefix));
      }
    }
  }

  return {
    objects,
    prefixes,
    continuationToken: result.NextContinuationToken ? String(result.NextContinuationToken) : undefined,
    isTruncated: result.IsTruncated === true || result.IsTruncated === 'true',
  };
}

// =============================================================================
// Delete Object
// =============================================================================

export async function deleteObject(
  organizationId: string,
  key: string
): Promise<void> {
  const creds = await getExtendedS3Credentials(organizationId);
  if (!creds) {
    throw new Error('S3 is not configured for this organization');
  }

  const { baseUrl, host, canonicalUri } = buildS3Url(creds, key);

  const now = new Date();
  const { dateStamp, amzDate } = formatDate(now);
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${creds.region}/${service}/aws4_request`;

  // Build signed headers
  const headersToSign: Record<string, string> = {
    'host': host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  
  if (creds.sessionToken) {
    headersToSign['x-amz-security-token'] = creds.sessionToken;
  }

  const signedHeaders = Object.keys(headersToSign).sort().join(';');
  const canonicalHeaders = Object.keys(headersToSign)
    .sort()
    .map(k => `${k}:${headersToSign[k]}\n`)
    .join('');

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

  const signingKey = await getSigningKey(creds.secretAccessKey, dateStamp, creds.region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `${algorithm} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Build request headers
  const requestHeaders: Record<string, string> = {
    'Host': host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'Authorization': authorization,
  };
  
  if (creds.sessionToken) {
    requestHeaders['x-amz-security-token'] = creds.sessionToken;
  }

  const response = await fetch(`${baseUrl}${canonicalUri}`, {
    method: 'DELETE',
    headers: requestHeaders,
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
    yaml: 'text/yaml',
    yml: 'text/yaml',
    md: 'text/markdown',
    pdf: 'application/pdf',
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// =============================================================================
// Validation Helpers
// =============================================================================

export function isValidS3Key(key: string): boolean {
  // S3 key constraints
  if (!key || key.length > 1024) return false;
  // No null bytes or certain control characters
  if (/[\x00-\x1f]/.test(key)) return false;
  return true;
}

export function sanitizeS3Key(key: string): string {
  // Remove leading slashes and normalize
  return key.replace(/^\/+/, '').replace(/\/+/g, '/');
}
