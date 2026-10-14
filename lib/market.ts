export type Market = 'US' | 'UK' | 'IN';
export const markets = {
  US: { label: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸', locale: 'en-US' },
  UK: { label: 'United Kingdom', currency: 'GBP', symbol: '£', flag: '🇬🇧', locale: 'en-GB' },
  IN: { label: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳', locale: 'en-IN' },
} as const;

export function detectMarket(language: string, timeZone: string): Market {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage.endsWith('-in') || timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return 'IN';
  if (normalizedLanguage.endsWith('-gb') || timeZone === 'Europe/London') return 'UK';
  return 'US';
}
