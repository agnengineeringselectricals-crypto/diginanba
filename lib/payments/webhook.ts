import crypto from 'node:crypto';

export function verifyHmacSignature(rawBody:string,signature:string|null,secret:string|undefined){
  if(!secret||!signature)return false;
  const supplied=signature.startsWith('sha256=')?signature.slice(7):signature;
  const expected=crypto.createHmac('sha256',secret).update(rawBody,'utf8').digest('hex');
  if(supplied.length!==expected.length)return false;
  return crypto.timingSafeEqual(Buffer.from(supplied,'utf8'),Buffer.from(expected,'utf8'));
}
export function verifyRazorpayWebhook(rawBody:string,signature:string|null){
  return verifyHmacSignature(rawBody,signature,process.env.RAZORPAY_WEBHOOK_SECRET);
}
