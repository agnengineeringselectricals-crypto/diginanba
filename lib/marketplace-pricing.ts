export type NanbaPricingPolicy = {
  minimum_fee_amount: string | number;
  minimum_fee_percent: string | number;
  operating_cost_per_order: string | number;
  api_cost_per_order: string | number;
  database_cost_per_order: string | number;
  hosting_cost_per_order: string | number;
  target_profit_per_order: string | number;
  service_tax_rate: string | number;
  discount_capture_ratio: string | number;
};
export function calculateShopProductPrice(input:{
  mrp:number; maxDiscount:number; policy:NanbaPricingPolicy;
}) {
  const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
  const p=input.policy;
  const operating=Number(p.operating_cost_per_order||0)+Number(p.api_cost_per_order||0)+Number(p.database_cost_per_order||0)+Number(p.hosting_cost_per_order||0);
  const target=Math.max(Number(p.minimum_fee_amount||0),Number(p.minimum_fee_percent||0)*input.mrp/100,operating+Number(p.target_profit_per_order||0),0.01);
  const taxRate=Math.max(0,Number(p.service_tax_rate||0))/100;
  const feeFloor=money(target*(1+taxRate));
  const maxDiscount=Math.min(input.mrp,Math.max(0,input.maxDiscount));
  const protectedPayout=money(input.mrp-maxDiscount);
  const discountCapacity=Math.max(0,maxDiscount-feeFloor);
  const ratio=Math.min(1,Math.max(0,Number(p.discount_capture_ratio??1)));
  const customerDiscount=money(discountCapacity*ratio);
  const nanbaFee=money(Math.max(feeFloor,maxDiscount-customerDiscount));
  const customerPrice=money(protectedPayout+nanbaFee);
  return {protectedPayout,customerDiscount,nanbaFee,customerPrice,feeFloor};
}
