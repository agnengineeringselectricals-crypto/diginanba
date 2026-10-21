import 'server-only';
import { createHash, createHmac } from 'node:crypto';

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}
function hex(value: Buffer | string) {
  return typeof value === 'string' ? Buffer.from(value).toString('hex') : value.toString('hex');
}
function encodePath(path: string) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

export function createPrivateDownloadUrl(storageKey: string, expiresSeconds = 60) {
  const endpointValue = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpointValue || !bucket || !accessKey || !secretKey) throw new Error('Private download storage is not configured');
  if (!storageKey || storageKey.startsWith('/') || storageKey.split('/').some((part) => part === '..')) throw new Error('Invalid private asset key');

  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid private storage endpoint');
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const host = endpoint.host;
  const basePath = endpoint.pathname.replace(/\/$/, '');
  const canonicalUri = `${basePath}/${encodeURIComponent(bucket)}/${encodePath(storageKey)}`.replace(/\/+/g, '/');
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.max(1, Math.min(300, expiresSeconds))),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.entries(query).map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')].join('\n');
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hex(hmac(signingKey, stringToSign));
  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
