import 'server-only';

export type PaymentProviderKey = 'demo' | 'razorpay' | 'stripe';
export type PaymentCurrency = 'USD' | 'GBP' | 'INR';
export type PaymentOrder = { orderId: string; amountMinor: number; currency: PaymentCurrency; customerEmail?: string };
export type PaymentSession = { provider: PaymentProviderKey; status: 'demo' | 'requires_provider'; externalId?: string; clientSecret?: string };
export interface PaymentProvider { readonly key: PaymentProviderKey; createCheckout(order: PaymentOrder): Promise<PaymentSession> }
const liveEnabled = process.env.PAYMENTS_LIVE === 'true';
export const paymentProviderStatus = {
  demo: { configured: true, live: false },
  razorpay: { configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), live: liveEnabled && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) },
  stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY), live: liveEnabled && Boolean(process.env.STRIPE_SECRET_KEY) },
} as const;
export function getConfiguredProvider(): PaymentProviderKey {
  const requested = process.env.PAYMENT_PROVIDER as PaymentProviderKey | undefined;
  if (requested === 'razorpay' && paymentProviderStatus.razorpay.configured && liveEnabled) return 'razorpay';
  if (requested === 'stripe' && paymentProviderStatus.stripe.configured && liveEnabled) return 'stripe';
  return 'demo';
}
class DemoProvider implements PaymentProvider { readonly key='demo' as const; async createCheckout(): Promise<PaymentSession>{ return {provider:'demo',status:'demo'}; } }
class RazorpayProvider implements PaymentProvider {
  readonly key='razorpay' as const;
  async createCheckout(order:PaymentOrder):Promise<PaymentSession>{
    const keyId=process.env.RAZORPAY_KEY_ID; const keySecret=process.env.RAZORPAY_KEY_SECRET;
    if(!keyId||!keySecret||!liveEnabled) throw new Error('Razorpay is not activated for this environment.');
    const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:order.amountMinor,currency:order.currency,receipt:order.orderId,notes:{diginanba_order_id:order.orderId}}),cache:'no-store'});
    if(!response.ok) throw new Error(`Razorpay order creation failed (${response.status}).`);
    const data=await response.json() as {id?:string}; if(!data.id) throw new Error('Razorpay returned no provider order id.');
    return {provider:'razorpay',status:'requires_provider',externalId:data.id};
  }
}
class StripeProvider implements PaymentProvider {
  readonly key='stripe' as const;
  async createCheckout(order:PaymentOrder):Promise<PaymentSession>{
    const secret=process.env.STRIPE_SECRET_KEY; if(!secret||!liveEnabled) throw new Error('Stripe is not activated for this environment.');
    const body=new URLSearchParams({amount:String(order.amountMinor),currency:order.currency.toLowerCase(),'metadata[diginanba_order_id]':order.orderId});
    if(order.customerEmail) body.set('receipt_email',order.customerEmail);
    const response=await fetch('https://api.stripe.com/v1/payment_intents',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});
    if(!response.ok) throw new Error(`Stripe PaymentIntent creation failed (${response.status}).`);
    const data=await response.json() as {id?:string;client_secret?:string}; if(!data.id) throw new Error('Stripe returned no payment id.');
    return {provider:'stripe',status:'requires_provider',externalId:data.id,clientSecret:data.client_secret};
  }
}
export function getPaymentProvider():PaymentProvider{switch(getConfiguredProvider()){case 'razorpay':return new RazorpayProvider();case 'stripe':return new StripeProvider();default:return new DemoProvider();}}
