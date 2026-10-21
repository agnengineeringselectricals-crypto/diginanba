import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay server credentials are not configured');
  return { keyId, keySecret };
}

export function razorpayKeyId() {
  return credentials().keyId;
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: { diginanba_order_id: input.receipt },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Razorpay order creation failed');
  const data = await response.json() as { id?: string; amount?: number; currency?: string; status?: string };
  if (!data.id || data.amount !== input.amount || data.currency !== input.currency) {
    throw new Error('Razorpay returned an unexpected order');
  }
  return { id: data.id, amount: data.amount, currency: data.currency, keyId };
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret } = credentials();
  const expected = createHmac('sha256', keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest();
  let received: Buffer;
  try { received = Buffer.from(input.signature, 'hex'); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let received: Buffer;
  try { received = Buffer.from(signature, 'hex'); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function fetchRazorpayPayment(paymentId: string) {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Unable to verify Razorpay payment');
  return await response.json() as {
    id: string; order_id: string; amount: number; currency: string;
    status: string; captured: boolean;
  };
}
