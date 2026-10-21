import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === 'true';
}

export function verifyHexSignature(payload: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency: 'INR';
  receipt: string;
}) {
  const config = razorpayConfig();
  if (!config) throw new Error('Razorpay is not configured');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.keyId + ':' + config.keySecret).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
    }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null) as { id?: string; amount?: number; currency?: string; error?: { description?: string } } | null;
  if (!response.ok || !result?.id || result.amount !== input.amount || result.currency !== input.currency) {
    throw new Error(result?.error?.description || 'Razorpay could not create the payment order');
  }
  return { id: result.id, amount: result.amount, currency: result.currency as 'INR' };
}

export async function fetchRazorpayPayment(paymentId: string) {
  const config = razorpayConfig();
  if (!config) throw new Error('Razorpay is not configured');
  const response = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), {
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.keyId + ':' + config.keySecret).toString('base64'),
    },
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') throw new Error('Unable to verify payment with Razorpay');
  return result as { id: string; order_id: string; status: string; amount: number; currency: string; captured: boolean };
}
