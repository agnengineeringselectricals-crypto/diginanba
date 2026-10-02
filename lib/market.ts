export type Market = 'US' | 'UK';
export const markets = {US:{label:'United States',currency:'USD',symbol:'$',flag:'🇺🇸'},UK:{label:'United Kingdom',currency:'GBP',symbol:'£',flag:'🇬🇧'}} as const;
export function detectMarket(language:string,timeZone:string):Market { if(language.toLowerCase().includes('-gb') || timeZone === 'Europe/London') return 'UK'; return 'US'; }
